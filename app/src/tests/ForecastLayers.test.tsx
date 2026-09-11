// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { forecastActions } from "@/lib/store/features/forecast";

// ArcGIS
import {
  BAND_LABEL,
  CLOUD_BANDS,
  COLORS,
  PRECIP_BANDS,
  SLW_BANDS,
  stackedColor,
} from "@/lib/arcgis/bands";

// ArcGIS
import { LiquidLegend, PrecipLegend } from "@/lib/arcgis/legends";

// Components
import { ForecastLayers } from "@/app/components/forecast/ForecastLayers";

const swatches = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("div.h-4"));

/** jsdom re-prints rgba() with spaces; compare the color, not the spacing. */
const rgba = (css: string) => css.replace(/\s+/g, "");

describe("ForecastLayers", () => {
  it("shows a swatch for every band of both layers", () => {
    const { container } = renderWithStore(
      <ForecastLayers />,
      createTestStore()
    );

    expect(swatches(container)).toHaveLength(
      CLOUD_BANDS.length + PRECIP_BANDS.length
    );
  });

  it("labels the precipitation bands in mm/hr", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(1));
    });

    expect(screen.getByText("7.6")).toBeTruthy();
    // The unit line under the ramp, and the collapse behind it, both say mm/hr.
    expect(screen.getAllByText(/mm\/hr/).length).toBeGreaterThan(0);
  });

  // The swatch has to be the color the map paints, not a hand-picked one, or
  // the legend quietly stops describing the map.
  it("paints each swatch the color the map composites", () => {
    const { container } = renderWithStore(
      <ForecastLayers />,
      createTestStore()
    );

    const precipSwatches = swatches(container).slice(CLOUD_BANDS.length);
    const heaviest = precipSwatches[precipSwatches.length - 1];
    expect(rgba(heaviest.style.backgroundColor)).toBe(
      rgba(stackedColor(PRECIP_BANDS, COLORS.rain, PRECIP_BANDS.length))
    );
  });

  it("hides the precipitation ramp when the layer is off", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });

    expect(swatches(container)).toHaveLength(CLOUD_BANDS.length);
  });

  it("keeps the cloud ramp when precipitation is off", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });

    expect(screen.getByText("90%")).toBeTruthy();
  });

  it("drives the toggle from the store", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    const toggle = screen.getByLabelText(PrecipLegend.name) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });

    expect(toggle.checked).toBe(false);
  });

  it("turns the layer off when the toggle is clicked", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    const toggle = screen.getByLabelText(PrecipLegend.name) as HTMLInputElement;
    act(() => {
      toggle.click();
    });

    expect(store.getState().forecast.precip).toBe(false);
  });

  // Otherwise an empty cyan layer at f00 reads as "it is not going to rain",
  // which is a different claim than "the model has not worked it out yet".
  it("explains why the analysis hour has no precipitation", () => {
    renderWithStore(<ForecastLayers />, createTestStore());

    expect(screen.getByText(/Analysis hour: 0 mm\/hr/)).toBeTruthy();
  });

  it("drops the explanation once the model has precipitation", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(1));
    });

    expect(screen.queryByText(/Analysis hour: 0 mm\/hr/)).toBeNull();
  });

  it("does not explain a layer that is switched off", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
    });

    expect(screen.queryByText(/Analysis hour: 0 mm\/hr/)).toBeNull();
  });

  // A ramp at full strength while the layer cannot paint is the legend
  // advertising something the map is not showing.
  it("mutes the precipitation ramp at the hour it cannot draw", () => {
    const { container } = renderWithStore(
      <ForecastLayers />,
      createTestStore()
    );

    const ramps = container.querySelectorAll(".opacity-30");
    expect(ramps).toHaveLength(1);
  });

  it("un-mutes the ramp once the layer can draw", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(1));
    });

    expect(container.querySelectorAll(".opacity-30")).toHaveLength(0);
  });

  // The explanation names the fix, so it should be able to perform it.
  it("steps to the first modeled hour when the operator takes the offer", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      screen.getByText("+1 h").click();
    });

    expect(store.getState().forecast.hour).toBe(1);
  });
});

// The forecast map's third layer, and the only one on it that is off on
// arrival: cloud and rain are what this map is, and this is a seeding reading
// taken on the same run.
describe("ForecastLayers supercooled liquid", () => {
  const LIQUID = LiquidLegend.name;

  it("offers the layer, switched off", () => {
    renderWithStore(<ForecastLayers />, createTestStore());

    expect((screen.getByLabelText(LIQUID) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it("turns the layer on when its switch is clicked", () => {
    const store = createTestStore();

    renderWithStore(<ForecastLayers />, store);
    act(() => {
      (screen.getByLabelText(LIQUID) as HTMLElement).click();
    });

    expect(store.getState().forecast.liquid).toBe(true);
  });

  // Off on arrival, so the panel opens on the two ramps it always had.
  it("keeps its ramp out of the panel until it is asked for", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    expect(swatches(container)).toHaveLength(
      CLOUD_BANDS.length + PRECIP_BANDS.length
    );

    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(swatches(container)).toHaveLength(
      CLOUD_BANDS.length + PRECIP_BANDS.length + SLW_BANDS.length
    );
  });

  it("paints each swatch the color the map composites", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
      store.dispatch(forecastActions.setLiquid(true));
    });

    const liquid = swatches(container).slice(CLOUD_BANDS.length);
    const richest = liquid[liquid.length - 1];
    expect(rgba(richest.style.backgroundColor)).toBe(
      rgba(stackedColor(SLW_BANDS, COLORS.liquid, SLW_BANDS.length))
    );
  });

  // g/m² is a column amount over ground, not a concentration and not an area.
  it("says the figure is per square meter of ground, over the band", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(container.textContent).toContain("g/m² of ground");
    expect(container.textContent).toContain(BAND_LABEL);
    expect(container.textContent).not.toContain("g/m³");
  });

  // Unlike precipitation, which HRRR only has once it steps forward. A blanked
  // ramp here would say the model has nothing at f00, which is false.
  it("draws at the analysis hour, where precipitation cannot", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<ForecastLayers />, store);
    act(() => {
      store.dispatch(forecastActions.setPrecip(false));
      store.dispatch(forecastActions.setLiquid(true));
    });

    expect(store.getState().forecast.hour).toBe(0);
    expect(container.querySelectorAll(".opacity-30")).toHaveLength(0);
  });
});
