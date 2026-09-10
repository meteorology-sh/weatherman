// Testing
import { act, screen, within } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";

// ArcGIS
import {
  BAND_LABEL,
  RADAR_BANDS,
  RADAR_RGB,
  SLW_BANDS,
  SLW_RGB,
  stackedColor,
  soloColor,
} from "@/lib/arcgis/bands";
import {
  CEILING_FT,
  BASE_CEILING_FT,
  CLOUD_BASE_ALPHA,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
} from "@/lib/arcgis/bands";
import {
  CandidateLegend,
  CloudBaseLegend,
  EchoFreezeLegend,
  HeadingLegend,
  LightningLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Components
import { CandidateLayers } from "@/app/components/candidate/CandidateLayers";

/**
 * One layer's ramp swatches, scoped to that layer's own switch.
 */
const swatches = (container: HTMLElement, layer: string) => {
  const input = container.querySelector<HTMLElement>(
    `input[aria-label="${layer}"]`
  );
  const section = input?.closest("div.flex.flex-col.gap-2");
  return Array.from(
    section?.querySelectorAll<HTMLElement>("div.h-4.flex-1") ?? []
  );
};

const RADAR = RadarLegend.name;
const FIELD = CandidateLegend.name;
const LIQUID = LiquidLegend.name;

/** A css color as its numbers, so `rgb(a,b,c)` and `rgba(a,b,c,1)` compare equal. */
const rgba = (css: string) => {
  const parts = (css.match(/[\d.]+/g) ?? []).map(Number);
  const [red, green, blue, alpha = 1] = parts;
  return `${red},${green},${blue},${alpha}`;
};

const allOn = () => {
  const store = createTestStore();
  store.dispatch(seedabilityActions.setVisible(true));
  store.dispatch(radarActions.setVisible(true));
  return store;
};

describe("CandidateLayers", () => {
  it("names the Texas fly fill under the last switch", () => {
    renderWithStore(<CandidateLayers />, allOn());

    expect(screen.getByLabelText(FIELD)).toBeTruthy();
    expect(screen.getAllByText(CandidateLegend.summary).length).toBeGreaterThan(
      0
    );
  });

  it("offers the modeled liquid as a switch", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.getByLabelText(LIQUID)).toBeTruthy();
  });
});

describe("CandidateLayers cloud base", () => {
  const bases = (container: HTMLElement) =>
    Array.from(
      container.querySelectorAll<HTMLElement>("div.h-3.w-full")
    ).filter((el) => el.title.endsWith("ft MSL"));

  const withLayer = () => {
    const store = allOn();
    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
    });
    return { store, container };
  };

  it("hides its ramp until the layer is switched on", () => {
    const { container } = renderWithStore(<CandidateLayers />, allOn());

    expect(bases(container)).toHaveLength(0);
  });

  // One ramp, one datum, no switch under it. The window that used to trim
  // this layer is a test the candidate fill runs, not a view of this one.
  it("shows the ramp in MSL and offers nothing under it", () => {
    const { container } = withLayer();

    expect(bases(container)).toHaveLength(CLOUD_BASE_BANDS.length);
    expect(container.textContent).toContain("ft MSL");
    expect(container.textContent).not.toContain("AGL");
    expect(container.textContent).not.toContain("FLIGHT WINDOW");
  });

  it("shows a swatch for every cloud-base band", () => {
    const { container } = withLayer();

    expect(bases(container)).toHaveLength(CLOUD_BASE_BANDS.length);
  });

  it("paints each swatch its own unstacked fill", () => {
    const { container } = withLayer();

    const violet = CLOUD_BASE_BANDS.findIndex(
      (band) => band.rgb === CLOUD_BASE_RGB
    );
    expect(rgba(bases(container)[violet].style.backgroundColor)).toBe(
      rgba(soloColor(CLOUD_BASE_RGB, CLOUD_BASE_ALPHA))
    );
  });

  // The height is in the color, so the swatches differ from each other and not
  // from the basemap: every one of them is painted at the same opacity.
  it("gives every swatch its own color at one opacity", () => {
    const { container } = withLayer();

    const painted = bases(container).map((swatch) =>
      rgba(swatch.style.backgroundColor)
    );

    expect(painted).toEqual(
      CLOUD_BASE_BANDS.map((band) =>
        rgba(soloColor(band.rgb, CLOUD_BASE_ALPHA))
      )
    );
    expect(new Set(painted).size).toBe(CLOUD_BASE_BANDS.length);
  });

  // Lightness is the height, so the lowest band is the deepest violet.
  it("keeps the reachable band the darkest", () => {
    const luma = (rgb: readonly number[]) =>
      0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    const [reachable, unreachable] = CLOUD_BASE_BANDS.map((b) => luma(b.rgb));

    expect(reachable).toBeLessThan(unreachable);
  });

  it("bands on thirds of the workable bound, open above it", () => {
    expect(CLOUD_BASE_BANDS.map((b) => b.value)).toEqual(
      [0, 1, 2, 3].map((n) => (n * BASE_CEILING_FT) / 3)
    );
  });

  it("drives its toggle from the store", () => {
    const { store } = withLayer();
    const toggle = screen.getByLabelText(
      CloudBaseLegend.name
    ) as HTMLInputElement;

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
      (screen.getByLabelText(CloudBaseLegend.name) as HTMLElement).click();
    });

    expect(store.getState().cloudbase.visible).toBe(true);
  });

  it("says what the layer gives you under its switch", () => {
    withLayer();

    expect(screen.getAllByText(CloudBaseLegend.summary).length).toBeGreaterThan(
      0
    );
  });
});

describe("CandidateLayers radar", () => {
  it("shows a swatch for every reflectivity band", () => {
    const { container } = renderWithStore(<CandidateLayers />, allOn());

    expect(swatches(container, RADAR)).toHaveLength(RADAR_BANDS.length);
  });

  it("paints each swatch the color the map composites", () => {
    const { container } = renderWithStore(<CandidateLayers />, allOn());

    const hardest = swatches(container, RADAR)[RADAR_BANDS.length - 1];
    expect(rgba(hardest.style.backgroundColor)).toBe(
      rgba(stackedColor(RADAR_BANDS, RADAR_RGB, RADAR_BANDS.length))
    );
  });

  it("labels the bands in dBZ", () => {
    const { container } = renderWithStore(<CandidateLayers />, allOn());
    const section = container
      .querySelector(`input[aria-label="${RADAR}"]`)
      ?.closest("div.flex.flex-col.gap-2") as HTMLElement;

    expect(within(section).getByText("30")).toBeTruthy();
    expect(within(section).getByText("40")).toBeTruthy();
    expect(within(section).getAllByText(/dBZ/).length).toBeGreaterThan(0);
  });

  it("turns the mosaic on when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.visible).toBe(true);
  });

  it("turns the mosaic off again when its toggle is clicked twice", () => {
    const store = allOn();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.visible).toBe(false);
  });

  it("hides the radar ramp when the layer is off", () => {
    const store = allOn();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(swatches(container, RADAR)).toHaveLength(0);
  });

  it("offers echo past freezing only while reflectivity is on", () => {
    const store = allOn();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.getByLabelText(EchoFreezeLegend.name)).toBeTruthy();
    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });
    expect(screen.queryByLabelText(EchoFreezeLegend.name)).toBeNull();
  });

  it("offers lightning and heading only while reflectivity is on", () => {
    const store = allOn();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.getByLabelText(LightningLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(HeadingLegend.name)).toBeTruthy();

    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });

    expect(screen.queryByLabelText(LightningLegend.name)).toBeNull();
    expect(screen.queryByLabelText(HeadingLegend.name)).toBeNull();
  });

  // Turning the rain on does not turn anything on over it: the mosaic is the
  // reading, and the marks on top of it are each asked for.
  it("starts every switch under the mosaic off", () => {
    renderWithStore(<CandidateLayers />, allOn());

    for (const legend of [LightningLegend, HeadingLegend, EchoFreezeLegend]) {
      expect(
        (screen.getByLabelText(legend.name) as HTMLInputElement).checked
      ).toBe(false);
    }
  });

  it("turns lightning on when its switch is clicked", () => {
    const store = allOn();
    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(LightningLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.lightning).toBe(true);
  });

  it("turns the core and heading on when its switch is clicked", () => {
    const store = allOn();
    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(HeadingLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.heading).toBe(true);
  });
});

// The one modeled field on a map of measurements, and the reading the whole
// product is built around — so it is offered here, and it is off until asked
// for, like every other input to the fill.
describe("CandidateLayers supercooled liquid", () => {
  it("starts off, so the map opens on the fill alone", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect((screen.getByLabelText(LIQUID) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it("turns the layer on when its switch is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(LIQUID) as HTMLElement).click();
    });

    expect(store.getState().candidate.liquid).toBe(true);
  });

  it("drives its switch from the store", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    const toggle = screen.getByLabelText(LIQUID) as HTMLInputElement;
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });
    expect(toggle.checked).toBe(true);

    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });
    expect(toggle.checked).toBe(false);
  });

  it("hides its ramp until the layer is switched on", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    expect(swatches(container, LIQUID)).toHaveLength(0);

    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    expect(swatches(container, LIQUID)).toHaveLength(SLW_BANDS.length);
  });

  // The swatch has to be the color the map composites, or the legend quietly
  // stops describing the map.
  it("paints each swatch the color the map composites", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    const richest = swatches(container, LIQUID)[SLW_BANDS.length - 1];
    expect(rgba(richest.style.backgroundColor)).toBe(
      rgba(stackedColor(SLW_BANDS, SLW_RGB, SLW_BANDS.length))
    );
  });

  // g/m² is a column amount over ground, not a concentration and not an area.
  // The unit line has to say which, and it has to name the band it summed
  // through — the band is what makes the figure a seeding number.
  it("says the figure is per square meter of ground, over the band", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    expect(container.textContent).toContain("g/m² of ground");
    expect(container.textContent).toContain(BAND_LABEL);
    expect(container.textContent).not.toContain("g/m³");
  });

  it("says what the layer gives you under its switch", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      store.dispatch(candidateActions.setLiquid(true));
    });

    expect(screen.getAllByText(LiquidLegend.summary).length).toBeGreaterThan(0);
  });
});
