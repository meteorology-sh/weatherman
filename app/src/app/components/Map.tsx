// Hooks
import { useEffect, useRef } from "react";

// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// Client
import { ForecastCloudsUrl } from "@/lib/client";

// ArcGIS
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import { GoesLayers, ForecastCloudsLayer } from "@/lib/arcgis/layers";

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
  const drawnUrl = useRef<string | null>(null);

  const dispatch = useAppDispatch();
  const cloudLayer = useAppSelector((state) => state.interactions.cloudLayer);
  const coordinates = useAppSelector((state) => state.interactions.coordinates);
  const hour = useAppSelector((state) => state.forecast.hour);

  // Initialize the map once
  useEffect(() => {
    if (mapDiv.current && !viewRef.current) {
      const map = new Map({
        basemap: "dark-gray-vector",
        layers: [...Object.values(GoesLayers), ForecastCloudsLayer],
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
  useEffect(() => {
    const forecasting = mode === "forecast";
    ForecastCloudsLayer.visible = forecasting;
    for (const [id, layer] of Object.entries(GoesLayers)) {
      layer.visible = !forecasting && id === cloudLayer;
    }
  }, [mode, cloudLayer]);

  // Move the forecast layer to the selected hour. Repointing the url refetches;
  // the frames are megabytes of geometry, so they never enter the store. The
  // guard matters: without it StrictMode's double-invoked effect re-downloads
  // the same frame.
  useEffect(() => {
    if (mode !== "forecast") return;
    const url = ForecastCloudsUrl(hour);
    if (drawnUrl.current === url) return;
    drawnUrl.current = url;
    ForecastCloudsLayer.url = url;
    ForecastCloudsLayer.refresh();
  }, [mode, hour]);

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
