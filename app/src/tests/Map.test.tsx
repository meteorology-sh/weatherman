// Testing
import { act } from "@testing-library/react";
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
import { interactionsActions } from "@/lib/store/features/interactions";
import { forecastActions } from "@/lib/store/features/forecast";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { domainActions } from "@/lib/store/features/domain";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Fakes
import {
  cloudBaseLayer,
  cloudBaseWindowLayer,
  cloudTopLayer,
  confirmedLayer,
  fieldLayer,
  forecastLayer,
  map,
  precipLayer,
  radarLayer,
  stormCoreLayer,
  stormFlankLayer,
  stormMotionLayer,
  lightningLayer,
  echoFreezeLayer,
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

  it("puts every layer on the map so switching re-uses what is loaded", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(map().layers).toEqual([
      cloudBaseLayer,
      cloudTopLayer,
      forecastLayer,
      precipLayer,
      radarLayer,
      cloudBaseWindowLayer,
      echoFreezeLayer,
      lightningLayer,
      stormFlankLayer,
      stormMotionLayer,
      stormCoreLayer,
      fieldLayer,
      confirmedLayer,
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

  // Cloud base answers "can I get into this cloud at all", which is the
  // question before the ones the other layers answer, so it sits under them.
  it("draws the cloud tops above the cloud base", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(cloudTopLayer)).toBeGreaterThan(
      layers.indexOf(cloudBaseLayer)
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
  // The map opens on the candidate field alone. Every input to it starts off,
  // so a layer on screen is one the operator asked for.
  it("opens with radar, cores, heading, the flank, and the Texas fly fill", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    expect(fieldLayer.visible).toBe(true);
    expect(radarLayer.visible).toBe(true);
    expect(stormCoreLayer.visible).toBe(true);
    expect(stormFlankLayer.visible).toBe(true);
    expect(stormMotionLayer.visible).toBe(true);
    expect(lightningLayer.visible).toBe(false);
    expect(cloudTopLayer.visible).toBe(false);
    expect(cloudBaseLayer.visible).toBe(false);
    expect(cloudBaseWindowLayer.visible).toBe(false);
  });

  it("does not refetch when the view zooms in inside the held window", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());
    const url = radarLayer.url;
    const v = view();
    v.extent = { xmin: -102, ymin: 28, xmax: -98, ymax: 32 };
    const onStationary = watch.mock.calls[0]?.[1] as
      | ((stationary: boolean) => void)
      | undefined;
    act(() => {
      onStationary?.(true);
    });

    expect(radarLayer.url).toBe(url);
  });

  it("keeps lightning off until asked, even zoomed out", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());
    const v = view();
    v.zoom = 4;
    v.extent = { xmin: -125, ymin: 24, xmax: -70, ymax: 50 };
    const onStationary = watch.mock.calls[0]?.[1] as
      | ((stationary: boolean) => void)
      | undefined;
    act(() => {
      onStationary?.(true);
    });

    expect(radarLayer.visible).toBe(true);
    expect(stormCoreLayer.visible).toBe(true);
    expect(stormFlankLayer.visible).toBe(true);
    expect(stormMotionLayer.visible).toBe(true);
    expect(lightningLayer.visible).toBe(false);
  });

  it("shows echo past freezing only while radar is on and the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(echoFreezeLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setEchoFreeze(true));
    });
    expect(echoFreezeLayer.visible).toBe(true);
    expect(echoFreezeLayer.url).toContain("/radar/echotop/past-freezing");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(echoFreezeLayer.visible).toBe(false);
  });

  it("shows lightning only while radar is on and the switch is on", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(lightningLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setLightning(true));
    });
    expect(lightningLayer.visible).toBe(true);
    expect(lightningLayer.url).toContain("/cloudtop/lightning");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(lightningLayer.visible).toBe(false);
  });

  it("shows the core, heading, and flank with the mosaic, and hides them with it", () => {
    const store = createTestStore();
    renderWithStore(<ArcGIS mode="candidate" />, store);

    expect(stormCoreLayer.visible).toBe(true);
    expect(stormFlankLayer.visible).toBe(true);
    expect(stormMotionLayer.visible).toBe(true);
    expect(stormCoreLayer.url).toContain("/radar/objects/cores");
    expect(stormFlankLayer.url).toContain("/radar/objects/flanks");
    expect(stormMotionLayer.url).toContain("/radar/objects/motion");

    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormFlankLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);

    act(() => {
      store.dispatch(radarActions.setVisible(true));
      store.dispatch(radarActions.setHeading(false));
    });
    expect(stormCoreLayer.visible).toBe(false);
    expect(stormFlankLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);
  });

  it("hides the modelled forecast contours", () => {
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

  // Modelled, so it belongs to the candidate map only — the same rule that
  // keeps the observed layers off the forecast one, running the other way.
  it("keeps the cloud base off the forecast map even when it is switched on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="forecast" />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });

    expect(cloudBaseLayer.visible).toBe(false);
  });

  it("shows the Comptroller window only while cloud base is on", () => {
    const store = createTestStore();

    renderWithStore(<ArcGIS mode="candidate" />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setWindow(true));
    });
    expect(cloudBaseWindowLayer.visible).toBe(false);

    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });
    expect(cloudBaseWindowLayer.visible).toBe(true);
    expect(cloudBaseLayer.visible).toBe(false);
    expect(cloudBaseWindowLayer.url).toContain("/forecast/cloudbase/window");
  });

  it("draws the Comptroller window above the rain", () => {
    renderWithStore(<ArcGIS mode="candidate" />, createTestStore());

    const layers = map().layers ?? [];
    expect(layers.indexOf(cloudBaseWindowLayer)).toBeGreaterThan(
      layers.indexOf(radarLayer)
    );
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

  // An observation, so the same rule that keeps the satellite off the modelled
  // map keeps this off it — the forecast map has HRRR's own precipitation.
  it("keeps it off the modelled map", () => {
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
    expect(stormFlankLayer.visible).toBe(false);
    expect(stormMotionLayer.visible).toBe(false);
    expect(lightningLayer.visible).toBe(false);
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
