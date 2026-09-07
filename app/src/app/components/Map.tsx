// Hooks
import { useEffect, useRef, useState } from "react";

// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";
import { soundingActions } from "@/lib/store/features/sounding";

// Geometry
import { insideRing } from "@/lib/geometry";

// Client
import {
  ForecastCloudsUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
  ForecastCloudBaseUrl,
  RadarReflectivityUrl,
  RadarStormCoresUrl,
  RadarStormMotionUrl,
  RadarEchoFreezeUrl,
  LightningUrl,
  CandidateFieldUrl,
  CandidateConfirmedUrl,
  ReplayCandidateUrl,
  ReplayConfirmedUrl,
  ReplayCloudBaseUrl,
  ReplayLiquidUrl,
  ReplayRadarUrl,
  ReplayRadarStormCoresUrl,
  ReplayRadarStormMotionUrl,
  ReplayRadarEchoFreezeUrl,
  ReplayLightningUrl,
} from "@/lib/client";

// ArcGIS
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import {
  CandidateCloudBaseLayer,
  ForecastCloudsLayer,
  ForecastLiquidLayer,
  ForecastPrecipLayer,
  CandidateLiquidLayer,
  CandidateRadarLayer,
  CandidateEchoFreezeLayer,
  CandidateStormCoreLayer,
  CandidateStormMotionLayer,
  CandidateLightningLayer,
  CandidateConfirmedLayer,
  CandidateFieldLayer,
  ReplayCloudBaseLayer,
  ReplayConfirmedLayer,
  ReplayFieldLayer,
  ReplayLiquidLayer,
  ReplayRadarLayer,
  ReplayEchoFreezeLayer,
  ReplayStormCoreLayer,
  ReplayStormMotionLayer,
  ReplayLightningLayer,
} from "@/lib/arcgis/layers";
import { PRECIP_FIRST_HOUR } from "@/lib/arcgis/bands";
import { INITIAL_BOX, heldBox } from "@/lib/bbox";

// Types
import type { ClickEvent } from "@arcgis/core/views/input/types";
import type { MapMode } from "@/lib/types";

type PropsT = {
  /** Which map this route is: modeled forecast, or observed candidate. */
  mode: MapMode;
};

export const ArcGIS = ({ mode }: PropsT) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const drawnCloudUrl = useRef<string | null>(null);
  const drawnPrecipUrl = useRef<string | null>(null);
  const drawnLiquidUrl = useRef<string | null>(null);
  const drawnReplayAt = useRef<string | null>(null);
  const drawnBuild = useRef<string | null>(null);
  const drawnBoxKey = useRef<string | null>(null);
  const [viewBox, setViewBox] = useState(INITIAL_BOX);

  const dispatch = useAppDispatch();
  const coordinates = useAppSelector((state) => state.interactions.coordinates);
  const hour = useAppSelector((state) => state.forecast.hour);
  const precip = useAppSelector((state) => state.forecast.precip);
  const forecastLiquid = useAppSelector((state) => state.forecast.liquid);
  const cloudBase = useAppSelector((state) => state.cloudbase.visible);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const radar = useAppSelector((state) => state.radar.visible);
  const lightning = useAppSelector((state) => state.radar.lightning);
  const heading = useAppSelector((state) => state.radar.heading);
  const echoFreeze = useAppSelector((state) => state.radar.echoFreeze);
  const field = useAppSelector((state) => state.seedability.visible);
  const build = useAppSelector((state) => state.seedability.drawn);
  const ring = useAppSelector((state) => state.domain.ring);
  const ready = useAppSelector((state) => state.replay.ready);
  const replayCloudBase = useAppSelector((state) => state.replay.cloudBase);
  const replayLiquid = useAppSelector((state) => state.replay.liquid);
  const replayRadar = useAppSelector((state) => state.replay.radar);
  const replayLightning = useAppSelector((state) => state.replay.lightning);
  const replayHeading = useAppSelector((state) => state.replay.heading);
  const replayEchoFreeze = useAppSelector((state) => state.replay.echoFreeze);
  const replayField = useAppSelector((state) => state.replay.field);
  const forecasting = mode === "forecast";
  const replaying = mode === "replay";
  const raining = forecasting && hour >= PRECIP_FIRST_HOUR;

  // Initialize the map once
  useEffect(() => {
    if (mapDiv.current && !viewRef.current) {
      const map = new Map({
        basemap: "dark-gray-vector",
        // Order is draw order. On the forecast map rain sits over cloud; on
        // the candidate map the measured radar sits over everything a model
        // drew, because a candidate is only disqualified by rain where the
        // two overlap, so the disqualifier has to be the layer you can see.
        //
        // Cloud base is at the bottom: it covers more ground than any of
        // them and it is the question you ask *before* the others — can I
        // get into this cloud at all — so it belongs under the answers.
        //
        // Either map's supercooled liquid sits inside the cloud it is drawn
        // from, so it goes over the cloud and under what falls out of it.
        layers: [
          CandidateCloudBaseLayer,
          ForecastCloudsLayer,
          ForecastLiquidLayer,
          ForecastPrecipLayer,
          CandidateLiquidLayer,
          CandidateRadarLayer,
          CandidateEchoFreezeLayer,
          CandidateLightningLayer,
          CandidateStormMotionLayer,
          CandidateStormCoreLayer,
          CandidateFieldLayer,
          CandidateConfirmedLayer,
        ],
      });

      const view = new MapView({
        container: mapDiv.current,
        map: map,
        center: [-99.9, 31.4],
        zoom: 5,
      });
      view.attributionVisible = false;

      const boundary = new Extent({
        xmin: -180,
        ymin: 17,
        xmax: -65,
        ymax: 72,
        spatialReference: { wkid: 4326 }, // In other words, GPS
      });
      view.constraints = {
        geometry: boundary,
        minZoom: 3,
      };

      viewRef.current = view;
      mapRef.current = map;
    }
  }, []);

  // National grids stay on the server. The map asks for a padded window
  // that covers the view and keeps it while the view sits inside, so
  // zooming does not refetch. The rings are smoothed the same way at
  // every zoom; eval asks for the fine stairs separately.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const apply = () => {
      const extent = view.extent as
        { xmin: number; ymin: number; xmax: number; ymax: number } | undefined;
      if (!extent) return;
      setViewBox((held) => heldBox(held, extent));
    };
    apply();
    const handle = reactiveUtils.watch(
      () => view.stationary,
      (stationary) => {
        if (stationary) apply();
      }
    );
    return () => handle.remove();
  }, []);

  // Layer visibility is derived from the route's mode plus the store, in one
  // place. The forecast map is modeled contours; the candidate map is observed
  // cloud tops plus the analysis of what is inside the cloud. Both stay on the
  // map so switching re-uses what's loaded.
  //
  // The precipitation layer hides before PRECIP_FIRST_HOUR rather than drawing
  // an empty frame: HRRR has no precipitation at the analysis, and a layer
  // that's on but blank reads as "no rain" instead of "not modeled yet".
  // The candidate layers are pinned to "now", so they stay off while replaying
  // — showing today's scene under a 2025 date is the one thing this page must
  // never do, and it would look like a slow load rather than a wrong answer.
  const candidating = mode === "candidate";

  useEffect(() => {
    ForecastCloudsLayer.visible = forecasting;
    ForecastLiquidLayer.visible = forecasting && forecastLiquid;
    ForecastPrecipLayer.visible = raining && precip;
    CandidateCloudBaseLayer.visible = candidating && cloudBase;
    // Modeled, so it belongs to the candidate map only — the same rule that
    // keeps the observed layers off the forecast one, running the other way.
    CandidateLiquidLayer.visible = candidating && liquid;
    // Observations, so they never appear on the modeled map — the same rule
    // that keeps the satellite cloud tops off it.
    CandidateRadarLayer.visible = candidating && radar;
    CandidateEchoFreezeLayer.visible = candidating && radar && echoFreeze;
    CandidateLightningLayer.visible = candidating && radar && lightning;
    CandidateStormMotionLayer.visible = candidating && radar && heading;
    CandidateStormCoreLayer.visible = candidating && radar && heading;
    // The Texas fly fill — where to click. The liquid-with-no-rain outline is
    // not this layer.
    CandidateFieldLayer.visible = candidating && field;
    CandidateConfirmedLayer.visible = false;
    // Gated on `ready`, not on the hour that was asked for. `setAt` clears
    // `ready`, so picking a date blanks the map immediately and it stays blank
    // until every source has answered — they take 10 s to 40 s and finish
    // apart, and revealing each as it landed showed two dates at once.
    const drawable = replaying && ready !== null;
    ReplayCloudBaseLayer.visible = drawable && replayCloudBase;
    ReplayLiquidLayer.visible = drawable && replayLiquid;
    ReplayRadarLayer.visible = drawable && replayRadar;
    ReplayEchoFreezeLayer.visible = drawable && replayRadar && replayEchoFreeze;
    ReplayLightningLayer.visible = drawable && replayRadar && replayLightning;
    ReplayStormMotionLayer.visible = drawable && replayRadar && replayHeading;
    ReplayStormCoreLayer.visible = drawable && replayRadar && replayHeading;
    ReplayFieldLayer.visible = drawable && replayField;
    ReplayConfirmedLayer.visible = false;
  }, [
    forecasting,
    candidating,
    replaying,
    raining,
    precip,
    forecastLiquid,
    cloudBase,
    liquid,
    radar,
    lightning,
    heading,
    echoFreeze,
    field,
    ready,
    replayCloudBase,
    replayLiquid,
    replayRadar,
    replayLightning,
    replayHeading,
    replayEchoFreeze,
    replayField,
  ]);

  // Point each forecast contour layer at the selected hour. Repointing the url
  // refetches; the frames are megabytes of geometry, so they never enter the
  // store. A null url means there is nothing to draw and the layer is left
  // alone rather than sent after an empty frame. The guards matter: without
  // them StrictMode's double-invoked effect re-downloads the same frame.
  //
  // The candidate map's liquid layer has no equivalent — it is pinned to the
  // analysis hour, so its constructor url is the only hour it ever needs. The
  // forecast map's own instance is repointed here with the other two.
  const cloudUrl = forecasting ? ForecastCloudsUrl(hour, viewBox) : null;
  const precipUrl = raining ? ForecastPrecipUrl(hour, viewBox) : null;
  // Fetched only while its switch is on, unlike every other layer here. Each
  // hour of this field is its own integration on the server rather than a
  // window off one cached national build, so pre-fetching nineteen of them to
  // have them in hand is not the cheap courtesy it is elsewhere.
  const liquidUrl =
    forecasting && forecastLiquid ? ForecastLiquidUrl(hour, viewBox) : null;

  useEffect(() => {
    if (cloudUrl === null || drawnCloudUrl.current === cloudUrl) return;
    drawnCloudUrl.current = cloudUrl;
    ForecastCloudsLayer.url = cloudUrl;
    ForecastCloudsLayer.refresh();
  }, [cloudUrl]);

  useEffect(() => {
    if (precipUrl === null || drawnPrecipUrl.current === precipUrl) return;
    drawnPrecipUrl.current = precipUrl;
    ForecastPrecipLayer.url = precipUrl;
    ForecastPrecipLayer.refresh();
  }, [precipUrl]);

  useEffect(() => {
    if (liquidUrl === null || drawnLiquidUrl.current === liquidUrl) return;
    drawnLiquidUrl.current = liquidUrl;
    ForecastLiquidLayer.url = liquidUrl;
    ForecastLiquidLayer.refresh();
  }, [liquidUrl]);

  // Live candidate layers are pinned to the analysis hour, but the window
  // they contour follows the view. Repointing the url refetches that window
  // off the same cached national build.
  //
  // Every candidate layer is fetched here, whether or not its switch is on.
  // The panel is a set of switches over one scene, and a layer that starts
  // its download when it is switched on reads as a switch that does not
  // work — the echo-top join is the slowest of them and is the one an
  // operator waits on. Nothing is drawn until its switch says so; this only
  // decides when the bytes arrive.
  //
  // The frames themselves stay out of the store: they are megabytes of
  // geometry and the layer already holds the parsed copy, so the store
  // carries the switches and the layers carry the ground.
  //
  // Statement order is the priority order. The field is the layer the map
  // opens with, so its request goes out first and the rest follow it down
  // the connection; the echo-top join goes last, because it is the one that
  // would make the others wait.
  const boxKey = `${viewBox.west},${viewBox.east},${viewBox.south},${viewBox.north}`;
  useEffect(() => {
    if (drawnBoxKey.current === boxKey) return;
    drawnBoxKey.current = boxKey;
    CandidateFieldLayer.url = CandidateFieldUrl(viewBox);
    CandidateFieldLayer.refresh();
    CandidateRadarLayer.url = RadarReflectivityUrl(viewBox);
    CandidateRadarLayer.refresh();
    CandidateStormCoreLayer.url = RadarStormCoresUrl(viewBox);
    CandidateStormCoreLayer.refresh();
    CandidateStormMotionLayer.url = RadarStormMotionUrl(viewBox);
    CandidateStormMotionLayer.refresh();
    CandidateCloudBaseLayer.url = ForecastCloudBaseUrl(0, viewBox);
    CandidateCloudBaseLayer.refresh();
    CandidateLiquidLayer.url = ForecastLiquidUrl(0, viewBox);
    CandidateLiquidLayer.refresh();
    CandidateLightningLayer.url = LightningUrl(viewBox);
    CandidateLightningLayer.refresh();
    CandidateConfirmedLayer.url = CandidateConfirmedUrl(viewBox);
    CandidateConfirmedLayer.refresh();
    CandidateEchoFreezeLayer.url = RadarEchoFreezeUrl(viewBox);
    CandidateEchoFreezeLayer.refresh();
  }, [boxKey, viewBox]);

  // Send the candidate layers after the build the store says is current.
  //
  // Their urls never change — they are pinned to the analysis hour — so this
  // refetches the same two routes rather than repointing them. The server has
  // rebuilt the join underneath, and the ground these draw is what changed.
  //
  // The first build named is the one they already fetched on load, so it is
  // recorded and nothing is refetched. After that a change means the server
  // answered a click off a newer build than the map is showing, and the map
  // goes and gets it: an outline drawn from a satellite sweep the readout is
  // no longer talking about is how green ground comes to be captioned as
  // frozen. The store carries the whole build, so a rolled radar scan moves
  // these too — the field is drawn from every source, not just the sweep.
  useEffect(() => {
    if (build === null || drawnBuild.current === build) return;
    const first = drawnBuild.current === null;
    drawnBuild.current = build;
    if (first) return;

    CandidateFieldLayer.refresh();
    CandidateConfirmedLayer.refresh();
  }, [build]);

  // Point the replay layers at the hour that is ready to draw.
  //
  // Keyed on `ready` rather than `at` so the fetch happens against a server
  // build that is already warm: ReplayProvider has just awaited the same three
  // builds through their stats routes, so these requests are answered from the
  // server's cache in seconds rather than each paying for its own decode. That
  // is the difference between the three layers landing together and landing a
  // minute apart.
  //
  // They join the map the first time an hour is ready. The page opens with
  // no date chosen, so they are not in the mount effect. The `drawnReplayAt`
  // guard keeps StrictMode's double-invoked effect from refetching the same
  // frames.
  //
  // Every layer is pointed, switched on or not, and in the same priority
  // order as the candidate map: an hour is one scene, and the switches over
  // it should show what is already in hand rather than start a download.
  useEffect(() => {
    const at = ready;
    const key = at === null ? null : `${at}:${boxKey}`;
    if (at === null || drawnReplayAt.current === key) return;
    drawnReplayAt.current = key;

    ReplayFieldLayer.url = ReplayCandidateUrl(at, viewBox);
    ReplayRadarLayer.url = ReplayRadarUrl(at, viewBox);
    ReplayStormCoreLayer.url = ReplayRadarStormCoresUrl(at, viewBox);
    ReplayStormMotionLayer.url = ReplayRadarStormMotionUrl(at, viewBox);
    ReplayCloudBaseLayer.url = ReplayCloudBaseUrl(at, 0, viewBox);
    ReplayLiquidLayer.url = ReplayLiquidUrl(at, 0, viewBox);
    ReplayLightningLayer.url = ReplayLightningUrl(at, viewBox);
    ReplayConfirmedLayer.url = ReplayConfirmedUrl(at, viewBox);
    ReplayEchoFreezeLayer.url = ReplayRadarEchoFreezeUrl(at, viewBox);

    const map = mapRef.current;
    if (map && !map.layers.includes(ReplayCloudBaseLayer)) {
      // Draw order matches the candidate map: cloud base underneath, the
      // modeled liquid over it, the measured radar over both, the storm
      // marks over that.
      map.addMany([
        ReplayCloudBaseLayer,
        ReplayLiquidLayer,
        ReplayRadarLayer,
        ReplayEchoFreezeLayer,
        ReplayLightningLayer,
        ReplayStormMotionLayer,
        ReplayStormCoreLayer,
        ReplayFieldLayer,
        ReplayConfirmedLayer,
      ]);
      return; // A layer added with a url fetches on load; refreshing would double it.
    }
    ReplayFieldLayer.refresh();
    ReplayRadarLayer.refresh();
    ReplayStormCoreLayer.refresh();
    ReplayStormMotionLayer.refresh();
    ReplayCloudBaseLayer.refresh();
    ReplayLiquidLayer.refresh();
    ReplayLightningLayer.refresh();
    ReplayConfirmedLayer.refresh();
    ReplayEchoFreezeLayer.refresh();
  }, [ready, boxKey, viewBox]);

  // Surface "still drawing" so the slider can say so rather than looking stuck.
  useEffect(() => {
    if (mode !== "forecast" || !viewRef.current) return;
    const view = viewRef.current;
    let handle: { remove: () => void } | undefined;

    view
      .whenLayerView(ForecastCloudsLayer)
      .then((layerView) => {
        handle = reactiveUtils.watch(
          () => layerView.updating,
          (updating) => dispatch(forecastActions.setDrawing(updating))
        );
      })
      .catch(() => {
        /* view torn down before the layer view resolved */
      });

    return () => handle?.remove();
  }, [mode, dispatch]);

  // Clicking the observed map picks the point the sounding panel profiles.
  //
  // Candidate map only: the profile is the analysis hour, so offering it on the
  // forecast map would answer a question about now under a slider set to +12 h.
  //
  // A click outside the model's edge does nothing at all — it does not move the
  // point, so the readout for the last cell an operator picked stays where it
  // is. There is no answer to give outside the grid, and the two ways of saying
  // so are both worse than silence: an error reads as a broken server, and a
  // cleared panel reads as an answer of "nothing here". The line on the map is
  // what says where clicking works.
  useEffect(() => {
    if (mode !== "candidate" || !viewRef.current) return;

    const handle = viewRef.current.on("click", (event: ClickEvent) => {
      // A click outside the projection's valid area has no map point at all.
      const { longitude, latitude } = event.mapPoint ?? {};
      if (longitude == null || latitude == null) return;
      // Before the ring lands, let the click through: the server refuses the
      // same points and the panel treats that refusal the same way, so the ring
      // saves a round trip rather than deciding anything the server does not.
      if (ring && !insideRing(ring, longitude, latitude)) return;
      dispatch(
        soundingActions.setPoint([
          // 0.001° is ~100 m, so a click on a 1 km storm stays in that cell.
          // Rounding to 0.01° (1 km) put the click in the next cell.
          Math.round(longitude * 1000) / 1000,
          Math.round(latitude * 1000) / 1000,
        ])
      );
    });

    return () => handle.remove();
  }, [mode, ring, dispatch]);

  // Fly to a selected location
  useEffect(() => {
    if (coordinates && viewRef.current) {
      viewRef.current.goTo({
        center: coordinates,
        zoom: 6,
      });
    }
  }, [coordinates]);

  return (
    <div className="w-full h-full">
      <div className="w-full h-[calc(100vh-6rem)]" ref={mapDiv} />
    </div>
  );
};
