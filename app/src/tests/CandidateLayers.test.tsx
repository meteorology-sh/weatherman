// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";

// ArcGIS
import { SLW_BANDS, SLW_RGB, stackedColor } from "@/lib/arcgis/renderers";
import { Band13Legend } from "@/lib/arcgis/legends";

// Components
import { CandidateLayers } from "@/app/components/CandidateLayers";

/**
 * Ramp swatches only. Band13's tick row is also `h-4`, so the selector has to
 * be narrower than it is on the forecast panel, which has no gradient legend.
 */
const swatches = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("div.h-4.flex-1"));

/** jsdom re-prints rgba() with spaces; compare the colour, not the spacing. */
const rgba = (css: string) => css.replace(/\s+/g, "");

describe("CandidateLayers", () => {
  it("shows a swatch for every liquid-water band", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(swatches(container)).toHaveLength(SLW_BANDS.length);
  });

  // The swatch has to be the colour the map paints, not a hand-picked one, or
  // the legend quietly stops describing the map.
  it("paints each swatch the colour the map composites", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    const richest = swatches(container)[SLW_BANDS.length - 1];
    expect(rgba(richest.style.backgroundColor)).toBe(
      rgba(stackedColor(SLW_BANDS, SLW_RGB, SLW_BANDS.length))
    );
  });

  it("labels the liquid bands in g/m² over the seeding band", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText("400")).toBeTruthy();
    expect(screen.getByText(/g\/m² in the −5 to −12 °C band/)).toBeTruthy();
  });

  it("drives both toggles from the store", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    const imagery = screen.getByLabelText("Cloud tops") as HTMLInputElement;
    const liquid = screen.getByLabelText(
      "Supercooled liquid water"
    ) as HTMLInputElement;

    expect(imagery.checked).toBe(true);
    expect(liquid.checked).toBe(true);

    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(liquid.checked).toBe(false);
    expect(imagery.checked).toBe(true);
  });

  it("turns the liquid layer off when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText("Supercooled liquid water") as HTMLElement).click();
    });

    expect(store.getState().candidate.liquid).toBe(false);
  });

  it("hides the liquid ramp when the layer is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(swatches(container)).toHaveLength(0);
  });

  it("hides the Band13 legend when the imagery is off", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setImagery(false));
    });

    expect(screen.queryByText(Band13Legend.summary)).toBeNull();
  });

  // Band13's ramp is the published GIBS colour map, and the bracket across it is
  // the whole reason the layer is on this map rather than GeoColor.
  it("brackets the seeding band on the Band13 ramp", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    const bracket = container.querySelector<HTMLElement>("div.border-x-2");
    expect(bracket).toBeTruthy();
    expect(bracket!.style.left).toBe(`${Band13Legend.band.fromPercent}%`);
  });

  // Modelled data on the observed map is a real exception to this repo's
  // editorial split, so the panel has to say so rather than let it pass.
  it("says the liquid layer is modelled, not observed", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/Modelled, not observed/)).toBeTruthy();
  });
});
