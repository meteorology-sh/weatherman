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
  ForecastCloudBaseUrl,
  ForecastCloudBaseWindowUrl,
  CloudTopUrl,
  RadarReflectivityUrl,
  RadarStormCoresUrl,
  RadarStormFlanksUrl,
  RadarStormMotionUrl,
  RadarEchoFreezeUrl,
  LightningUrl,
  CandidateFieldUrl,
  CandidateConfirmedUrl,
  ReplayCandidateUrl,
  ReplayConfirmedUrl,
  ReplayCloudBaseUrl,
  ReplayCloudBaseWindowUrl,
  ReplayCloudTopUrl,
  ReplayRadarUrl,
  ReplayRadarStormCoresUrl,
  ReplayRadarStormFlanksUrl,
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
  CandidateCloudBaseWindowLayer,
  CandidateCloudTopLayer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  CandidateRadarLayer,
  CandidateEchoFreezeLayer,
  CandidateStormCoreLayer,
  CandidateStormFlankLayer,
  CandidateStormMotionLayer,
  CandidateLightningLayer,
  CandidateConfirmedLayer,
  CandidateFieldLayer,
  ReplayCloudBaseLayer,
  ReplayCloudBaseWindowLayer,
  ReplayCloudTopLayer,
  ReplayConfirmedLayer,
  ReplayFieldLayer,
  ReplayRadarLayer,
  ReplayEchoFreezeLayer,
  ReplayStormCoreLayer,
  ReplayStormFlankLayer,
  ReplayStormMotionLayer,
  ReplayLightningLayer,
} from "@/lib/arcgis/layers";
import { PRECIP_FIRST_HOUR } from "@/lib/arcgis/bands";
import { INITIAL_BOX, heldBox } from "@/lib/bbox";

// Types
import type { ClickEvent } from "@arcgis/core/views/input/types";
import type { MapMode } from "@/lib/types";

type PropsT = {
  /** Which map this route is: modelled forecast, or observed candidate. */
  mode: MapMode;
};

export const ArcGIS = ({ mode }: PropsT) => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const drawnCloudUrl = useRef<string | null>(null);
  const drawnPrecipUrl = useRef<string | null>(null);
  const drawnReplayAt = useRef<string | null>(null);
  const drawnBuild = useRef<string | null>(null);
  const drawnBoxKey = useRef<string | null>(null);
  const [viewBox, setViewBox] = useState(INITIAL_BOX);

  const dispatch = useAppDispatch();
  const coordinates = useAppSelector((state) => state.interactions.coordinates);
  const hour = useAppSelector((state) => state.forecast.hour);
  const precip = useAppSelector((state) => state.forecast.precip);
  const cloudBase = useAppSelector((state) => state.cloudbase.visible);
  const baseWindow = useAppSelector((state) => state.cloudbase.window);
  const cloudTop = useAppSelector((state) => state.cloudtop.visible);
  const radar = useAppSelector((state) => state.radar.visible);
  const lightning = useAppSelector((state) => state.radar.lightning);
  const heading = useAppSelector((state) => state.radar.heading);
  const echoFreeze = useAppSelector((state) => state.radar.echoFreeze);
  const field = useAppSelector((state) => state.seedability.visible);
  const build = useAppSelector((state) => state.seedability.drawn);
  const ring = useAppSelector((state) => state.domain.ring);
  const ready = useAppSelector((state) => state.replay.ready);
  const replayCloudBase = useAppSelector((state) => state.replay.cloudBase);
  const replayBaseWindow = useAppSelector((state) => state.replay.baseWindow);
  const replayCloudTop = useAppSelector((state) => state.replay.cloudTop);
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
        // Order is draw order. On the forecast map rain sits over cloud; on the
        // candidate map the modelled liquid water sits over the observed cloud
        // tops, because it is the more specific signal and covers far less
        // ground, and the observed radar sits over that — a candidate is only
        // disqualified by rain where the two overlap, so the disqualifier has to
        // be the layer you can see.
        //
        // Cloud base is at the bottom: it covers more ground than any of them
        // and it is the question you ask *before* the others — can I get into
        // this cloud at all — so it belongs under the answers. The Comptroller
        // window is the same field as a gate, drawn over the rain so the
        // switch is visible on the storm.
        layers: [
          CandidateCloudBaseLayer,
          CandidateCloudTopLayer,
          ForecastCloudsLayer,
          ForecastPrecipLayer,
          CandidateRadarLayer,
          CandidateCloudBaseWindowLayer,
          CandidateEchoFreezeLayer,
          CandidateLightningLayer,
          CandidateStormFlankLayer,
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
        | { xmin: number; ymin: number; xmax: number; ymax: number }
        | undefined;
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
  // place. The forecast map is modelled contours; the candidate map is observed
  // cloud tops plus the analysis of what is inside the cloud. Both stay on the
  // map so switching re-uses what's loaded.
  //
  // The precipitation layer hides before PRECIP_FIRST_HOUR rather than drawing
  // an empty frame: HRRR has no precipitation at the analysis, and a layer
  // that's on but blank reads as "no rain" instead of "not modelled yet".
  // The candidate layers are pinned to "now", so they stay off while replaying
  // — showing today's scene under a 2025 date is the one thing this page must
  // never do, and it would look like a slow load rather than a wrong answer.
  const candidating = mode === "candidate";

  useEffect(() => {
    ForecastCloudsLayer.visible = forecasting;
    ForecastPrecipLayer.visible = raining && precip;
    CandidateCloudBaseLayer.visible =
      candidating && cloudBase && !baseWindow;
    CandidateCloudBaseWindowLayer.visible =
      candidating && cloudBase && baseWindow;
    CandidateCloudTopLayer.visible = candidating && cloudTop;
    // Observations, so they never appear on the modelled map — the same rule
    // that keeps the satellite cloud tops off it.
    CandidateRadarLayer.visible = candidating && radar;
    CandidateEchoFreezeLayer.visible = candidating && radar && echoFreeze;
    CandidateLightningLayer.visible = candidating && radar && lightning;
    CandidateStormFlankLayer.visible = candidating && radar && heading;
    CandidateStormMotionLayer.visible = candidating && radar && heading;
    CandidateStormCoreLayer.visible = candidating && radar && heading;
    // The Texas fly fill — where to click. The quiet-liquid outline is
    // not this layer.
    CandidateFieldLayer.visible = candidating && field;
    CandidateConfirmedLayer.visible = false;
    // Gated on `ready`, not on the hour that was asked for. `setAt` clears
    // `ready`, so picking a date blanks the map immediately and it stays blank
    // until every source has answered — they take 10 s to 40 s and finish
    // apart, and revealing each as it landed showed two dates at once.
    const drawable = replaying && ready !== null;
    ReplayCloudBaseLayer.visible =
      drawable && replayCloudBase && !replayBaseWindow;
    ReplayCloudBaseWindowLayer.visible =
      drawable && replayCloudBase && replayBaseWindow;
    ReplayCloudTopLayer.visible = drawable && replayCloudTop;
    ReplayRadarLayer.visible = drawable && replayRadar;
    ReplayEchoFreezeLayer.visible = drawable && replayRadar && replayEchoFreeze;
    ReplayLightningLayer.visible = drawable && replayRadar && replayLightning;
    ReplayStormFlankLayer.visible = drawable && replayRadar && replayHeading;
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
    cloudBase,
    baseWindow,
    cloudTop,
    radar,
    lightning,
    heading,
    echoFreeze,
    field,
    ready,
    replayCloudBase,
    replayBaseWindow,
    replayCloudTop,
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
  // The candidate liquid layer has no equivalent — it is pinned to the analysis
  // hour, so its constructor url is the only one it ever needs.
  const cloudUrl = forecasting ? ForecastCloudsUrl(hour, viewBox) : null;
  const precipUrl = raining ? ForecastPrecipUrl(hour, viewBox) : null;

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

  // Live candidate layers are pinned to the analysis hour, but the window
  // they contour follows the view. Repointing the url refetches that window
  // off the same cached national build.
  const boxKey = `${viewBox.west},${viewBox.east},${viewBox.south},${viewBox.north}`;
  useEffect(() => {
    if (drawnBoxKey.current === boxKey) return;
    drawnBoxKey.current = boxKey;
    CandidateCloudBaseLayer.url = ForecastCloudBaseUrl(0, viewBox);
    CandidateCloudBaseWindowLayer.url = ForecastCloudBaseWindowUrl(0, viewBox);
    CandidateCloudTopLayer.url = CloudTopUrl(viewBox);
    CandidateRadarLayer.url = RadarReflectivityUrl(viewBox);
    CandidateFieldLayer.url = CandidateFieldUrl(viewBox);
    CandidateConfirmedLayer.url = CandidateConfirmedUrl(viewBox);
    CandidateCloudBaseLayer.refresh();
    CandidateCloudBaseWindowLayer.refresh();
    CandidateCloudTopLayer.refresh();
    CandidateRadarLayer.refresh();
    CandidateFieldLayer.refresh();
    CandidateConfirmedLayer.refresh();
  }, [boxKey, viewBox]);

  // Lightning is a switch, not a zoom. The url is pointed only while the
  // operator has asked for it, so a national pan does not download GLM.
  const drawnLightningKey = useRef<string | null>(null);
  useEffect(() => {
    if (!(candidating && radar && lightning)) return;
    if (drawnLightningKey.current === boxKey) return;
    drawnLightningKey.current = boxKey;
    CandidateLightningLayer.url = LightningUrl(viewBox);
    CandidateLightningLayer.refresh();
  }, [candidating, radar, lightning, boxKey, viewBox]);

  // Echo past freezing is a switch, not a zoom. The url is pointed only
  // while the operator has asked for it, so a national pan does not
  // download the join.
  const drawnEchoFreezeKey = useRef<string | null>(null);
  useEffect(() => {
    if (!(candidating && radar && echoFreeze)) return;
    if (drawnEchoFreezeKey.current === boxKey) return;
    drawnEchoFreezeKey.current = boxKey;
    CandidateEchoFreezeLayer.url = RadarEchoFreezeUrl(viewBox);
    CandidateEchoFreezeLayer.refresh();
  }, [candidating, radar, echoFreeze, boxKey, viewBox]);

  // Cores, heading ticks, and the upwind flank are the same switch. They
  // fetch with the mosaic, because that switch starts on.
  const drawnHeadingKey = useRef<string | null>(null);
  useEffect(() => {
    if (!(candidating && radar && heading)) return;
    if (drawnHeadingKey.current === boxKey) return;
    drawnHeadingKey.current = boxKey;
    CandidateStormFlankLayer.url = RadarStormFlanksUrl(viewBox);
    CandidateStormMotionLayer.url = RadarStormMotionUrl(viewBox);
    CandidateStormCoreLayer.url = RadarStormCoresUrl(viewBox);
    CandidateStormFlankLayer.refresh();
    CandidateStormMotionLayer.refresh();
    CandidateStormCoreLayer.refresh();
  }, [candidating, radar, heading, boxKey, viewBox]);

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
  useEffect(() => {
    const at = ready;
    const key = at === null ? null : `${at}:${boxKey}`;
    if (at === null || drawnReplayAt.current === key) return;
    drawnReplayAt.current = key;

    ReplayCloudBaseLayer.url = ReplayCloudBaseUrl(at, 0, viewBox);
    ReplayCloudBaseWindowLayer.url = ReplayCloudBaseWindowUrl(at, 0, viewBox);
    ReplayCloudTopLayer.url = ReplayCloudTopUrl(at, viewBox);
    ReplayRadarLayer.url = ReplayRadarUrl(at, viewBox);
    ReplayFieldLayer.url = ReplayCandidateUrl(at, viewBox);
    ReplayConfirmedLayer.url = ReplayConfirmedUrl(at, viewBox);

    const map = mapRef.current;
    if (map && !map.layers.includes(ReplayCloudTopLayer)) {
      // Draw order matches the candidate map: cloud base underneath,
      // modelled liquid over observed tops, measured radar over both,
      // the Comptroller window over the rain so the gate is visible
      // on the storm.
      map.addMany([
        ReplayCloudBaseLayer,
        ReplayCloudTopLayer,
        ReplayRadarLayer,
        ReplayCloudBaseWindowLayer,
        ReplayEchoFreezeLayer,
        ReplayLightningLayer,
        ReplayStormFlankLayer,
        ReplayStormMotionLayer,
        ReplayStormCoreLayer,
        ReplayFieldLayer,
        ReplayConfirmedLayer,
      ]);
      return; // A layer added with a url fetches on load; refreshing would double it.
    }
    ReplayCloudBaseLayer.refresh();
    ReplayCloudBaseWindowLayer.refresh();
    ReplayCloudTopLayer.refresh();
    ReplayRadarLayer.refresh();
    ReplayFieldLayer.refresh();
    ReplayConfirmedLayer.refresh();
  }, [ready, boxKey, viewBox]);

  useEffect(() => {
    if (!(replaying && ready && replayRadar && replayLightning)) return;
    ReplayLightningLayer.url = ReplayLightningUrl(ready, viewBox);
    ReplayLightningLayer.refresh();
  }, [replaying, ready, replayRadar, replayLightning, boxKey, viewBox]);

  useEffect(() => {
    if (!(replaying && ready && replayRadar && replayEchoFreeze)) return;
    ReplayEchoFreezeLayer.url = ReplayRadarEchoFreezeUrl(ready, viewBox);
    ReplayEchoFreezeLayer.refresh();
  }, [replaying, ready, replayRadar, replayEchoFreeze, boxKey, viewBox]);

  useEffect(() => {
    if (!(replaying && ready && replayRadar && replayHeading)) return;
    ReplayStormFlankLayer.url = ReplayRadarStormFlanksUrl(ready, viewBox);
    ReplayStormMotionLayer.url = ReplayRadarStormMotionUrl(ready, viewBox);
    ReplayStormCoreLayer.url = ReplayRadarStormCoresUrl(ready, viewBox);
    ReplayStormFlankLayer.refresh();
    ReplayStormMotionLayer.refresh();
    ReplayStormCoreLayer.refresh();
  }, [replaying, ready, replayRadar, replayHeading, boxKey, viewBox]);

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
