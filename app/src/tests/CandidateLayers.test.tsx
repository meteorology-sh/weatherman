// Testing
import { act, render, screen, within } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";

// ArcGIS
import {
  RADAR_BANDS,
  RADAR_RGB,
  stackedColor,
  soloColor,
} from "@/lib/arcgis/bands";
import { CLOUD_TOP_BANDS, CLOUD_TOP_RGB } from "@/lib/arcgis/bands";
import {
  CEILING_FT,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
} from "@/lib/arcgis/bands";
import {
  BaseWindowLegend,
  CandidateLegend,
  CapeLegend,
  CinLegend,
  CloudBaseLegend,
  CloudTopLegend,
  EchoFreezeLegend,
  FreezingLegend,
  HeadingLegend,
  LclLegend,
  LightningLegend,
  LiquidLegend,
  Minus15Legend,
  RadarLegend,
  WarmDepthLegend,
} from "@/lib/arcgis/legends";

// Components
import { CandidateLayers } from "@/app/components/candidate/CandidateLayers";
import { CloudTopRamp } from "@/app/components/panel/CloudTopRamp";

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

const rgba = (css: string) =>
  css
    .replace(/\s+/g, "")
    .replace(/(\.\d*?)0+\)/, "$1)")
    .replace(/\.\)/, ")");

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

  it("does not offer cloud-top temperature as a fill", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.queryByLabelText(CloudTopLegend.name)).toBeNull();
  });

  it("leaves freezing, CAPE, LCL, and liquid off the switches", () => {
    renderWithStore(<CandidateLayers />, createTestStore());

    expect(screen.queryByLabelText(CapeLegend.name)).toBeNull();
    expect(screen.queryByLabelText(CinLegend.name)).toBeNull();
    expect(screen.queryByLabelText(LclLegend.name)).toBeNull();
    expect(screen.queryByLabelText(FreezingLegend.name)).toBeNull();
    expect(screen.queryByLabelText(Minus15Legend.name)).toBeNull();
    expect(screen.queryByLabelText(WarmDepthLegend.name)).toBeNull();
    expect(screen.queryByLabelText(LiquidLegend.name)).toBeNull();
  });

  it("paints each cloud-top swatch its own unstacked fill", () => {
    const { container } = render(<CloudTopRamp />);

    const warmest = container.querySelector<HTMLElement>(
      `div[title="${CLOUD_TOP_BANDS[0].label} °C"]`
    );
    expect(warmest).toBeTruthy();
    expect(rgba(warmest!.style.backgroundColor)).toBe(
      rgba(soloColor(CLOUD_TOP_RGB, CLOUD_TOP_BANDS[0].alpha))
    );
  });

  it("keeps the warmest cloud-top band the loudest", () => {
    const alphas = CLOUD_TOP_BANDS.map((b) => b.alpha);

    expect(alphas).toEqual([...alphas].sort((a, b) => b - a));
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

  it("offers the Comptroller window only while cloud base is on", () => {
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.queryByLabelText(BaseWindowLegend.name)).toBeNull();

    act(() => {
      (screen.getByLabelText(CloudBaseLegend.name) as HTMLElement).click();
    });

    expect(screen.getByLabelText(BaseWindowLegend.name)).toBeTruthy();
    expect(
      (screen.getByLabelText(BaseWindowLegend.name) as HTMLInputElement)
        .checked
    ).toBe(false);

    act(() => {
      (screen.getByLabelText(BaseWindowLegend.name) as HTMLElement).click();
    });

    expect(store.getState().cloudbase.window).toBe(true);
    expect(store.getState().cloudbase.visible).toBe(true);
  });

  it("hides the height ramp while the Comptroller window is on", () => {
    const { store, container } = withLayer();

    expect(bases(container)).toHaveLength(CLOUD_BASE_BANDS.length);

    act(() => {
      store.dispatch(cloudBaseActions.setWindow(true));
    });

    expect(bases(container)).toHaveLength(0);
  });

  it("shows a swatch for every cloud-base band", () => {
    const { container } = withLayer();

    expect(bases(container)).toHaveLength(CLOUD_BASE_BANDS.length);
  });

  it("paints each swatch its own unstacked fill", () => {
    const { container } = withLayer();

    const window = bases(container)[1];
    expect(rgba(window.style.backgroundColor)).toBe(
      rgba(soloColor(CLOUD_BASE_RGB, CLOUD_BASE_BANDS[1].alpha))
    );
  });

  it("keeps the reachable band the loudest", () => {
    const [reachable, unreachable] = CLOUD_BASE_BANDS.map((b) => b.alpha);

    expect(reachable).toBeGreaterThan(unreachable);
  });

  it("bands on thirds of the aircraft's ceiling", () => {
    expect(CLOUD_BASE_BANDS.map((b) => b.value)).toEqual(
      [0, 1, 2, 3].map((n) => (n * CEILING_FT) / 3)
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

    expect(
      screen.getAllByText(CloudBaseLegend.summary).length
    ).toBeGreaterThan(0);
  });
});

describe("CandidateLayers radar", () => {
  it("shows a swatch for every reflectivity band", () => {
    const { container } = renderWithStore(<CandidateLayers />, allOn());

    expect(swatches(container, RADAR)).toHaveLength(RADAR_BANDS.length);
  });

  it("paints each swatch the colour the map composites", () => {
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

  it("turns the mosaic off when its toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.visible).toBe(false);
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
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.getByLabelText(EchoFreezeLegend.name)).toBeTruthy();
    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });
    expect(screen.queryByLabelText(EchoFreezeLegend.name)).toBeNull();
  });

  it("offers lightning and heading only while reflectivity is on", () => {
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.getByLabelText(LightningLegend.name)).toBeTruthy();
    expect(screen.getByLabelText(HeadingLegend.name)).toBeTruthy();

    act(() => {
      (screen.getByLabelText(RadarLegend.name) as HTMLElement).click();
    });

    expect(screen.queryByLabelText(LightningLegend.name)).toBeNull();
    expect(screen.queryByLabelText(HeadingLegend.name)).toBeNull();
  });

  it("starts with heading on and lightning off", () => {
    renderWithStore(<CandidateLayers />, createTestStore());
    const lightning = screen.getByLabelText(
      LightningLegend.name
    ) as HTMLInputElement;
    const heading = screen.getByLabelText(
      HeadingLegend.name
    ) as HTMLInputElement;

    expect(lightning.checked).toBe(false);
    expect(heading.checked).toBe(true);
  });

  it("turns lightning on when its switch is clicked", () => {
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(LightningLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.lightning).toBe(true);
  });

  it("turns the core, heading, and flank off when its switch is clicked", () => {
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);
    act(() => {
      (screen.getByLabelText(HeadingLegend.name) as HTMLElement).click();
    });

    expect(store.getState().radar.heading).toBe(false);
  });
});
