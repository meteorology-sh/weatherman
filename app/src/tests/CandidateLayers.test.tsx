// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";
import { pirepActions } from "@/lib/store/features/pirep";
import { radarActions } from "@/lib/store/features/radar";

// ArcGIS
import {
  SLW_BANDS,
  SLW_LABELS,
  SLW_RGB,
  RADAR_BANDS,
  RADAR_LABELS,
  RADAR_RGB,
  BAND_LABEL,
  stackedColor,
  soloColor,
  PIREP_CLASSES,
} from "@/lib/arcgis/renderers";
import { Band13Legend } from "@/lib/arcgis/legends";

// Components
import { CandidateLayers } from "@/app/components/CandidateLayers";

/**
 * One layer's ramp swatches. Band13's tick row is also `h-4`, so the selector
 * has to be narrower than it is on the forecast panel, which has no gradient
 * legend — and this panel now carries two ramps, so the swatches are picked out
 * by the class titles that layer paints rather than by position.
 */
const swatches = (container: HTMLElement, titles: readonly string[]) =>
  Array.from(container.querySelectorAll<HTMLElement>("div.h-4.flex-1")).filter(
    (el) => titles.includes(el.title)
  );

/** jsdom re-prints rgba() with spaces; compare the colour, not the spacing. */
const rgba = (css: string) => css.replace(/\s+/g, "");

describe("CandidateLayers", () => {
  it("shows a swatch for every liquid-water band", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(swatches(container, SLW_LABELS)).toHaveLength(SLW_BANDS.length);
  });

  // The swatch has to be the colour the map paints, not a hand-picked one, or
  // the legend quietly stops describing the map.
  it("paints each swatch the colour the map composites", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    const richest = swatches(container, SLW_LABELS)[SLW_BANDS.length - 1];
    expect(rgba(richest.style.backgroundColor)).toBe(
      rgba(stackedColor(SLW_BANDS, SLW_RGB, SLW_BANDS.length))
    );
  });

  it("labels the liquid bands in g/m² over the seeding band", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText("400")).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`g/m² in the ${BAND_LABEL} band`))
    ).toBeTruthy();
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
      (
        screen.getByLabelText("Supercooled liquid water") as HTMLElement
      ).click();
    });

    expect(store.getState().candidate.liquid).toBe(false);
  });

  it("hides the liquid ramp when the layer is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(swatches(container, SLW_LABELS)).toHaveLength(0);
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

/** PIREP legend markers: circles, sized per class, not the flex-1 ramp swatches. */
const markers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("div.rounded-full"));

/** A colour as the DOM would store it, so comparisons are not about spacing. */
const asCss = (value: string) => {
  const el = document.createElement("div");
  el.style.backgroundColor = value;
  return el.style.backgroundColor;
};

describe("CandidateLayers radar", () => {
  it("shows a swatch for every reflectivity band", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(swatches(container, RADAR_LABELS)).toHaveLength(RADAR_BANDS.length);
  });

  it("paints each swatch the colour the map composites", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    const hardest = swatches(container, RADAR_LABELS)[RADAR_BANDS.length - 1];
    expect(rgba(hardest.style.backgroundColor)).toBe(
      rgba(stackedColor(RADAR_BANDS, RADAR_RGB, RADAR_BANDS.length))
    );
  });

  it("labels the bands in dBZ", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    // 30 and 40 rather than 50, which the liquid ramp also captions.
    expect(screen.getByText("30")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText(/dBZ/)).toBeTruthy();
  });

  // The one measured layer on either map, and the sidebar has to say so — every
  // other contour here is a model's opinion.
  it("says the radar is measured, not modelled", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/Measured, not modelled/)).toBeTruthy();
  });

  // Radar sees falling water, not cloud water. Quiet air over a cloud is not
  // evidence about what is inside it, and the panel must not imply otherwise.
  it("warns that radar is a mask, not a detector", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/not a detector/)).toBeTruthy();
  });

  it("turns the mosaic off when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText("Radar") as HTMLElement).click();
    });

    expect(store.getState().radar.visible).toBe(false);
  });

  it("hides the radar ramp when the layer is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(swatches(container, RADAR_LABELS)).toHaveLength(0);
  });

  // Two ramps in one panel: switching one off must not take the other with it.
  it("leaves the liquid ramp alone when the radar is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(swatches(container, SLW_LABELS)).toHaveLength(SLW_BANDS.length);
  });
});

describe("CandidateLayers icing reports", () => {
  it("shows a marker for every icing class", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(markers(container)).toHaveLength(PIREP_CLASSES.length);
  });

  // These markers do not stack, so the legend reads each class straight. A
  // composited swatch here would describe a map nobody draws.
  it("paints each marker the colour the map paints it", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    // Compared through the DOM's own parser: it rewrites `rgba(…,1)` as `rgb(…)`
    // and re-spaces the rest, so a string comparison would fail on formatting.
    expect(markers(container).map((m) => m.style.backgroundColor)).toEqual(
      PIREP_CLASSES.map((c) => asCss(soloColor(c.rgb, c.alpha)))
    );
  });

  // Size is half the encoding; a legend that ignored it would explain half the
  // ramp.
  it("sizes each marker the way the map sizes it", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(markers(container).map((m) => m.style.width)).toEqual(
      PIREP_CLASSES.map((c) => `${c.size}px`)
    );
  });

  it("names the classes a pilot files", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText("moderate")).toBeTruthy();
    expect(screen.getByText("severe")).toBeTruthy();
  });

  // A grey marker is an aircraft that found nothing. If the panel never says
  // so, it reads as a weak hit.
  it("explains what a negative report means", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/found no ice/)).toBeTruthy();
  });

  // The rule this layer exists under: sparse points may not become a surface.
  it("says the gaps mean nobody looked", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/nobody looked/)).toBeTruthy();
  });

  it("turns the reports off when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText("Icing reports") as HTMLElement).click();
    });

    expect(store.getState().pirep.visible).toBe(false);
  });

  it("hides the icing legend when the layer is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(pirepActions.setVisible(false));
    });

    expect(markers(container)).toHaveLength(0);
  });

  it("narrows to the seeding band when asked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText("Seeding band only") as HTMLElement).click();
    });

    expect(store.getState().pirep.bandOnly).toBe(true);
  });
});
