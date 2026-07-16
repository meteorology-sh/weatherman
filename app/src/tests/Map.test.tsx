// Testing
import type { Mock } from "vitest";
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { weatherActions } from "@/lib/store/features/weather";
import { interactionsActions } from "@/lib/store/features/interactions";

// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";

// Components
import { ArcGIS } from "@/app/components/Map";

type FakeMapT = { basemap?: string; add: Mock; remove: Mock };
type FakeViewT = {
  center?: [number, number];
  zoom?: number;
  goTo: Mock;
};

// The imperative ArcGIS API needs a real WebGL context, so the classes this
// component drives are faked. Each fake records its instances, and the tests
// assert on the calls the component makes to them.
const { arcgis } = vi.hoisted(() => ({
  arcgis: {
    maps: [] as FakeMapT[],
    views: [] as FakeViewT[],
  },
}));

vi.mock("@arcgis/core/Map", () => ({
  default: class FakeMap {
    add = vi.fn();
    remove = vi.fn();
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
vi.mock("@arcgis/core/layers/GeoJSONLayer", () => ({
  default: class FakeGeoJSONLayer {
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

  it("does not add the placeholder layer the store starts with", () => {
    renderWithStore(<ArcGIS />, createTestStore());

    expect(map().add).not.toHaveBeenCalled();
  });

  it("adds the cloud layer once the provider supplies one", () => {
    const store = createTestStore();
    const layer = new GeoJSONLayer({ url: "blob:mock" });

    renderWithStore(<ArcGIS />, store);
    act(() => {
      store.dispatch(weatherActions.CloudLayer(layer));
    });

    expect(map().add).toHaveBeenCalledWith(layer);
  });

  it("removes the previous cloud layer when a new one replaces it", () => {
    const store = createTestStore();
    const first = new GeoJSONLayer({ url: "blob:first" });
    const second = new GeoJSONLayer({ url: "blob:second" });

    renderWithStore(<ArcGIS />, store);
    act(() => {
      store.dispatch(weatherActions.CloudLayer(first));
    });
    act(() => {
      store.dispatch(weatherActions.CloudLayer(second));
    });

    expect(map().remove).toHaveBeenCalledWith(first);
    expect(map().add).toHaveBeenCalledWith(second);
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
