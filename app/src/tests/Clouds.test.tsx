// Testing
import { fireEvent } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { weatherActions } from "@/lib/store/features/weather";

// Types
import type { CloudCoverPoint } from "@/lib/types";

// Components
import { Clouds } from "@/app/components/Clouds";

function point(
  lat: number,
  lon: number,
  cloudCover: number
): CloudCoverPoint {
  return { lat, lon, cloudCover, time: "2026-07-16T06:15" };
}

/** A store already holding the given points, as WeatherProvider would leave it. */
function storeWith(points: CloudCoverPoint[]) {
  const store = createTestStore();
  store.dispatch(weatherActions.CloudPoints(points));
  return store;
}

describe("Clouds", () => {
  it("shows a spinner while loading", () => {
    const store = createTestStore();
    store.dispatch(weatherActions.setLoading(true));

    const { getByText } = renderWithStore(<Clouds />, store);

    expect(getByText("Loading cloud cover...")).toBeDefined();
  });

  it("shows the error message when the load failed", () => {
    const store = createTestStore();
    store.dispatch(weatherActions.setError("Failed to fetch cloud cover: 502"));

    const { getByText } = renderWithStore(<Clouds />, store);

    expect(getByText("Failed to fetch cloud cover: 502")).toBeDefined();
  });

  it("prefers the spinner over the stats while a reload is in flight", () => {
    const store = storeWith([point(40, -100, 75)]);
    store.dispatch(weatherActions.setLoading(true));

    const { getByText, queryByText } = renderWithStore(<Clouds />, store);

    expect(getByText("Loading cloud cover...")).toBeDefined();
    expect(queryByText("Grid points")).toBeNull();
  });

  it("renders nothing before any points arrive", () => {
    const { container } = renderWithStore(<Clouds />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the grid comes back empty", () => {
    const { container } = renderWithStore(<Clouds />, storeWith([]));

    expect(container.innerHTML).toBe("");
  });

  it("reports the number of grid points", () => {
    const store = storeWith([point(40, -100, 75), point(30, -90, 10)]);

    const { getByText } = renderWithStore(<Clouds />, store);

    expect(getByText("2")).toBeDefined();
  });

  it("rounds the national average cloud cover", () => {
    const store = storeWith([point(40, -100, 75), point(30, -90, 10)]);

    const { getByText } = renderWithStore(<Clouds />, store);

    // (75 + 10) / 2 = 42.5, rounded to 43
    expect(getByText("43%")).toBeDefined();
  });

  it("reports the observation time of the grid", () => {
    const store = storeWith([point(40, -100, 75)]);

    const { getByText } = renderWithStore(<Clouds />, store);

    expect(getByText(/Observed 2026-07-16T06:15 UTC/)).toBeDefined();
  });

  it("lists the cloudiest points first", () => {
    const store = storeWith([
      point(30, -90, 10),
      point(40, -100, 75),
      point(46, -70, 50),
    ]);

    const { getAllByRole } = renderWithStore(<Clouds />, store);

    const covers = getAllByRole("button").map(
      (button) => button.textContent?.match(/(\d+)%$/)?.[1]
    );
    expect(covers).toEqual(["75", "50", "10"]);
  });

  it("lists at most the ten cloudiest points", () => {
    const points = Array.from({ length: 12 }, (_, index) =>
      point(30 + index, -100, index * 5)
    );

    const { getAllByRole } = renderWithStore(<Clouds />, storeWith(points));

    expect(getAllByRole("button")).toHaveLength(10);
  });

  it("labels each point with its coordinates and cloud cover", () => {
    const store = storeWith([point(40.25, -100.75, 75)]);

    const { getByRole } = renderWithStore(<Clouds />, store);

    expect(getByRole("button").textContent).toBe("40.3°, -100.8°75%");
  });

  it("dispatches lon/lat coordinates when a point is clicked", () => {
    const store = storeWith([point(40, -100, 75)]);

    const { getByRole } = renderWithStore(<Clouds />, store);
    fireEvent.click(getByRole("button"));

    expect(store.getState().interactions.coordinates).toEqual([-100, 40]);
  });

  it("does not reorder the points held in the store", () => {
    const store = storeWith([
      point(30, -90, 10),
      point(40, -100, 75),
      point(46, -70, 50),
    ]);

    renderWithStore(<Clouds />, store);

    expect(
      store.getState().weather.CloudPoints?.map((p) => p.cloudCover)
    ).toEqual([10, 75, 50]);
  });
});
