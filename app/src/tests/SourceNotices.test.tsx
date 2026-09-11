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
});
