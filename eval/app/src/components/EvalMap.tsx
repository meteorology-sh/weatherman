// React
import { useEffect, useRef } from "react";

// ArcGIS
import ArcGISMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";

// Layers
import {
  CountyLayer,
  ReleaseLayer,
  WEATHER,
  type LayerKey,
} from "~/lib/layers";

// Client
import { CountiesUrl, ReleasesUrl } from "~/lib/client";

// Types
import type { Release } from "~/lib/types";

type PropsT = {
  date: string | null;
  /** The moment being drawn. Every weather layer is pointed at this. */
  cursor: string | null;
  active: Set<LayerKey>;
  /** Flares to show — the timeline narrows this to a window of the day. */
  window: { from: string; to: string } | null;
  onPick: (release: Release | null) => void;
};

/** West Texas, where the programme flies. */
const HOME = { longitude: -100.9, latitude: 31.5, zoom: 7 };

export const EvalMap = ({ date, cursor, active, window, onPick }: PropsT) => {
  const holder = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  // Build the view once. Layers are added here and never re-added; everything
  // after this is a url or a visibility change.
  useEffect(() => {
    if (!holder.current || view.current) return;

    const map = new ArcGISMap({
      basemap: "dark-gray-vector",
      layers: [
        ...WEATHER.map((entry) => entry.layer),
        CountyLayer,
        ReleaseLayer,
      ],
    });

    const mapView = new MapView({
      container: holder.current,
      map,
      center: [HOME.longitude, HOME.latitude],
      zoom: HOME.zoom,
      constraints: { snapToZoom: false },
    });

    CountyLayer.url = CountiesUrl();

    // A click reports the flare it landed on, or clears the selection. The
    // panel reads the release record rather than the feature, so only the
    // release time is carried out of here.
    mapView.on("click", async (event) => {
      const hit = await mapView.hitTest(event, { include: [ReleaseLayer] });
      const found = hit.results.find(
        (result) =>
          "graphic" in result && result.graphic?.layer === ReleaseLayer
      );
      const at =
        found && "graphic" in found
          ? (found.graphic.attributes?.at as string | undefined)
          : undefined;
      pick.current(at ? ({ at } as Release) : null);
    });

    view.current = mapView;

    return () => {
      mapView.destroy();
      view.current = null;
    };
  }, []);

  // Every weather layer follows the cursor. One effect, so a layer cannot be
  // pointed at one moment while its neighbour shows another.
  useEffect(() => {
    for (const { layer, url } of WEATHER) {
      layer.url = cursor ? url(cursor) : undefined;
    }
  }, [cursor]);

  // The flares, narrowed to whatever slice of the day is being looked at.
  useEffect(() => {
    ReleaseLayer.url = date
      ? ReleasesUrl(date, window?.from, window?.to)
      : undefined;
  }, [date, window?.from, window?.to]);

  // Visibility is derived here and set nowhere else.
  useEffect(() => {
    for (const { key, layer } of WEATHER) {
      layer.visible = Boolean(cursor) && active.has(key);
    }
  }, [active, cursor]);

  return <div ref={holder} className="map-pane" />;
};
