// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Client
import { GetCloudCover } from "@/lib/client";

// Providers
import { WeatherProvider } from "@/lib/context/WeatherProvider";

// Store
import { weatherActions } from "@/lib/store/features/weather";

// Types
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import type { CloudCoverPoint } from "@/lib/types";

vi.mock("@/lib/client", () => ({ GetCloudCover: vi.fn() }));

const layer = { id: "cloud-layer" } as unknown as GeoJSONLayer;
const points: CloudCoverPoint[] = [
  { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
];

const mockedGetCloudCover = vi.mocked(GetCloudCover);

beforeEach(() => {
  mockedGetCloudCover.mockReset();
  mockedGetCloudCover.mockResolvedValue([layer, points]);
});

describe("WeatherProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <WeatherProvider>
        <span>child</span>
      </WeatherProvider>
    );

    expect(getByText("child")).toBeDefined();
  });

  it("loads the cloud cover on mount", async () => {
    renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => expect(mockedGetCloudCover).toHaveBeenCalled());
  });

  it("dispatches the fetched layer and points to the store", async () => {
    const { store } = renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => {
      expect(store.getState().weather.CloudPoints).toEqual(points);
    });
    expect(store.getState().weather.CloudLayer).toBe(layer);
  });

  it("clears the loading flag once the data arrives", async () => {
    const { store } = renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => {
      expect(store.getState().weather.CloudPoints).toEqual(points);
    });
    expect(store.getState().weather.loading).toBe(false);
  });

  it("skips the fetch when points are already in the store", () => {
    const store = createTestStore();
    store.dispatch(weatherActions.CloudPoints(points));

    // render() flushes effects, so the guard has already had its chance to run.
    renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>,
      store
    );

    expect(mockedGetCloudCover).not.toHaveBeenCalled();
  });

  it("dispatches the client's error message when the fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetCloudCover.mockRejectedValue(
      new Error("Failed to fetch cloud cover: 502")
    );

    const { store } = renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => {
      expect(store.getState().weather.error).toBe(
        "Failed to fetch cloud cover: 502"
      );
    });
  });

  it("dispatches a fallback message when the failure is not an Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetCloudCover.mockRejectedValue("upstream exploded");

    const { store } = renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => {
      expect(store.getState().weather.error).toBe("Failed to load data");
    });
  });

  it("clears the loading flag after a failed fetch", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedGetCloudCover.mockRejectedValue(new Error("boom"));

    const { store } = renderWithStore(
      <WeatherProvider>
        <span />
      </WeatherProvider>
    );

    await waitFor(() => expect(store.getState().weather.error).toBe("boom"));
    expect(store.getState().weather.loading).toBe(false);
  });
});
