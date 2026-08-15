// Testing
import type { Mock } from "vitest";

/**
 * The fake ArcGIS the map tests drive.
 *
 * The imperative API needs a real WebGL context, so the classes `Map.tsx`
 * drives are faked here, and each fake records what the component did to it.
 * The layers are faked too — `layers.test.ts` covers how the real ones are
 * built.
 *
 * This is a module rather than a block in one test file because two files
 * drive the same map: the live layers and the replayed ones are separate
 * instances by design, and a second copy of these fakes would let the two
 * files disagree about what the map is. Each Vitest file gets its own module
 * graph, so they still cannot leak state into each other.
 */

export type FakeMapT = {
  basemap?: string;
  layers?: unknown[];
  addMany?: (l: unknown[]) => void;
};

export type FakeViewT = {
  center?: [number, number];
  zoom?: number;
  goTo: Mock;
  whenLayerView: Mock;
  on: Mock;
  /** Handlers the component registered, by event name. */
  handlers: Record<string, (event: unknown) => void>;
  removed: number;
};

/** Every Map and MapView the component built, newest last. */
export const arcgis = {
  maps: [] as FakeMapT[],
  views: [] as FakeViewT[],
};

const layer = (id: string) => ({
  id,
  visible: false,
  url: "",
  refresh: vi.fn(),
});

export const cloudBaseLayer = layer("cloudbase-layer");
export const cloudTopLayer = layer("cloudtop-layer");
export const forecastLayer = layer("forecast-layer");
export const precipLayer = layer("precip-layer");
export const liquidLayer = layer("liquid-layer");
export const radarLayer = layer("radar-layer");
export const fieldLayer = layer("candidate-field-layer");
export const confirmedLayer = layer("candidate-confirmed-layer");

// The replay map's own instances. Separate objects here for the same reason
// they are separate in lib/arcgis/layers.ts: pointing the candidate layers at
// a date would leave that date on the live map.
export const replayCloudBaseLayer = layer("replay-cloud-base-layer");
export const replayCloudTopLayer = layer("replay-cloud-top-layer");
export const replayLiquidLayer = layer("replay-liquid-layer");
export const replayRadarLayer = layer("replay-radar-layer");
export const replayFieldLayer = layer("replay-field-layer");
export const replayConfirmedLayer = layer("replay-confirmed-layer");

/** The mocked module: every layer `Map.tsx` imports, under its real name. */
export const layers = {
  CandidateCloudBaseLayer: cloudBaseLayer,
  CandidateCloudTopLayer: cloudTopLayer,
  ForecastCloudsLayer: forecastLayer,
  ForecastPrecipLayer: precipLayer,
  CandidateLiquidLayer: liquidLayer,
  CandidateRadarLayer: radarLayer,
  CandidateFieldLayer: fieldLayer,
  CandidateConfirmedLayer: confirmedLayer,
  ReplayCloudBaseLayer: replayCloudBaseLayer,
  ReplayCloudTopLayer: replayCloudTopLayer,
  ReplayLiquidLayer: replayLiquidLayer,
  ReplayRadarLayer: replayRadarLayer,
  ReplayFieldLayer: replayFieldLayer,
  ReplayConfirmedLayer: replayConfirmedLayer,
};

export const watch = vi.fn(() => ({ remove: vi.fn() }));

export class FakeMap {
  layers: unknown[] = [];
  // The replay layers are added once a date is picked, not at construction:
  // they are built without a url, and a GeoJSONLayer with nowhere to fetch
  // from fails to load.
  addMany(added: unknown[]) {
    this.layers.push(...added);
  }
  constructor(props: Record<string, unknown>) {
    Object.assign(this, props);
    arcgis.maps.push(this as unknown as FakeMapT);
  }
}

export class FakeMapView {
  goTo = vi.fn();
  whenLayerView = vi.fn(() => Promise.resolve({ updating: false }));
  handlers: Record<string, (event: unknown) => void> = {};
  removed = 0;
  on = vi.fn((name: string, handler: (event: unknown) => void) => {
    this.handlers[name] = handler;
    return {
      remove: () => {
        this.removed++;
        delete this.handlers[name];
      },
    };
  });
  constructor(props: Record<string, unknown>) {
    Object.assign(this, props);
    arcgis.views.push(this as unknown as FakeViewT);
  }
}

export class FakeExtent {
  constructor(props: Record<string, unknown>) {
    Object.assign(this, props);
  }
}

export const map = () => arcgis.maps[arcgis.maps.length - 1];
export const view = () => arcgis.views[arcgis.views.length - 1];

/** Every fake back to its arrival state, so no test inherits another's map. */
export function resetArcgis() {
  arcgis.maps.length = 0;
  arcgis.views.length = 0;
  for (const drawn of Object.values(layers)) {
    drawn.visible = false;
    drawn.url = "";
    drawn.refresh.mockClear();
  }
  watch.mockClear();
}
