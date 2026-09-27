// React
import { StrictMode } from "react";

// Testing
import { act, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createTestStore, renderWithStore } from "./utils";
import {
  FakeExtent,
  FakeMap,
  FakeMapView,
  arcgis,
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
import { candidateActions } from "@/lib/store/features/candidate";
import { forecastActions } from "@/lib/store/features/forecast";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { domainActions } from "@/lib/store/features/domain";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";
import { warningsActions } from "@/lib/store/features/warnings";

// Fakes
import {
  cloudBaseLayer,
  confirmedLayer,
  fieldLayer,
  forecastLayer,
  forecastLiquidLayer,
  liquidLayer,
  map,
  precipLayer,
  radarLayer,
  stormCoreLayer,
  stormMotionLayer,
  lightningLayer,
  echoFreezeLayer,
  warningLayer,
  view,
} from "./arcgis-fakes";

// Components
import { ArcGIS } from "@/app/components/Map";

// Types
import type { DomainRing } from "@/lib/types";

describe("ArcGIS", () => {
  it("centers a dark map on Texas", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(map().basemap).toBe("dark-gray-vector");
    expect(view().center).toEqual([-99.9, 31.4]);
    expect(view().zoom).toBe(5);
  });

  it("builds the view only once across rerenders", () => {
    const { rerender } = renderWithStore(
      <ArcGIS mode="candidate" />,
      createTestStore()
    );

    rerender(<ArcGIS mode="candidate" />);

    expect(arcgis.views).toHaveLength(1);
  });

  // Every route mounts its own map, so a view that outlives its page is a
  // WebGL context left running for every visit.
  it("takes the view down when the map goes away", () => {
    const { unmount } = renderWithStore(
      <ArcGIS mode="candidate" />,
      createTestStore()
    );
    const fake = view();

    unmount();

    expect(fake.destroy).toHaveBeenCalledTimes(1);
  });

  // Destroying a view destroys every layer still on its map, and these layers
  // are singletons the next map mounts again.
  it("takes the shared layers off before the view goes down", () => {
    const { unmount } = renderWithStore(
      <ArcGIS mode="candidate" />,
      createTestStore()
    );
    const fake = view();

    unmount();

    expect(fake.layersAtDestroy).toEqual([]);
  });

  it("builds a whole map again on a return to the page", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store).unmount();

    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(arcgis.views).toHaveLength(2);
    expect(map().layers).toHaveLength(13);
    expect(view().destroy).not.toHaveBeenCalled();
  });

  // StrictMode mounts, cleans up and mounts again. One view has to be left
  // standing, and the layers must not pay for the second mount twice.
  //
  // At the root, as main.tsx mounts it: nested under a non-strict root, React
  // does not double-invoke effects, and this would pass without a double mount.
  it("leaves one live map, fetched once, after StrictMode's double mount", () => {
    render(
      <StrictMode>
        <Provider store={createTestStore()}>
          <ArcGIS mode="candidate" />
        </Provider>
      </StrictMode>
    );

    expect(arcgis.views).toHaveLength(2);
    const live = arcgis.views.filter((v) => !v.destroy.mock.calls.length);
    expect(live).toHaveLength(1);
    expect(live[0]).toBe(view());
    expect(map().layers).toHaveLength(13);
    expect(fieldLayer.refresh).toHaveBeenCalledTimes(1);
  });

  it("puts every layer on the map so switching re-uses what is loaded", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(map().layers).toEqual([
      cloudBaseLayer,
      forecastLayer,
      forecastLiquidLayer,
      precipLayer,
      liquidLayer,
      radarLayer,
      echoFreezeLayer,
      lightningLayer,
      stormMotionLayer,
      stormCoreLayer,
      fieldLayer,
      confirmedLayer,
      warningLayer,
    ]);
  });

  // The candidate field is the answer the other four are inputs to, so it is
  // drawn over all of them — amber showing through with no green on it is
  // liquid the join rejected, and that reading only works in this order.
  it("draws the candidate field above every layer it joins", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(fieldLayer)).toBeGreaterThan(
      layers.indexOf(radarLayer)
    );
  });

  // The outline says which part of the field the satellite backs, so it has to
  // sit on the fills rather than under them.
  it("draws the observed outline above the field it annotates", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(confirmedLayer)).toBeGreaterThan(
      layers.indexOf(fieldLayer)
    );
  });

  // Draw order is array order, and rain has to sit over the cloud it falls from.
  it("draws precipitation above the cloud it falls from", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(precipLayer)).toBeGreaterThan(
      layers.indexOf(forecastLayer)
    );
  });

  // The liquid is inside the cloud it is integrated from, and the rain is what
  // falls out of it, so it belongs between the two.
  it("draws the forecast liquid inside the cloud, under the rain", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(forecastLiquidLayer)).toBeGreaterThan(
      layers.indexOf(forecastLayer)
    );
    expect(layers.indexOf(precipLayer)).toBeGreaterThan(
      layers.indexOf(forecastLiquidLayer)
    );
  });

  // The mosaic is the disqualifier, so it has to be the layer you can see:
  // a candidate is ruled out exactly where cyan covers amber.
  it("draws the measured rain above the modeled liquid it rules out", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(radarLayer)).toBeGreaterThan(
      layers.indexOf(liquidLayer)
    );
    expect(layers.indexOf(liquidLayer)).toBeGreaterThan(
      layers.indexOf(cloudBaseLayer)
    );
  });
});

describe("ArcGIS in candidate mode", () => {
  // The map opens on the candidate field alone. Every input to it starts off,
  // so a layer on screen is one the operator asked for.
  it("opens with the Texas fly fill and nothing else", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(fieldLayer.visible).toBe(true);
    expect(radarLayer.visible).toBe(false);
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);
    expect(lightningLayer.visible).toBe(false);
    expect(cloudBaseLayer.visible).toBe(false);
    expect(liquidLayer.visible).toBe(false);
  });

  // Every layer is fetched on landing, switched on or not: the panel is a
  // set of switches over one scene, and a switch that starts a download is
  // a switch that looks broken. The field goes first — it is the layer the
  // map opens with.
  it("fetches every candidate layer on landing, whatever its switch says", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(fieldLayer.url).toContain("/candidate/target");
    expect(radarLayer.url).toContain("/radar/reflectivity");
    expect(stormCoreLayer.url).toContain("/radar/objects/cores");
    expect(stormMotionLayer.url).toContain("/radar/objects/motion");
    expect(cloudBaseLayer.url).toContain("/candidate/cloudbase");
    expect(liquidLayer.url).toContain("/forecast/liquid");
    expect(lightningLayer.url).toContain("/cloudtop/lightning");
    expect(echoFreezeLayer.url).toContain("/radar/echotop/past-freezing");
    expect(lightningLayer.visible).toBe(false);
    expect(echoFreezeLayer.visible).toBe(false);
  });

  it("does not refetch when the view zooms in inside the held window", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());
    const url = radarLayer.url;
    const v = view();
    v.extent = { xmin: -102, ymin: 28, xmax: -98, ymax: 32 };
    const onStationary = watch.mock.calls[0]?.[1] as
      ((stationary: boolean) => void) | undefined;
    act(() => {
      onStationary?.(true);
    });

    expect(radarLayer.url).toBe(url);
  });

  it("keeps lightning off until asked, even zoomed out", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setHeading(true));
    });
    const v = view();
    v.zoom = 4;
    v.extent = { xmin: -125, ymin: 24, xmax: -70, ymax: 50 };
    const onStationary = watch.mock.calls[0]?.[1] as
      ((stationary: boolean) => void) | undefined;
    act(() => {
      onStationary?.(true);
    });

    expect(radarLayer.visible).toBe(true);
    expect(stormCoreLayer.visible).toBe(true);
    expect(stormMotionLayer.visible).toBe(true);
    expect(lightningLayer.visible).toBe(false);
  });

  it("shows echo past freezing only while radar is on and the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(echoFreezeLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setEchoFreeze(true));
    });
    expect(echoFreezeLayer.visible).toBe(true);
    expect(echoFreezeLayer.url).toContain("/radar/echotop/past-freezing");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(echoFreezeLayer.visible).toBe(false);
  });

  it("points the warning layer at the live warnings for the window", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(warningLayer.url).toBe(
      "/warnings/severe?west=-107&east=-93&south=25.5&north=37"
    );
  });

  // The switch exists only while a warning is in force, so the layer is
  // gated on the count too: nothing may be drawn that has no switch.
  it("draws warnings only while any are in force and the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(warningLayer.visible).toBe(false);

    act(() => {
      store.dispatch(
        warningsActions.setStats({
          validTime: "2025-04-26T22:44:00.000Z",
          fetchedAt: "2026-09-16T22:30:00.000Z",
          count: 4,
          severe: 4,
          tornado: 0,
          flood: 0,
        })
      );
    });
    expect(warningLayer.visible).toBe(true);

    act(() => {
      store.dispatch(warningsActions.setVisible(false));
    });
    expect(warningLayer.visible).toBe(false);

    act(() => {
      store.dispatch(warningsActions.setVisible(true));
      store.dispatch(
        warningsActions.setStats({
          ...{
            validTime: "2025-04-26T22:44:00.000Z",
            fetchedAt: "2026-09-16T22:30:00.000Z",
            count: 4,
            severe: 4,
            tornado: 0,
            flood: 0,
          },
          count: 0,
          severe: 0,
        })
      );
    });
    expect(warningLayer.visible).toBe(false);
  });

  it("keeps live warnings off the forecast map", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(
        warningsActions.setStats({
          validTime: "2025-04-26T22:44:00.000Z",
          fetchedAt: "2026-09-16T22:30:00.000Z",
          count: 4,
          severe: 4,
          tornado: 0,
          flood: 0,
        })
      );
    });

    expect(warningLayer.visible).toBe(false);
  });

  it("shows lightning only while radar is on and the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(lightningLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setLightning(true));
    });
    expect(lightningLayer.visible).toBe(true);
    expect(lightningLayer.url).toContain("/cloudtop/lightning");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(lightningLayer.visible).toBe(false);
  });

  it("shows the core and heading with the mosaic, and hides them with it", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setHeading(true));
    });
    expect(stormCoreLayer.visible).toBe(true);
    expect(stormMotionLayer.visible).toBe(true);
    expect(stormCoreLayer.url).toContain("/radar/objects/cores");
    expect(stormMotionLayer.url).toContain("/radar/objects/motion");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setHeading(false));
    });
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);
  });

  it("hides the modeled forecast contours", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(forecastLayer.visible).toBe(false);
    expect(precipLayer.visible).toBe(false);
  });

  it("leaves the cloud base off until it is asked for", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(cloudBaseLayer.visible).toBe(false);

    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });

    expect(cloudBaseLayer.visible).toBe(true);
  });

  // Modeled, so it belongs to the candidate map only — the same rule that
  // keeps the observed layers off the forecast one, running the other way.
  it("keeps the cloud base off the forecast map even when it is switched on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });

    expect(cloudBaseLayer.visible).toBe(false);
  });

  it("leaves the supercooled liquid off until it is asked for", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(liquidLayer.visible).toBe(false);

    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    expect(liquidLayer.visible).toBe(true);
  });

  // The candidate map is "right now", so its instance is pinned to the
  // analysis. The forecast map has its own, which is the one that moves.
  it("keeps its liquid layer pinned to the analysis hour", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
      store.dispatch(forecastActions.setHour(9));
    });

    expect(liquidLayer.url).toContain("hour=0");
    expect(forecastLiquidLayer.url).toBe("");
  });

  // Two instances, so the pinned one cannot be dragged onto a forecast hour
  // and the forecast one cannot leave a +12 h frame on a map captioned "now".
  it("keeps the candidate liquid off the forecast map, and the reverse", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    expect(liquidLayer.visible).toBe(false);
  });
});

describe("ArcGIS radar", () => {
  it("draws the mosaic on the observed map", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(true));
    });

    expect(radarLayer.visible).toBe(true);
  });

  // An observation, so the same rule that keeps the satellite off the modeled
  // map keeps this off it — the forecast map has HRRR's own precipitation.
  it("keeps it off the modeled map", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(radarLayer.visible).toBe(false);
  });

  // The disqualifier has to be the layer you can see: a candidate is ruled out
  // exactly where cyan covers amber.
  it("hides it when the operator turns it off", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(radarLayer.visible).toBe(false);
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);
    expect(lightningLayer.visible).toBe(false);
  });
});

describe("ArcGIS in forecast mode", () => {
  it("shows the modeled contours", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.visible).toBe(true);
  });

  // The liquid layer is pinned to the analysis, so it would contradict the
  // slider the moment the operator moved it.
  it("starts on the analysis hour", () => {
    renderWithStore(<ArcGIS mode="forecast" />, createTestStore());

    expect(forecastLayer.url).toBe(
      "/forecast/clouds?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("repoints the layer when the forecast hour changes", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(12));
    });

    expect(forecastLayer.url).toBe(
      "/forecast/clouds?hour=12&west=-107&east=-93&south=25.5&north=37"
    );
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

  it("draws the supercooled liquid only once it is asked for", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);

    expect(forecastLiquidLayer.visible).toBe(false);

    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(forecastLiquidLayer.visible).toBe(true);
  });

  // Unlike precipitation, which HRRR only has once it steps forward: a mixing
  // ratio is a state the analysis holds, so f00 is a real frame here.
  it("asks for the analysis hour, which this field actually has", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(forecastLiquidLayer.url).toBe(
      "/forecast/liquid?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("follows the slider once the layer is on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });
    forecastLiquidLayer.refresh.mockClear();
    act(() => {
      store.dispatch(forecastActions.setHour(12));
    });

    expect(forecastLiquidLayer.url).toBe(
      "/forecast/liquid?hour=12&west=-107&east=-93&south=25.5&north=37"
    );
    expect(forecastLiquidLayer.refresh).toHaveBeenCalled();
  });

  // Every other layer here is fetched whatever its switch says, because each
  // is a window off one cached build. This one is a fresh integration per
  // hour, so nineteen of them nobody asked for is not a cheap courtesy.
  it("fetches no frame at all while its switch is off", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(6));
    });

    expect(forecastLiquidLayer.url).toBe("");
  });

  it("keeps the frame it already fetched when toggled off and on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });
    act(() => {
      store.dispatch(forecastActions.setLiquid(false));
    });
    forecastLiquidLayer.refresh.mockClear();
    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(forecastLiquidLayer.visible).toBe(true);
    expect(forecastLiquidLayer.refresh).not.toHaveBeenCalled();
  });

  it("does not repoint the forecast layer while on the candidate map", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(9));
    });

    expect(forecastLayer.url).toBe("");
    expect(precipLayer.url).toBe("");
    expect(forecastLiquidLayer.url).toBe("");
  });
});

// The server rebuilds the join as its sources roll, and the candidate layers
// hold whatever geometry they fetched on load. When the two come apart the
// panel describes one build over ground drawn from another, which is how green
// ends up captioned as frozen.
describe("ArcGIS following the candidate build", () => {
  const A = "run|scene-a|radar-a|phase-a";
  const B = "run|scene-b|radar-a|phase-b";

  const drawn = (store: ReturnType<typeof createTestStore>, build: string) =>
    act(() => {
      store.dispatch(seedabilityActions.setDrawn(build));
    });

  // The first build named is the one the layers already fetched on load, so
  // going after it again would be a second download of the same frame.
  it("does not refetch the build the layers opened on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    fieldLayer.refresh.mockClear();
    confirmedLayer.refresh.mockClear();
    drawn(store, A);

    expect(fieldLayer.refresh).not.toHaveBeenCalled();
    expect(confirmedLayer.refresh).not.toHaveBeenCalled();
  });

  it("redraws the field and its outline when the server rebuilds", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    drawn(store, A);
    fieldLayer.refresh.mockClear();
    confirmedLayer.refresh.mockClear();
    drawn(store, B);

    expect(fieldLayer.refresh).toHaveBeenCalled();
    expect(confirmedLayer.refresh).toHaveBeenCalled();
  });

  // Both are traced from the same build. Sending one and not the other would
  // put an outline from one satellite sweep around a field from another.
  it("sends the outline after the field it annotates", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    drawn(store, A);
    fieldLayer.refresh.mockClear();
    confirmedLayer.refresh.mockClear();
    drawn(store, B);

    expect(confirmedLayer.refresh.mock.calls.length).toBe(
      fieldLayer.refresh.mock.calls.length
    );
  });

  it("stays put while the build is unchanged", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    drawn(store, A);
    fieldLayer.refresh.mockClear();
    drawn(store, A);

    expect(fieldLayer.refresh).not.toHaveBeenCalled();
  });

  // A rolled radar scan is a different answer about which candidates are
  // raining, so the field it draws changed even though the sweep did not.
  it("follows a source other than the satellite rolling", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    drawn(store, A);
    fieldLayer.refresh.mockClear();
    drawn(store, "run|scene-a|radar-b|phase-a");

    expect(fieldLayer.refresh).toHaveBeenCalled();
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
    expect(precipLayer.url).toBe(
      "/forecast/precip?hour=6&west=-107&east=-93&south=25.5&north=37"
    );
  });

  // HRRR diagnoses PRATE by stepping forward, so f00 is zero everywhere. A
  // layer that is on but empty reads as "no rain" rather than "not modeled",
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
    expect(forecastLayer.url).toBe(
      "/forecast/clouds?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
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

/** A ring around the middle of the country, standing in for HRRR's grid. */
const ring: DomainRing = [
  [-120, 25],
  [-70, 25],
  [-70, 50],
  [-120, 50],
  [-120, 25],
];

/** A map click, shaped the way ArcGIS hands one back. */
const clickAt = (longitude: number, latitude: number) =>
  view().handlers.click?.({ mapPoint: { longitude, latitude } });

describe("ArcGIS sounding point", () => {
  it("profiles the point that was clicked", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      clickAt(-104.9912, 39.7394);
    });

    expect(store.getState().sounding.point).toEqual([-104.991, 39.739]);
  });

  // The profile is the analysis hour, so offering it under a slider set to
  // +12 h would answer a question about now while the map shows later.
  it("does not listen on the modeled map", () => {
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

  // The bug this fixes: a click on the ocean used to fetch a point the model
  // has no cell for, and the panel showed the 500 that came back. There is
  // nothing to say about a cell outside the grid, so nothing is what happens —
  // the point does not move, and the last cell an operator picked stays on the
  // panel.
  it("ignores a click outside the model's edge", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(domainActions.setRing(ring));
      clickAt(-104.9912, 39.7394);
    });
    act(() => {
      clickAt(-160, 21);
    });

    expect(store.getState().sounding.point).toEqual([-104.991, 39.739]);
  });

  // Until the ring lands there is nothing to test against, and refusing every
  // click would make the map dead on a slow connection. The server refuses the
  // same points, so the ring saves a round trip rather than deciding anything.
  it("lets a click through before the model's edge has loaded", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      clickAt(-160, 21);
    });

    expect(store.getState().sounding.point).toEqual([-160, 21]);
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
