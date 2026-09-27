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

// ArcGIS
import {
  BAND_LABEL,
  CLOUD_BASE_BANDS,
  COLORS,
  SLW_BANDS,
  stackedColor,
} from "@/lib/arcgis/bands";

// Components
import { ReplayLayers } from "@/app/components/replay/ReplayLayers";

const LAYERS = [RadarLegend, CloudBaseLegend, LiquidLegend, CandidateLegend];

const LIQUID = LiquidLegend.name;

/** One layer's ramp swatches, scoped to that layer's own switch. */
const swatches = (container: HTMLElement, layer: string) => {
  const input = container.querySelector<HTMLElement>(
    `input[aria-label="${layer}"]`
  );
  const section = input?.closest("div.flex.flex-col.gap-2");
  return Array.from(
    section?.querySelectorAll<HTMLElement>("div.h-4.flex-1") ?? []
  );
};

/** jsdom re-prints rgba() with spaces; compare the color, not the spacing. */
const rgba = (css: string) =>
  css
    .replace(/\s+/g, "")
    .replace(/(\.\d*?)0+\)/, "$1)")
    .replace(/\.\)/, ")");

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
    expect(radar.checked).toBe(false);

    act(() => {
      store.dispatch(replayActions.setRadar(true));
    });

    expect(radar.checked).toBe(true);
  });

  it("offers lightning, heading, and echo past freezing only while reflectivity is on", () => {
    const store = createTestStore();
    renderWithStore(<ReplayLayers />, store);

    expect(screen.queryByLabelText(LightningLegend.name)).toBeNull();
    expect(screen.queryByLabelText(HeadingLegend.name)).toBeNull();
    expect(screen.queryByLabelText(EchoFreezeLegend.name)).toBeNull();

    act(() => {
      store.dispatch(replayActions.setRadar(true));
    });

    expect(screen.getByLabelText(LightningLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(HeadingLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(EchoFreezeLegend.name)).toBeTruthy();
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

  // The candidate map offers it, so the archive has to as well — a layer an
  // operator can read live and not at an hour they picked is the drift these
  // two panels exist to prevent.
  it("offers the modeled liquid, off on arrival", () => {
    renderWithStore(<ReplayLayers />, createTestStore());

    expect((screen.getByLabelText(LIQUID) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it("turns the modeled liquid on when its switch is clicked", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    act(() => {
      (screen.getByLabelText(LIQUID) as HTMLElement).click();
    });

    expect(store.getState().replay.liquid).toBe(true);
  });

  it("drives the liquid switch from the store", () => {
    const store = createTestStore();

    renderWithStore(<ReplayLayers />, store);
    const toggle = screen.getByLabelText(LIQUID) as HTMLInputElement;
    act(() => {
      store.dispatch(replayActions.setLiquid(true));
    });

    expect(toggle.checked).toBe(true);
  });

  // The same ramp as the candidate map, in the same units. The two panels
  // must not drift.
  it("shows the same liquid ramp the candidate map shows", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ReplayLayers />, store);
    expect(swatches(container, LIQUID)).toHaveLength(0);

    act(() => {
      store.dispatch(replayActions.setLiquid(true));
    });

    expect(swatches(container, LIQUID)).toHaveLength(SLW_BANDS.length);
    const richest = swatches(container, LIQUID)[SLW_BANDS.length - 1];
    expect(rgba(richest.style.backgroundColor)).toBe(
      rgba(stackedColor(SLW_BANDS, COLORS.liquid, SLW_BANDS.length))
    );
  });

  // g/m² is a column amount over ground, not a concentration and not an area.
  it("says the figure is per square meter of ground, over the band", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setLiquid(true));
    });

    expect(container.textContent).toContain("g/m² of ground");
    expect(container.textContent).toContain(BAND_LABEL);
    expect(container.textContent).not.toContain("g/m³");
  });

  // The same ramp as the candidate map, in the same datum, with nothing
  // under it. The two panels must not drift.
  it("shows the height ramp in MSL and offers nothing under it", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<ReplayLayers />, store);
    act(() => {
      store.dispatch(replayActions.setCloudBase(true));
    });

    expect(swatches(container, CloudBaseLegend.name)).toHaveLength(
      CLOUD_BASE_BANDS.length
    );
    expect(container.textContent).toContain("ft MSL");
    expect(container.textContent).not.toContain("AGL");
    expect(container.textContent).not.toContain("FLIGHT WINDOW");
  });
});
