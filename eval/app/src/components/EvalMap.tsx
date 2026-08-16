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
import { ReleasesUrl } from "~/lib/client";

// Types
import type { Release } from "~/lib/types";

type PropsT = {
  date: string | null;
  /** The moment being drawn. Every weather layer is pointed at this. */
  cursor: string | null;
  active: Set<LayerKey>;
  /** Flares to show — narrowed to a window of the day, or the whole of it. */
  shown: { from: string; to: string } | null;
  onPick: (release: Release | null) => void;
};

/** West Texas, where the programme flies. */
const HOME = { longitude: -100.9, latitude: 31.5, zoom: 7 };

export const EvalMap = ({ date, cursor, active, shown, onPick }: PropsT) => {
  const holder = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  /**
   * What each layer is currently pointed at.
   *
   * A url is only assigned when it changes, because assigning one is a refetch.
   * Every distinct moment is a cold join off the archive, so a redundant
   * assignment is not a wasted render — it is a minute of downloads.
   */
  const drawn = useRef(new Map<string, string>());

  /**
   * Build the view once and never tear it down.
   *
   * **No cleanup, and that is deliberate.** `MapView.destroy()` destroys the
   * map and its layers with it, and these layers are module-scope singletons
   * shared with the app. StrictMode mounts, cleans up and mounts again, so a
   * cleanup here would destroy the singletons on the first pass and hand the
   * second pass dead objects — a map that never draws anything and toggles
   * with nothing to toggle. The app's own `Map.tsx` does not destroy either.
   */
  useEffect(() => {
    if (!holder.current || view.current) return;

    const map = new ArcGISMap({
      basemap: "dark-gray-vector",
      // Order is draw order, and it is the app's: the satellite's cloud top
      // under the model's base and liquid, the measured radar over those, the
      // join on top. The flares sit above everything, because the question is
      // what was under them.
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
    });
    mapView.attributionVisible = false;

    // A click reports the flare it landed on, or clears the selection. Only the
    // release time is carried out; the panel reads the record for the rest.
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
  }, []);

  // Every weather layer follows the cursor, in one effect, so a layer cannot be
  // pointed at one moment while its neighbour still shows another.
  useEffect(() => {
    if (!cursor) return;

    for (const { key, layer, url } of WEATHER) {
      const next = url(cursor);
      if (drawn.current.get(key) === next) continue;
      drawn.current.set(key, next);
      layer.url = next;
      layer.refresh();
    }
  }, [cursor]);

  // The flares, over whatever slice of the day is being looked at.
  useEffect(() => {
    if (!date) return;

    const next = ReleasesUrl(date, shown?.from, shown?.to);
    if (drawn.current.get("releases") === next) return;
    drawn.current.set("releases", next);
    ReleaseLayer.url = next;
    ReleaseLayer.refresh();
  }, [date, shown?.from, shown?.to]);

  // Visibility is derived here and set nowhere else. A layer with no url yet is
  // kept off: an empty frame reads as "nothing there" rather than "not asked".
  useEffect(() => {
    for (const { key, layer } of WEATHER) {
      layer.visible = Boolean(cursor) && active.has(key);
    }
    ReleaseLayer.visible = Boolean(date);
  }, [active, cursor, date]);

  return <div ref={holder} className="map-pane" />;
};
