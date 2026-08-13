import { screen, fireEvent } from "@testing-library/react";

import { createTestStore, renderWithStore } from "./utils";
import { ReplayCalendar } from "@/app/components/ReplayCalendar";
import { replayActions } from "@/lib/store/features/replay";

describe("ReplayCalendar", () => {
  it("opens on a chosen hour's month", () => {
    const store = createTestStore();
    store.dispatch(replayActions.setAt("2025-05-15T18:00:00.000Z"));
    renderWithStore(<ReplayCalendar />, store);

    expect(screen.getByText("May 2025")).toBeTruthy();
  });

  it("puts the chosen hour into the store when a day is clicked", () => {
    const store = createTestStore();
    store.dispatch(replayActions.setAt("2025-05-15T18:00:00.000Z"));
    renderWithStore(<ReplayCalendar />, store);

    fireEvent.click(screen.getByRole("button", { name: "20" }));

    expect(store.getState().replay.at).toBe("2025-05-20T18:00:00.000Z");
  });

  it("re-requests the same day when the hour changes", () => {
    // Changing the hour of an already-chosen day is a new request, not a
    // pending edit — otherwise the map and the picker disagree.
    const store = createTestStore();
    store.dispatch(replayActions.setAt("2025-05-15T18:00:00.000Z"));
    renderWithStore(<ReplayCalendar />, store);

    fireEvent.change(screen.getByLabelText("Hour (UTC)"), {
      target: { value: "6" },
    });

    expect(store.getState().replay.at).toBe("2025-05-15T06:00:00.000Z");
  });

  it("disables days before GOES-19 became GOES-East", () => {
    // Earlier dates would 404 the cloud-top layer while the other two answered,
    // which reads as a broken map rather than a boundary.
    const store = createTestStore();
    store.dispatch(replayActions.setAt("2025-04-15T18:00:00.000Z"));
    renderWithStore(<ReplayCalendar />, store);

    const before = screen.getByRole("button", {
      name: "1",
    }) as HTMLButtonElement;
    const after = screen.getByRole("button", {
      name: "15",
    }) as HTMLButtonElement;
    expect(before.disabled).toBe(true);
    expect(after.disabled).toBe(false);
  });

  it("disables the future", () => {
    const store = createTestStore();
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 1, 15);
    store.dispatch(replayActions.setAt(next.toISOString()));
    renderWithStore(<ReplayCalendar />, store);

    const day = screen.getByRole("button", { name: "15" }) as HTMLButtonElement;
    expect(day.disabled).toBe(true);
  });

  it("clears back to live", () => {
    const store = createTestStore();
    store.dispatch(replayActions.setAt("2025-05-15T18:00:00.000Z"));
    renderWithStore(<ReplayCalendar />, store);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(store.getState().replay.at).toBe(null);
  });
});
