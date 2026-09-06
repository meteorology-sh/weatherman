// Testing
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";
import {
  FakeExtent,
  FakeMap,
  FakeMapView,
  layers as layerFakes,
  resetArcgis,
  watch,
} from "./arcgis-fakes";

// The imperative ArcGIS API needs a real WebGL context, so everything the
// component reaches for is faked. The factories import the fakes rather than
// closing over them, which is what lets the module be shared.
vi.mock("@/lib/arcgis/layers", async () => layerFakes);
vi.mock("@arcgis/core/core/reactiveUtils", () => ({ watch }));
vi.mock("@arcgis/core/Map", () => ({ default: FakeMap }));
vi.mock("@arcgis/core/views/MapView", () => ({ default: FakeMapView }));
vi.mock("@arcgis/core/geometry/Extent", () => ({ default: FakeExtent }));

beforeEach(resetArcgis);

// Store
import { replayActions } from "@/lib/store/features/replay";

// Fakes
import {
  liquidLayer,
  map,
  radarLayer,
  replayCloudBaseLayer,
  replayConfirmedLayer,
  replayFieldLayer,
  replayRadarLayer,
  replayStormCoreLayer,
  replayStormMotionLayer,
  replayLightningLayer,
  replayEchoFreezeLayer,
} from "./arcgis-fakes";

// Components
import { ArcGIS } from "@/app/components/Map";

const replayStats = {
  cloudBase: { run: "2025-05-15T18:00:00.000Z" },
  cloudTop: { validTime: "2025-05-15T18:01:17.900Z" },
  liquid: { run: "2025-05-15T18:00:00.000Z" },
  radar: { validTime: "2025-05-15T17:59:00.000Z" },
} as unknown as Parameters<typeof replayActions.setReady>[0]["stats"];

describe("ArcGIS in replay mode", () => {
  const AT = "2025-05-15T18:00:00.000Z";
  const ready = (at: string) =>
    replayActions.setReady({ at, stats: replayStats });

  /**
   * Switch on the layers whose reveal is under test.
   *
   * The page opens on the candidate field alone, so these start off. Every test
   * below is about the `ready` gate — whether they appear together — and asking
   * for them is the precondition for that, not part of it.
   */
  const askFor = (store: ReturnType<typeof createTestStore>) => {
    store.dispatch(replayActions.setCloudBase(true));
    store.dispatch(replayActions.setRadar(true));
  };

  it("draws nothing until an hour is picked", () => {
    renderWithStore(<ArcGIS mode="replay" />, createTestStore());

    expect(replayRadarLayer.visible).toBe(false);
  });

  // The complaint this fixes: the three sources finish 10 s to 40 s apart, so
  // revealing each as it landed put two dates on the map at once.
  it("stays blank while an hour is still loading", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(replayActions.setAt(AT));
    });

    expect(replayRadarLayer.visible).toBe(false);
  });

  it("blanks the map again when a new hour is picked", () => {
    const store = createTestStore();
    askFor(store);
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(replayActions.setAt(AT));
      store.dispatch(ready(AT));
    });
    expect(replayRadarLayer.visible).toBe(true);

    act(() => {
      store.dispatch(replayActions.setAt("2025-05-16T18:00:00.000Z"));
    });

    expect(replayRadarLayer.visible).toBe(false);
  });

  it("reveals the layers together once every source has answered", () => {
    const store = createTestStore();
    askFor(store);
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(replayActions.setAt(AT));
      store.dispatch(ready(AT));
    });

    expect(replayCloudBaseLayer.visible).toBe(true);
    expect(replayRadarLayer.visible).toBe(true);
  });

  // The one thing this page must never do: show today's scene under a past
  // date. The live layers are pinned to now, so replay mode keeps them off.
  it("keeps the live candidate layers off", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(replayActions.setAt(AT));
      store.dispatch(ready(AT));
    });

    expect(liquidLayer.visible).toBe(false);
    expect(radarLayer.visible).toBe(false);
  });

  it("points every layer at the hour that is ready", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });

    const at = encodeURIComponent(AT);
    const box = "west=-107&east=-93&south=25.5&north=37";
    expect(replayRadarLayer.url).toBe(`/radar/reflectivity?at=${at}&${box}`);
    expect(replayStormCoreLayer.url).toBe(
      `/radar/objects/cores?at=${at}&${box}`
    );
    expect(replayStormMotionLayer.url).toBe(
      `/radar/objects/motion?at=${at}&shape=line&${box}`
    );
    // Pointed with the rest, not on their switches: the hour is one scene,
    // and a switch over it should show what is already in hand.
    expect(replayLightningLayer.url).toBe(
      `/cloudtop/lightning?at=${at}&${box}`
    );
    expect(replayEchoFreezeLayer.url).toBe(
      `/radar/echotop/past-freezing?at=${at}&${box}`
    );
    expect(replayCloudBaseLayer.url).toBe(
      `/forecast/cloudbase?hour=0&at=${at}&${box}`
    );
    expect(replayConfirmedLayer.url).toBe(
      `/candidate/field/confirmed?at=${at}&${box}`
    );
  });

  it("shows the Texas fly fill when the hour is ready", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });

    expect(replayFieldLayer.visible).toBe(true);
    expect(replayConfirmedLayer.visible).toBe(false);

    act(() => {
      store.dispatch(replayActions.setField(false));
    });

    expect(replayFieldLayer.visible).toBe(false);
    expect(replayConfirmedLayer.visible).toBe(false);
  });

  it("does not fetch geometry for an hour that is still building", () => {
    // Pointing on `at` would send three cold requests racing the three the
    // provider is already making, and land them minutes apart.
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(replayActions.setAt(AT));
    });

    expect(replayRadarLayer.url).toBe("");
  });

  it("adds the replay layers to the map once an hour is ready", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });

    const layers = map().layers ?? [];
    expect(layers).toContain(replayCloudBaseLayer);
    // Cloud base underneath, as on the candidate map: it is the question asked
    // before the others and covers more ground than any of them.
    expect(layers.indexOf(replayRadarLayer)).toBeGreaterThan(
      layers.indexOf(replayCloudBaseLayer)
    );
    expect(layers.indexOf(replayFieldLayer)).toBeGreaterThan(
      layers.indexOf(replayRadarLayer)
    );
  });

  // A cold replay build is ~40 s a layer, so paying for it twice because
  // StrictMode double-invoked the effect is not a small waste.
  it("does not re-request the hour it is already showing", () => {
    const store = createTestStore();
    const { rerender } = renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });
    replayRadarLayer.refresh.mockClear();

    rerender(<ArcGIS mode="replay" />);
    act(() => {
      store.dispatch(ready(AT));
    });

    expect(replayRadarLayer.refresh).not.toHaveBeenCalled();
  });

  it("refreshes onto a newly readied hour", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });
    act(() => {
      store.dispatch(ready("2025-05-16T18:00:00.000Z"));
    });

    expect(replayRadarLayer.refresh).toHaveBeenCalled();
    expect(replayRadarLayer.url).toContain("2025-05-16");
  });

  // The cloud base is off on arrival on both maps, so a readied hour must not
  // switch it on by itself.
  it("leaves the replayed cloud base off until it is asked for", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });

    expect(replayCloudBaseLayer.visible).toBe(false);

    act(() => {
      store.dispatch(replayActions.setCloudBase(true));
    });

    expect(replayCloudBaseLayer.visible).toBe(true);
  });


  it("points the core and heading at the hour with the mosaic", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
    });

    const at = encodeURIComponent(AT);
    const box = "west=-107&east=-93&south=25.5&north=37";
    expect(replayStormCoreLayer.url).toBe(
      `/radar/objects/cores?at=${at}&${box}`
    );
    expect(replayStormMotionLayer.url).toBe(
      `/radar/objects/motion?at=${at}&shape=line&${box}`
    );
  });

  it("points lightning at the hour when the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
      store.dispatch(replayActions.setLightning(true));
    });

    const at = encodeURIComponent(AT);
    const box = "west=-107&east=-93&south=25.5&north=37";
    expect(replayLightningLayer.url).toBe(
      `/cloudtop/lightning?at=${at}&${box}`
    );
  });

  it("points echo past freezing at the hour when the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
      store.dispatch(replayActions.setEchoFreeze(true));
    });

    const at = encodeURIComponent(AT);
    const box = "west=-107&east=-93&south=25.5&north=37";
    expect(replayEchoFreezeLayer.url).toBe(
      `/radar/echotop/past-freezing?at=${at}&${box}`
    );
  });

  it("hides a replay layer the operator turns off", () => {
    const store = createTestStore();
    askFor(store);
    renderWithStore(<ArcGIS mode="replay" />, store);
    act(() => {
      store.dispatch(ready(AT));
      store.dispatch(replayActions.setRadar(false));
    });

    expect(replayRadarLayer.visible).toBe(false);
    expect(replayFieldLayer.visible).toBe(true);
  });
});
