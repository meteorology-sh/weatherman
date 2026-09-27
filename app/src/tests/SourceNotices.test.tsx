// Testing
import { fireEvent, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Components
import { SourceNotices } from "@/app/components/panel/SourceNotices";

// Store
import { noticesActions } from "@/lib/store/features/notices";

// Types
import type { SourceNotice } from "@/lib/types";

const notice: SourceNotice = {
  id: "MRMS echo top@2026-09-11T01:18:00.000Z",
  source: "MRMS echo top",
  detail: "The live data looks wrong. Showing NOAA's archived copy.",
  delayMinutes: 4,
  since: "2026-09-11T01:18:00.000Z",
};

function withNotices(notices: SourceNotice[]) {
  const store = createTestStore();
  store.dispatch(noticesActions.setItems(notices));
  return store;
}

describe("SourceNotices", () => {
  it("renders nothing while every source is fine", () => {
    const { container } = renderWithStore(<SourceNotices />);

    expect(container.innerHTML).toBe("");
  });

  it("names the source, what went wrong, and how far behind live", () => {
    renderWithStore(<SourceNotices />, withNotices([notice]));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(
      screen.getByText("Something is wrong with MRMS echo top")
    ).toBeTruthy();
    expect(screen.getByText(notice.detail)).toBeTruthy();
    expect(screen.getByText(/4 min behind live/)).toBeTruthy();
    expect(screen.getByText(/since 01:18Z/)).toBeTruthy();
  });

  it("leaves the delay out when no older copy is drawn", () => {
    renderWithStore(
      <SourceNotices />,
      withNotices([
        { ...notice, detail: "The live request failed.", delayMinutes: null },
      ])
    );

    expect(screen.queryByText(/behind live/)).toBe(null);
  });

  it("hides a notice once it is closed", () => {
    renderWithStore(<SourceNotices />, withNotices([notice]));

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss MRMS echo top notice" })
    );

    expect(screen.queryByRole("alert")).toBe(null);
  });

  // Closing a notice is about that problem. The feed breaking again later is
  // news, and has to show.
  it("shows a new problem from the same source after the last was closed", () => {
    const store = withNotices([notice]);
    store.dispatch(noticesActions.dismiss(notice.id));
    store.dispatch(
      noticesActions.setItems([
        {
          ...notice,
          id: "MRMS echo top@2026-09-11T04:00:00.000Z",
          since: "2026-09-11T04:00:00.000Z",
        },
      ])
    );

    renderWithStore(<SourceNotices />, store);

    expect(screen.getByRole("alert")).toBeTruthy();
  });

  // Three sources down is three alerts in one place: the top one is read and
  // closed, and the next takes its place.
  it("stacks one alert per source and shows the next once the top is closed", () => {
    const sources = [
      notice,
      {
        ...notice,
        id: "NOAA HRRR@2026-09-11T01:20:00.000Z",
        source: "NOAA HRRR",
        detail: "The live request failed. Showing NOAA's archived copy.",
        delayMinutes: 60,
      },
      {
        ...notice,
        id: "GOES-East lightning@2026-09-11T01:22:00.000Z",
        source: "GOES-East lightning",
        detail: "The live request failed.",
        delayMinutes: null,
      },
    ];
    renderWithStore(<SourceNotices />, withNotices(sources));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert").textContent).toContain("MRMS echo top");
    expect(screen.getByText("1 of 3")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss MRMS echo top notice" })
    );

    expect(screen.getByRole("alert").textContent).toContain("NOAA HRRR");
    expect(screen.getByRole("alert").textContent).toContain(
      "60 min behind live"
    );
    expect(screen.getByText("1 of 2")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss NOAA HRRR notice" })
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "GOES-East lightning"
    );
    expect(screen.queryByText(/of \d/)).toBe(null);
  });

  it("keeps the alerts underneath out of reach until they reach the top", () => {
    renderWithStore(
      <SourceNotices />,
      withNotices([
        notice,
        { ...notice, id: "NOAA HRRR@x", source: "NOAA HRRR" },
      ])
    );

    expect(
      screen.queryByRole("button", { name: "Dismiss NOAA HRRR notice" })
    ).toBe(null);
  });
});
