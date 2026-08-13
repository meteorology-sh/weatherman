// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudTopActions } from "@/lib/store/features/cloudtop";
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
} from "@/lib/arcgis/renderers";
import { CLOUD_TOP_BANDS, CLOUD_TOP_RGB } from "@/lib/arcgis/renderers";
import { CloudTopLegend } from "@/lib/arcgis/legends";

// Components
import { CandidateLayers } from "@/app/components/CandidateLayers";

/**
 * One layer's ramp swatches. This panel carries several ramps, so the swatches
 * are picked out by the class titles that layer paints rather than by position.
 */
const swatches = (container: HTMLElement, titles: readonly string[]) =>
  Array.from(container.querySelectorAll<HTMLElement>("div.h-4.flex-1")).filter(
    (el) => titles.includes(el.title)
  );

/**
 * jsdom re-prints rgba() with spaces and trims trailing zeros off the alpha
 * (`0.300` -> `0.3`). Normalise both so the assertion compares the colour
 * rather than its formatting.
 */
const rgba = (css: string) =>
  css.replace(/\s+/g, "").replace(/(\.\d*?)0+\)/, "$1)").replace(/\.\)/, ")");

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
    const cloudTop = screen.getByLabelText("Cloud tops") as HTMLInputElement;
    const liquid = screen.getByLabelText(
      "Supercooled liquid water"
    ) as HTMLInputElement;

    expect(cloudTop.checked).toBe(true);
    expect(liquid.checked).toBe(true);

    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(liquid.checked).toBe(false);
    expect(cloudTop.checked).toBe(true);
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

  it("hides the cloud-top legend when the layer is off", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(cloudTopActions.setVisible(false));
    });

    expect(screen.queryByText(CloudTopLegend.summary)).toBeNull();
  });

  // The cloud-top bands are disjoint, so each swatch is the literal fill the
  // map paints rather than a composite of everything beneath it. Compositing
  // them here would describe a map that does not exist.
  it("paints each cloud-top swatch its own unstacked fill", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    const warmest = container.querySelector<HTMLElement>(
      `div[title="${CLOUD_TOP_BANDS[0].label} °C"]`
    );
    expect(warmest).toBeTruthy();
    expect(rgba(warmest!.style.backgroundColor)).toBe(
      rgba(soloColor(CLOUD_TOP_RGB, CLOUD_TOP_BANDS[0].alpha))
    );
  });

  // The ramp runs backwards from every other layer here: the warmest band is
  // the target and the coldest is cirrus covering most of the sky. If that ever
  // inverts, the map buries the thing it exists to surface.
  it("keeps the warmest cloud-top band the loudest", () => {
    const alphas = CLOUD_TOP_BANDS.map((b) => b.alpha);

    expect(alphas).toEqual([...alphas].sort((a, b) => b - a));
  });

  // Modelled data on the observed map is a real exception to this repo's
  // editorial split, so the panel has to say so rather than let it pass.
  it("says the liquid layer is modelled, not observed", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByText(/Modelled, not observed/)).toBeTruthy();
  });
});

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
