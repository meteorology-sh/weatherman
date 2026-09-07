// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { replayActions } from "@/lib/store/features/replay";

// ArcGIS
import {
  CandidateLegend,
  CloudBaseLegend,
  HeadingLegend,
  EchoFreezeLegend,
  LightningLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Components
import { ReplayLayers } from "@/app/components/replay/ReplayLayers";

const LAYERS = [
  RadarLegend,
  CloudBaseLegend,
  CandidateLegend,
];

describe("ReplayLayers", () => {
  // The replay map is the candidate map at another hour, so a layer missing
  // here is a layer an operator can read live and not in the archive.
  it("offers the same layers as the candidate map", () => {
    renderWithStore(<ReplayLayers />, createTestStore());

    for (const layer of LAYERS) {
      expect(screen.getByLabelText(layer.name)).toBeTruthy();
    }
  });

  it("starts with the cloud base off, like the candidate map", () => {
    renderWithStore(<ReplayLayers />, createTestStore());
    const toggle = screen.getByLabelText(
      CloudBaseLegend.name
    ) as HTMLInputElement;

    expect(toggle.checked).toBe(false);
  });

  it("turns the cloud base on when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      (screen.getByLabelText(CloudBaseLegend.name) as HTMLElement).click();
    });

    expect(store.getState().replay.cloudBase).toBe(true);
  });

  it("drives its toggles from the store", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    const radar = screen.getByLabelText(RadarLegend.name) as HTMLInputElement;
    expect(radar.checked).toBe(true);

    act(() => {
      store.dispatch(replayActions.setRadar(false));
    });

    expect(radar.checked).toBe(false);
  });

  it("offers lightning, heading, and echo past freezing only while reflectivity is on", () => {
    const store = createTestStore();
    renderWithStore(<ReplayLayers />, store);

    expect(screen.getByLabelText(LightningLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(HeadingLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(EchoFreezeLegend.name)).toBeTruthy();

    act(() => {
      store.dispatch(replayActions.setRadar(false));
    });

    expect(screen.queryByLabelText(LightningLegend.name)).toBeNull();
    expect(screen.queryByLabelText(HeadingLegend.name)).toBeNull();
    expect(screen.queryByLabelText(EchoFreezeLegend.name)).toBeNull();
  });

  // Both maps read one set of legends, so the same layer cannot end up
  // described one way live and another way in the archive.
  it("explains a layer with the same words the candidate map uses", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setField(true));
    });

    expect(screen.getByText(CandidateLegend.summary)).toBeTruthy();
  });

  it("drops a layer's ramp and explanation when it is switched off", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setField(true));
    });
    act(() => {
      store.dispatch(replayActions.setField(false));
    });

    expect(screen.queryByText(CandidateLegend.summary)).toBeNull();
  });


  it("leaves the modeled liquid off the switches", () => {
    renderWithStore(<ReplayLayers />, createTestStore());

    expect(screen.queryByLabelText(LiquidLegend.name)).toBeNull();
  });

  // The same ramp as the candidate map, in the same datum, with nothing
  // under it. The two panels must not drift.
  it("shows the height ramp in MSL and offers nothing under it", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setCloudBase(true));
    });

    const ramp = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>("div.h-3.w-full")
      ).filter((el) => el.title.endsWith("ft MSL"));

    expect(ramp().length).toBeGreaterThan(0);
    expect(container.textContent).toContain("ft MSL");
    expect(container.textContent).not.toContain("AGL");
    expect(container.textContent).not.toContain("FLIGHT WINDOW");
  });
});
