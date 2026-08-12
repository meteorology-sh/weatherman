// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { pirepActions } from "@/lib/store/features/pirep";

// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/renderers";

// Components
import { Pireps } from "@/app/components/Pireps";

// Types
import type { IcingStats } from "@/lib/types";

const stats: IcingStats = {
  fetchedAt: "2026-08-12T03:30:00.000Z",
  windowHours: 12,
  reports: 400,
  icing: 38,
  positive: 20,
  inBand: 3,
  latest: "2026-08-12T03:20:00.000Z",
};

const withStats = (over: Partial<IcingStats> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Pireps />, store);
  act(() => {
    store.dispatch(pirepActions.setStats({ ...stats, ...over }));
  });
  return { store, container };
};

describe("Pireps", () => {
  it("renders nothing before the stats arrive", () => {
    const { container } = renderWithStore(<Pireps />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the feed is being read", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<Pireps />, store);
    act(() => {
      store.dispatch(pirepActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when the feed is down", () => {
    const store = createTestStore();

    renderWithStore(<Pireps />, store);
    act(() => {
      store.dispatch(pirepActions.setError("Icing PIREPs unavailable: 503"));
    });

    expect(screen.getByText("Icing PIREPs unavailable: 503")).toBeTruthy();
  });

  // The denominator is the honesty of this panel: 20 hits reads as an icing
  // map, "20 of 400" reads as the spot-check it is.
  it("reports the hits against every PIREP filed", () => {
    withStats();

    expect(screen.getByText("20 of 400")).toBeTruthy();
  });

  it("names the window those counts cover", () => {
    withStats();

    expect(
      screen.getByText(/PIREPs filed over the country in 12 h/)
    ).toBeTruthy();
  });

  it("counts the aircraft that reported no ice", () => {
    withStats();

    // 38 icing reports, 20 positive.
    expect(screen.getByText(/18 reported none/)).toBeTruthy();
  });

  // Ice at -24 C confirms an aircraft iced up, not that anything is left to
  // seed, so the in-band count is its own number.
  it("counts the confirmations that land in the seeding band", () => {
    withStats();

    expect(screen.getByText("3")).toBeTruthy();
    expect(
      screen.getByText(`Confirmed liquid water at ${BAND_LABEL}`)
    ).toBeTruthy();
  });

  it("says so when every confirmation was outside the band", () => {
    withStats({ inBand: 0 });

    expect(screen.getByText(/outside the band worth seeding/)).toBeTruthy();
  });

  it("reports when the most recent confirmation came in", () => {
    withStats();

    expect(screen.getByText("2026-08-12 03:20Z")).toBeTruthy();
  });

  // An empty feed is the normal case, especially in summer. It must not read as
  // "no icing over the country" — nobody looked in most of it.
  it("says an empty feed is not evidence of no icing", () => {
    withStats({ positive: 0, inBand: 0, latest: null });

    expect(screen.getByText(/not evidence there is none/)).toBeTruthy();
  });

  it("still shows how many aircraft did report when none found ice", () => {
    withStats({ positive: 0, inBand: 0, latest: null });

    expect(screen.getByText(/400 PIREPs filed/)).toBeTruthy();
  });

  it("goes quiet when the layer is switched off", () => {
    const { store, container } = withStats();
    act(() => {
      store.dispatch(pirepActions.setVisible(false));
    });

    expect(container.innerHTML).toBe("");
  });
});
