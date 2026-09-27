// Testing
import { act, waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { NoticeProvider, NOTICE_POLL_MS } from "@/lib/context/NoticeProvider";

// Types
import type { SourceNotice } from "@/lib/types";

const notice: SourceNotice = {
  id: "MRMS echo top@2026-09-11T01:18:00.000Z",
  source: "MRMS echo top",
  detail: "The live data looks wrong. Showing NOAA's archived copy.",
  delayMinutes: 4,
  since: "2026-09-11T01:18:00.000Z",
};

function answer(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 503,
      json: async () => body,
    }))
  );
}

beforeEach(() => {
  answer([notice]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NoticeProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <NoticeProvider>
        <span>child</span>
      </NoticeProvider>
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the server's notices in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <NoticeProvider>
        <span />
      </NoticeProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().notices.items).toEqual([notice]);
    });
    expect(fetch).toHaveBeenCalledWith("/status/notices");
  });

  // A feed can recover while the page sits open, and a notice that outlived
  // the problem would be as wrong as a missing one.
  it("asks again on the next tick, so a recovered feed clears", async () => {
    vi.useFakeTimers();
    const store = createTestStore();

    renderWithStore(
      <NoticeProvider>
        <span />
      </NoticeProvider>,
      store
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(store.getState().notices.items).toEqual([notice]);

    answer([]);
    await act(() => vi.advanceTimersByTimeAsync(NOTICE_POLL_MS));

    expect(store.getState().notices.items).toEqual([]);
  });

  it("keeps the last answer when a poll fails", async () => {
    vi.useFakeTimers();
    const store = createTestStore();

    renderWithStore(
      <NoticeProvider>
        <span />
      </NoticeProvider>,
      store
    );
    await act(() => vi.advanceTimersByTimeAsync(0));

    answer({}, false);
    await act(() => vi.advanceTimersByTimeAsync(NOTICE_POLL_MS));

    expect(store.getState().notices.items).toEqual([notice]);
  });

  it("stops asking once the map closes", async () => {
    vi.useFakeTimers();

    const { unmount } = renderWithStore(
      <NoticeProvider>
        <span />
      </NoticeProvider>
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    unmount();
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(() => vi.advanceTimersByTimeAsync(NOTICE_POLL_MS * 3));

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
