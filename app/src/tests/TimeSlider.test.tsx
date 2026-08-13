// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { forecastActions } from "@/lib/store/features/forecast";

// Components
import { TimeSlider } from "@/app/components/TimeSlider";

// Types
import type { ForecastMeta } from "@/lib/types";

const meta: ForecastMeta = {
  run: "2026-07-17T00:00:00.000Z",
  hours: Array.from({ length: 19 }, (_, i) => i),
};

const withMeta = () => {
  const store = createTestStore();
  store.dispatch(forecastActions.setMeta(meta));
  return store;
};

describe("TimeSlider", () => {
  it("renders nothing before the metadata arrives", () => {
    const { container } = renderWithStore(<TimeSlider />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while loading", () => {
    const store = createTestStore();
    store.dispatch(forecastActions.setLoading(true));

    renderWithStore(<TimeSlider />, store);

    expect(screen.getByText(/Loading forecast/)).toBeTruthy();
  });

  it("shows the error instead of the slider", () => {
    const store = createTestStore();
    store.dispatch(forecastActions.setError("HRRR index unavailable: 404"));

    renderWithStore(<TimeSlider />, store);

    expect(screen.getByText("HRRR index unavailable: 404")).toBeTruthy();
  });

  it("calls the analysis hour by name rather than '+0 h'", () => {
    renderWithStore(<TimeSlider />, withMeta());

    expect(screen.getByText("Analysis")).toBeTruthy();
  });

  it("spans the hours the model published", () => {
    renderWithStore(<TimeSlider />, withMeta());

    const slider = screen.getByLabelText("Forecast hour") as HTMLInputElement;
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("18");
  });

  it("labels the offset once the hour moves", () => {
    const store = withMeta();

    renderWithStore(<TimeSlider />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(6));
    });

    expect(screen.getByText("+6 h")).toBeTruthy();
  });

  // The valid time is the run plus the offset — the number the operator plans
  // against. Assert the arithmetic, not just that some timestamp rendered.
  it("shows the valid time, not the run time, for the selected hour", () => {
    const store = withMeta();

    renderWithStore(<TimeSlider />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(12));
    });

    expect(screen.getByText("Fri 12:00Z")).toBeTruthy();
  });

  it("rolls the valid time past midnight into the next day", () => {
    const store = withMeta();

    renderWithStore(<TimeSlider />, store);
    act(() => {
      store.dispatch(forecastActions.setHour(18));
    });

    expect(screen.getByText("Fri 18:00Z")).toBeTruthy();
  });

  it("says it is drawing while the map catches up", () => {
    const store = withMeta();

    renderWithStore(<TimeSlider />, store);
    act(() => {
      store.dispatch(forecastActions.setDrawing(true));
    });

    expect(screen.getByText(/Drawing frame/)).toBeTruthy();
  });

  it("names the source once drawing settles", () => {
    renderWithStore(<TimeSlider />, withMeta());

    expect(screen.getByText(/HRRR run/)).toBeTruthy();
  });
});
