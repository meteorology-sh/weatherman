// Testing
import type { Mock } from "vitest";
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { interactionsActions } from "@/lib/store/features/interactions";
import { forecastActions } from "@/lib/store/features/forecast";
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudTopActions } from "@/lib/store/features/cloudtop";
import { radarActions } from "@/lib/store/features/radar";
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { ArcGIS } from "@/app/components/Map";

type FakeMapT = { basemap?: string; layers?: unknown[] };
type FakeViewT = {
  center?: [number, number];
  zoom?: number;
  goTo: Mock;
  whenLayerView: Mock;
  on: Mock;
  /** Handlers the component registered, by event name. */
  handlers: Record<string, (event: unknown) => void>;
  removed: number;
};

// The imperative ArcGIS API needs a real WebGL context, so the classes this
// component drives are faked. Each fake records its instances, and the tests
// assert on the calls the component makes to them. The layers are faked too —
// layers.test.ts covers how the real ones are built.
const {
  arcgis,
  cloudTopLayer,
  forecastLayer,
  precipLayer,
  liquidLayer,
  radarLayer,
  watch,
} = vi.hoisted(() => ({
  arcgis: {
    maps: [] as FakeMapT[],
    views: [] as FakeViewT[],
  },
  cloudTopLayer: { id: "cloudtop-layer", visible: false },
  forecastLayer: {
    id: "forecast-layer",
    visible: false,
    url: "",
    refresh: vi.fn(),
  },
  precipLayer: {
    id: "precip-layer",
    visible: false,
    url: "",
    refresh: vi.fn(),
  },
  liquidLayer: {
    id: "liquid-layer",
    visible: false,
    url: "",
    refresh: vi.fn(),
  },
  radarLayer: {
    id: "radar-layer",
    visible: false,
    url: "",
    refresh: vi.fn(),
  },
  watch: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("@/lib/arcgis/layers", () => ({
  CandidateCloudTopLayer: cloudTopLayer,
  ForecastCloudsLayer: forecastLayer,
  ForecastPrecipLayer: precipLayer,
  CandidateLiquidLayer: liquidLayer,
  CandidateRadarLayer: radarLayer,
}));
vi.mock("@arcgis/core/core/reactiveUtils", () => ({ watch }));
vi.mock("@arcgis/core/Map", () => ({
  default: class FakeMap {
    constructor(props: Record<string, unknown>) {
      Object.assign(this, props);
      arcgis.maps.push(this as unknown as FakeMapT);
    }
  },
}));
vi.mock("@arcgis/core/views/MapView", () => ({
  default: class FakeMapView {
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
  },
}));
vi.mock("@arcgis/core/geometry/Extent", () => ({
  default: class FakeExtent {
    constructor(props: Record<string, unknown>) {
      Object.assign(this, props);
    }
  },
}));

const map = () => arcgis.maps[arcgis.maps.length - 1];
const view = () => arcgis.views[arcgis.views.length - 1];

beforeEach(() => {
  arcgis.maps.length = 0;
  arcgis.views.length = 0;
  cloudTopLayer.visible = false;
  liquidLayer.visible = false;
  liquidLayer.refresh.mockClear();
  forecastLayer.visible = false;
  forecastLayer.url = "";
  forecastLayer.refresh.mockClear();
  precipLayer.visible = false;
  precipLayer.url = "";
  precipLayer.refresh.mockClear();
});

describe("ArcGIS", () => {
  it("centers a dark national map on the continental U.S.", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(map().basemap).toBe("dark-gray-vector");
    expect(view().center).toEqual([-98.58, 39.83]);
    expect(view().zoom).toBe(3);
  });

  it("builds the view only once across rerenders", () => {
    const { rerender } = renderWithStore(
      <ArcGIS mode="candidate" />,
      createTestStore()
    );

    rerender(<ArcGIS mode="candidate" />);

    expect(arcgis.views).toHaveLength(1);
  });

  it("puts every layer on the map so switching re-uses what is loaded", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(map().layers).toEqual([
      cloudTopLayer,
      forecastLayer,
      precipLayer,
      liquidLayer,
      radarLayer,
    ]);
  });

  // Draw order is array order, and rain has to sit over the cloud it falls from.
  it("draws precipitation above the cloud it falls from", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(precipLayer)).toBeGreaterThan(
      layers.indexOf(forecastLayer)
    );
  });

  it("flies to a selected location", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(interactionsActions.setCoordinates([-100, 40]));
    });

    expect(view().goTo).toHaveBeenCalledWith({ center: [-100, 40], zoom: 6 });
  });

  it("does not fly anywhere until a point is selected", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(view().goTo).not.toHaveBeenCalled();
  });
});

describe("ArcGIS in candidate mode", () => {
  it("shows the observed cloud tops and the modelled liquid water together", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(cloudTopLayer.visible).toBe(true);
    expect(liquidLayer.visible).toBe(true);
  });

  // The satellite shows the cloud top; the contours show what is inside it. The
  // liquid has to sit above or it is buried by the cloud it explains.
  it("draws the liquid water above the cloud tops it explains", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(liquidLayer)).toBeGreaterThan(
      layers.indexOf(cloudTopLayer)
    );
  });

  it("hides the cloud tops when the operator turns them off", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(cloudTopActions.setVisible(false));
    });

    expect(cloudTopLayer.visible).toBe(false);
    expect(liquidLayer.visible).toBe(true);
  });

  it("hides the liquid water when the operator turns it off", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(liquidLayer.visible).toBe(false);
    expect(cloudTopLayer.visible).toBe(true);
  });

  it("hides the modelled forecast contours", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(forecastLayer.visible).toBe(false);
    expect(precipLayer.visible).toBe(false);
  });
});

describe("ArcGIS radar", () => {
  it("draws the mosaic on the observed map", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(radarLayer.visible).toBe(true);
  });

  // An observation, so the same rule that keeps the satellite off the modelled
  // map keeps this off it — the forecast map has HRRR's own precipitation.
  it("keeps it off the modelled map", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(radarLayer.visible).toBe(false);
  });

  // The disqualifier has to be the layer you can see: a candidate is ruled out
  // exactly where cyan covers amber.
  it("draws it above the liquid water it disqualifies", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(radarLayer)).toBeGreaterThan(
      layers.indexOf(liquidLayer)
    );
  });

  it("hides it when the operator turns it off", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(radarLayer.visible).toBe(false);
  });
});

describe("ArcGIS in forecast mode", () => {
  it("shows the modelled contours", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.visible).toBe(true);
  });

  it("hides the observed cloud tops, which cannot forecast", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(cloudTopLayer.visible).toBe(false);
  });

  // The liquid layer is pinned to the analysis, so it would contradict the
  // slider the moment the operator moved it.
  it("hides the analysis-hour liquid water on the forecast map", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(liquidLayer.visible).toBe(false);
  });

  it("starts on the analysis hour", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.url).toBe("/forecast/clouds?hour=0");
  });

  it("repoints the layer when the forecast hour changes", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(12));
    });

    expect(forecastLayer.url).toBe("/forecast/clouds?hour=12");
  });

  it("refreshes the layer so the new frame is drawn", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    forecastLayer.refresh.mockClear();
    act(() => {
      store.dispatch(forecastActions.setHour(3));
    });

    expect(forecastLayer.refresh).toHaveBeenCalled();
  });

  it("does not repoint the forecast layer while on the candidate map", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(9));
    });

    expect(forecastLayer.url).toBe("");
    expect(precipLayer.url).toBe("");
  });
});

describe("ArcGIS precipitation", () => {
  const atHour = (hour: number) => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(hour));
    });
    return store;
  };

  it("draws precipitation once the model has some", () => {
    atHour(6);

    expect(precipLayer.visible).toBe(true);
    expect(precipLayer.url).toBe("/forecast/precip?hour=6");
  });

  // HRRR diagnoses PRATE by stepping forward, so f00 is zero everywhere. A
  // layer that is on but empty reads as "no rain" rather than "not modelled",
  // so it stays hidden instead.
  it("hides precipitation at the analysis hour rather than drawing nothing", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(precipLayer.visible).toBe(false);
  });

  it("never asks the server for the analysis frame it knows is empty", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(precipLayer.url).toBe("");
  });

  it("comes back when the slider leaves the analysis hour", () => {
    const store = atHour(1);

    expect(precipLayer.visible).toBe(true);
    act(() => {
      store.dispatch(forecastActions.setHour(0));
    });

    expect(precipLayer.visible).toBe(false);
  });

  it("still draws the cloud contours at the analysis hour", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.visible).toBe(true);
    expect(forecastLayer.url).toBe("/forecast/clouds?hour=0");
  });

  it("hides precipitation when the operator turns it off", () => {
    const store = atHour(6);

    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });

    expect(precipLayer.visible).toBe(false);
    expect(forecastLayer.visible).toBe(true);
  });

  it("keeps the frame it already fetched when toggled off and on", () => {
    const store = atHour(6);

    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });
    precipLayer.refresh.mockClear();
    act(() => {
      store.dispatch(forecastActions.setPrecip(true));
    });

    expect(precipLayer.visible).toBe(true);
    expect(precipLayer.refresh).not.toHaveBeenCalled();
  });
});

/** A map click, shaped the way ArcGIS hands one back. */
const clickAt = (longitude: number, latitude: number) =>
  view().handlers.click?.({ mapPoint: { longitude, latitude } });

describe("ArcGIS sounding point", () => {
  it("profiles the point that was clicked", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      clickAt(-104.9903, 39.7392);
    });

    expect(store.getState().sounding.point).toEqual([-104.99, 39.74]);
  });

  // The profile is the analysis hour, so offering it under a slider set to
  // +12 h would answer a question about now while the map shows later.
  it("does not listen on the modelled map", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(view().handlers.click).toBeUndefined();
  });

  // ArcGIS hands back no map point for a click outside the projection.
  it("ignores a click with no map point", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      view().handlers.click?.({ mapPoint: null });
    });

    expect(store.getState().sounding.point).toEqual([-98.58, 39.83]);
  });

  it("releases the handler when the map goes away", () => {
    const { unmount } = renderWithStore(
      <ArcGIS mode="candidate" />,
      createTestStore()
    );
    const fake = view();

    unmount();

    expect(fake.removed).toBe(1);
  });

  // Clicking picks a point to profile; it must not also fly the map somewhere.
  it("does not fly the map to the clicked point", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      clickAt(-104.99, 39.74);
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    expect(view().goTo).not.toHaveBeenCalled();
  });
});
