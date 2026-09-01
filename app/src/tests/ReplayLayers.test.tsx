// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { replayActions } from "@/lib/store/features/replay";

// ArcGIS
import {
  CandidateLegend,
  CloudBaseLegend,
  CloudTopLegend,
  LiquidLegend,
  HeadingLegend,
  LightningLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Components
import { ReplayLayers } from "@/app/components/replay/ReplayLayers";

const LAYERS = [
  CandidateLegend,
  CloudTopLegend,
  CloudBaseLegend,
  LiquidLegend,
  RadarLegend,
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

  it("offers lightning and heading only while reflectivity is on", () => {
    const store = createTestStore();
    renderWithStore(<ReplayLayers />, store);

    expect(screen.getByLabelText(LightningLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(HeadingLegend.name)).toBeTruthy();

    act(() => {
      store.dispatch(replayActions.setRadar(false));
    });

    expect(screen.queryByLabelText(LightningLegend.name)).toBeNull();
    expect(screen.queryByLabelText(HeadingLegend.name)).toBeNull();
  });

  // Both maps read one set of legends, so the same layer cannot end up
  // described one way live and another way in the archive.
  it("explains a layer with the same words the candidate map uses", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setCloudTop(true));
    });

    expect(screen.getByText(CloudTopLegend.summary)).toBeTruthy();
  });

  it("drops a layer's ramp and explanation when it is switched off", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setCloudTop(true));
    });
    act(() => {
      store.dispatch(replayActions.setCloudTop(false));
    });

    expect(screen.queryByText(CloudTopLegend.summary)).toBeNull();
  });
});
