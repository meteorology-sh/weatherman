// Testing
import type { Mock } from "vitest";
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { interactionsActions } from "@/lib/store/features/interactions";
import { forecastActions } from "@/lib/store/features/forecast";

// Components
import { ArcGIS } from "@/app/components/Map";

type FakeMapT = { basemap?: string; layers?: unknown[] };
type FakeViewT = {
  center?: [number, number];
  zoom?: number;
  goTo: Mock;
  whenLayerView: Mock;
};

// The imperative ArcGIS API needs a real WebGL context, so the classes this
// component drives are faked. Each fake records its instances, and the tests
// assert on the calls the component makes to them. The layers are faked too —
// layers.test.ts covers how the real ones are built.
const { arcgis, goes, forecastLayer, watch } = vi.hoisted(() => ({
  arcgis: {
    maps: [] as FakeMapT[],
    views: [] as FakeViewT[],
  },
  goes: {
    geocolor: { id: "geocolor-layer", visible: false },
    band13: { id: "band13-layer", visible: false },
  },
  forecastLayer: { id: "forecast-layer", visible: false, url: "", refresh: vi.fn() },
  watch: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("@/lib/arcgis/layers", () => ({
  GoesLayers: goes,
  ForecastCloudsLayer: forecastLayer,
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
  goes.geocolor.visible = false;
  goes.band13.visible = false;
  forecastLayer.visible = false;
  forecastLayer.url = "";
  forecastLayer.refresh.mockClear();
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

    expect(map().layers).toEqual([goes.geocolor, goes.band13, forecastLayer]);
  });

  it("flies to the selected grid point", () => {
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
  it("shows only the GeoColor layer by default", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(goes.geocolor.visible).toBe(true);
    expect(goes.band13.visible).toBe(false);
  });

  it("shows only the Band13 layer once it is selected", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("band13"));
    });

    expect(goes.band13.visible).toBe(true);
    expect(goes.geocolor.visible).toBe(false);
  });

  it("switches back to GeoColor", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("band13"));
    });
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("geocolor"));
    });

    expect(goes.geocolor.visible).toBe(true);
    expect(goes.band13.visible).toBe(false);
  });

  it("hides the modelled forecast contours", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(forecastLayer.visible).toBe(false);
  });
});

describe("ArcGIS in forecast mode", () => {
  it("shows the modelled contours", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.visible).toBe(true);
  });

  it("hides the GOES imagery, which cannot forecast", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(goes.geocolor.visible).toBe(false);
    expect(goes.band13.visible).toBe(false);
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
  });
});
