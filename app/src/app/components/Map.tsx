// Hooks
import { useEffect, useRef } from "react";

// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import { GoesLayers } from "@/lib/arcgis/layers";

export const ArcGIS = () => {
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<MapView | null>(null);

  const cloudLayer = useAppSelector((state) => state.interactions.cloudLayer);
  const coordinates = useAppSelector((state) => state.interactions.coordinates);

  // Initialize the map once
  useEffect(() => {
    if (mapDiv.current && !viewRef.current) {
      const map = new Map({
        basemap: "dark-gray-vector",
        layers: Object.values(GoesLayers),
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

  // Show only the selected GOES layer. Both stay on the map, so switching back
  // and forth re-uses tiles the browser already has.
  useEffect(() => {
    for (const [id, layer] of Object.entries(GoesLayers)) {
      layer.visible = id === cloudLayer;
    }
  }, [cloudLayer]);

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
