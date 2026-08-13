// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
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
import {
  BASE_WINDOW_FT,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
} from "@/lib/arcgis/renderers";
import { CloudBaseLegend, CloudTopLegend } from "@/lib/arcgis/legends";

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
  css
    .replace(/\s+/g, "")
    .replace(/(\.\d*?)0+\)/, "$1)")
    .replace(/\.\)/, ")");

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

describe("CandidateLayers cloud base", () => {
  /** The cloud-base ramp's swatches, which carry the band's own title. */
  const bases = (container: HTMLElement) =>
    Array.from(
      container.querySelectorAll<HTMLElement>("div.h-3.w-full")
    ).filter((el) => el.title.endsWith("ft MSL"));

  const withLayer = () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });
    return { store, container };
  };

  // It starts off, so nothing about it should be on screen until asked for.
  it("hides its ramp until the layer is switched on", () => {
    const { container } = renderWithStore(
      <CandidateLayers />,
      createTestStore()
    );

    expect(bases(container)).toHaveLength(0);
  });

  it("shows a swatch for every cloud-base band", () => {
    const { container } = withLayer();

    expect(bases(container)).toHaveLength(CLOUD_BASE_BANDS.length);
  });

  // Disjoint bands, like the cloud tops: each swatch is the literal fill.
  it("paints each swatch its own unstacked fill", () => {
    const { container } = withLayer();

    const window = bases(container)[1];
    expect(rgba(window.style.backgroundColor)).toBe(
      rgba(soloColor(CLOUD_BASE_RGB, CLOUD_BASE_BANDS[1].alpha))
    );
  });

  // The ramp is neither quiet-to-loud nor loud-to-quiet: it is a window with a
  // wrong side on each end, so the middle band is the one that shows.
  it("keeps the operational window the loudest band", () => {
    const [below, window, above] = CLOUD_BASE_BANDS.map((b) => b.alpha);

    expect(window).toBeGreaterThan(below);
    expect(window).toBeGreaterThan(above);
  });

  // The band edges are the cited operational window, not numbers picked from a
  // coverage table — so the middle band has to start and end on them.
  it("bands on the operational window's own edges", () => {
    expect(CLOUD_BASE_BANDS[1].value).toBe(BASE_WINDOW_FT[0]);
    expect(CLOUD_BASE_BANDS[2].value).toBe(BASE_WINDOW_FT[1]);
  });

  it("drives its toggle from the store", () => {
    const { store } = withLayer();
    const toggle = screen.getByLabelText("Cloud base") as HTMLInputElement;

    expect(toggle.checked).toBe(true);

    act(() => {
      store.dispatch(cloudBaseActions.setVisible(false));
    });

    expect(toggle.checked).toBe(false);
  });

  it("turns the layer on when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText("Cloud base") as HTMLElement).click();
    });

    expect(store.getState().cloudbase.visible).toBe(true);
  });

  it("says the layer is modelled and names its datum", () => {
    withLayer();

    expect(screen.getByText(CloudBaseLegend.caveat)).toBeTruthy();
  });

  // Switching this one on must not disturb the ramps already on screen.
  it("leaves the liquid ramp alone", () => {
    const { container } = withLayer();

    expect(swatches(container, SLW_LABELS)).toHaveLength(SLW_BANDS.length);
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
