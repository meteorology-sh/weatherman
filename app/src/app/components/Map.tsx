// Hooks
import { useEffect, useRef } from "react";

// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// Client
import { ForecastCloudsUrl, ForecastPrecipUrl } from "@/lib/client";

// ArcGIS
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import {
  GoesLayers,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
} from "@/lib/arcgis/layers";
import { PRECIP_FIRST_HOUR } from "@/lib/arcgis/renderers";

// Types
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
  const cloudLayer = useAppSelector((state) => state.interactions.cloudLayer);
  const coordinates = useAppSelector((state) => state.interactions.coordinates);
  const hour = useAppSelector((state) => state.forecast.hour);
  const precip = useAppSelector((state) => state.forecast.precip);
  const forecasting = mode === "forecast";
  const raining = forecasting && hour >= PRECIP_FIRST_HOUR;

  // Initialize the map once
  useEffect(() => {
    if (mapDiv.current && !viewRef.current) {
      const map = new Map({
        basemap: "dark-gray-vector",
        // Order is draw order: rain sits over cloud.
        layers: [
          ...Object.values(GoesLayers),
          ForecastCloudsLayer,
          ForecastPrecipLayer,
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
  // GOES imagery. Both stay on the map so switching re-uses what's loaded.
  //
  // The precipitation layer hides before PRECIP_FIRST_HOUR rather than drawing
  // an empty frame: HRRR has no precipitation at the analysis, and a layer
  // that's on but blank reads as "no rain" instead of "not modelled yet".
  useEffect(() => {
    ForecastCloudsLayer.visible = forecasting;
    ForecastPrecipLayer.visible = raining && precip;
    for (const [id, layer] of Object.entries(GoesLayers)) {
      layer.visible = !forecasting && id === cloudLayer;
    }
  }, [forecasting, raining, precip, cloudLayer]);

  // Point each contour layer at the selected hour. Repointing the url
  // refetches; the frames are megabytes of geometry, so they never enter the
  // store. A null url means there is nothing to draw and the layer is left
  // alone rather than sent after an empty frame. The guards matter: without
  // them StrictMode's double-invoked effect re-downloads the same frame.
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

  // Fly to the selected grid point
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
