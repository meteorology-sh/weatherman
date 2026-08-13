import { screen } from "@testing-library/react";

import { createTestStore, renderWithStore } from "./utils";
import { ReplayStatus } from "@/app/components/ReplayStatus";
import { replayActions } from "@/lib/store/features/replay";

const STATS = {
  cloudTop: { validTime: "2025-05-15T18:01:17.900Z" },
  liquid: { run: "2025-05-15T18:00:00.000Z" },
  radar: { validTime: "2025-05-15T17:59:00.000Z" },
} as unknown as Parameters<typeof replayActions.setReady>[0]["stats"];

describe("ReplayStatus", () => {
  it("says the map is building while an hour loads", () => {
    const store = createTestStore();
    store.dispatch(replayActions.setLoading(true));
    const { container } = renderWithStore(<ReplayStatus />, store);

    expect(container.querySelector(".loading-spinner")).not.toBe(null);
  });

  it("shows an error instead of spinning forever", () => {
    const store = createTestStore();
    store.dispatch(replayActions.setError("No archived MRMS scene near then"));
    renderWithStore(<ReplayStatus />, store);

    expect(screen.getByText(/No archived MRMS scene/)).toBeTruthy();
  });

  // The scan times are the point: `at` names an hour, but what drew is the
  // nearest scan either side of it, and an operator checking a replay against a
  // seeding log needs to read those rather than infer them.
  it("reports the scan time each source actually answered with", () => {
    const store = createTestStore();
    store.dispatch(
      replayActions.setReady({ at: "2025-05-15T18:00:00.000Z", stats: STATS }),
    );
    renderWithStore(<ReplayStatus />, store);

    expect(screen.getByText("15 May 2025, 18:01Z")).toBeTruthy();
    expect(screen.getByText("15 May 2025, 17:59Z")).toBeTruthy();
  });

  it("renders nothing before an hour is asked for", () => {
    const { container } = renderWithStore(<ReplayStatus />, createTestStore());

    expect(container.innerHTML).toBe("");
  });
});
