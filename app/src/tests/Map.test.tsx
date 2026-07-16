// Testing
import type { Mock } from "vitest";
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { interactionsActions } from "@/lib/store/features/interactions";

// Components
import { ArcGIS } from "@/app/components/Map";

type FakeMapT = { basemap?: string; layers?: unknown[] };
type FakeViewT = { center?: [number, number]; zoom?: number; goTo: Mock };

// The imperative ArcGIS API needs a real WebGL context, so the classes this
// component drives are faked. Each fake records its instances, and the tests
// assert on the calls the component makes to them. The GOES layers are faked
// too — layers.test.ts covers how the real ones are built.
const { arcgis, goes } = vi.hoisted(() => ({
  arcgis: {
    maps: [] as FakeMapT[],
    views: [] as FakeViewT[],
  },
  goes: {
    geocolor: { id: "geocolor-layer", visible: false },
    band13: { id: "band13-layer", visible: false },
  },
}));

vi.mock("@/lib/arcgis/layers", () => ({ GoesLayers: goes }));
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
});

describe("ArcGIS", () => {
  it("centers a dark national map on the continental U.S.", () => {
    renderWithStore(<ArcGIS />, createTestStore());

    expect(map().basemap).toBe("dark-gray-vector");
    expect(view().center).toEqual([-98.58, 39.83]);
    expect(view().zoom).toBe(3);
  });

  it("builds the view only once across rerenders", () => {
    const { rerender } = renderWithStore(<ArcGIS />, createTestStore());

    rerender(<ArcGIS />);

    expect(arcgis.views).toHaveLength(1);
  });

  it("puts both GOES layers on the map so switching re-uses their tiles", () => {
    renderWithStore(<ArcGIS />, createTestStore());

    expect(map().layers).toEqual([goes.geocolor, goes.band13]);
  });

  it("shows only the GeoColor layer by default", () => {
    renderWithStore(<ArcGIS />, createTestStore());

    expect(goes.geocolor.visible).toBe(true);
    expect(goes.band13.visible).toBe(false);
  });

  it("shows only the Band13 layer once it is selected", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS />, store);
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("band13"));
    });

    expect(goes.band13.visible).toBe(true);
    expect(goes.geocolor.visible).toBe(false);
  });

  it("switches back to GeoColor", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS />, store);
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("band13"));
    });
    act(() => {
      store.dispatch(interactionsActions.setCloudLayer("geocolor"));
    });

    expect(goes.geocolor.visible).toBe(true);
    expect(goes.band13.visible).toBe(false);
  });

  it("does not fly anywhere until a point is selected", () => {
    renderWithStore(<ArcGIS />, createTestStore());

    expect(view().goTo).not.toHaveBeenCalled();
  });

  it("flies to the selected grid point", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS />, store);
    act(() => {
      store.dispatch(interactionsActions.setCoordinates([-100, 40]));
    });

    expect(view().goTo).toHaveBeenCalledWith({ center: [-100, 40], zoom: 6 });
  });
});
