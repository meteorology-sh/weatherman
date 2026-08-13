// Hooks
import { useEffect, useRef } from "react";

// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";
import { soundingActions } from "@/lib/store/features/sounding";

// Client
import { ForecastCloudsUrl, ForecastPrecipUrl } from "@/lib/client";

// ArcGIS
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import {
  CandidateCloudTopLayer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  CandidateLiquidLayer,
  CandidateRadarLayer,
  CandidatePirepLayer,
} from "@/lib/arcgis/layers";
import { PRECIP_FIRST_HOUR, PIREP_IN_BAND } from "@/lib/arcgis/renderers";

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

  const dispatch = useAppDispatch();
  const coordinates = useAppSelector((state) => state.interactions.coordinates);
  const hour = useAppSelector((state) => state.forecast.hour);
  const precip = useAppSelector((state) => state.forecast.precip);
  const cloudTop = useAppSelector((state) => state.cloudtop.visible);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const radar = useAppSelector((state) => state.radar.visible);
  const pireps = useAppSelector((state) => state.pirep.visible);
  const bandOnly = useAppSelector((state) => state.pirep.bandOnly);
  const forecasting = mode === "forecast";
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
        // be the layer you can see. The PIREPs go on top of everything: a dozen
        // markers cannot veil anything, and they are the only thing on the map
        // an aircraft actually measured.
        layers: [
          CandidateCloudTopLayer,
          ForecastCloudsLayer,
          ForecastPrecipLayer,
          CandidateLiquidLayer,
          CandidateRadarLayer,
          CandidatePirepLayer,
        ],
      });

      const view = new MapView({
        container: mapDiv.current,
        map: map,
        center: [-98.58, 39.83],
        zoom: 3,
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

  // Layer visibility is derived from the route's mode plus the store, in one
  // place. The forecast map is modelled contours; the candidate map is observed
  // cloud tops plus the analysis of what is inside the cloud. Both stay on the
  // map so switching re-uses what's loaded.
  //
  // The precipitation layer hides before PRECIP_FIRST_HOUR rather than drawing
  // an empty frame: HRRR has no precipitation at the analysis, and a layer
  // that's on but blank reads as "no rain" instead of "not modelled yet".
  useEffect(() => {
    ForecastCloudsLayer.visible = forecasting;
    ForecastPrecipLayer.visible = raining && precip;
    CandidateCloudTopLayer.visible = !forecasting && cloudTop;
    CandidateLiquidLayer.visible = !forecasting && liquid;
    // Observations, so they never appear on the modelled map — the same rule
    // that keeps the satellite cloud tops off it.
    CandidateRadarLayer.visible = !forecasting && radar;
    CandidatePirepLayer.visible = !forecasting && pireps;
  }, [forecasting, raining, precip, cloudTop, liquid, radar, pireps]);

  // Narrow the reports to the seeding band. A definitionExpression filters the
  // features already fetched rather than repointing the url, so toggling it
  // costs nothing and the layer is pulled once per session.
  useEffect(() => {
    CandidatePirepLayer.definitionExpression = bandOnly ? PIREP_IN_BAND : "";
  }, [bandOnly]);

  // Point each forecast contour layer at the selected hour. Repointing the url
  // refetches; the frames are megabytes of geometry, so they never enter the
  // store. A null url means there is nothing to draw and the layer is left
  // alone rather than sent after an empty frame. The guards matter: without
  // them StrictMode's double-invoked effect re-downloads the same frame.
  //
  // The candidate liquid layer has no equivalent — it is pinned to the analysis
  // hour, so its constructor url is the only one it ever needs.
  const cloudUrl = forecasting ? ForecastCloudsUrl(hour) : null;
  const precipUrl = raining ? ForecastPrecipUrl(hour) : null;

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
  // The handler is attached once and reads `mode` through a ref-free closure —
  // it is registered inside the mount effect's own scope, so re-registering on
  // every render would leak handles.
  useEffect(() => {
    if (mode !== "candidate" || !viewRef.current) return;

    const handle = viewRef.current.on("click", (event: ClickEvent) => {
      // A click outside the projection's valid area has no map point at all.
      const { longitude, latitude } = event.mapPoint ?? {};
      if (longitude == null || latitude == null) return;
      dispatch(
        soundingActions.setPoint([
          Math.round(longitude * 100) / 100,
          Math.round(latitude * 100) / 100,
        ])
      );
    });

    return () => handle.remove();
  }, [mode, dispatch]);

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
