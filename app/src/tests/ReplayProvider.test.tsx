import { waitFor } from "@testing-library/react";

import { createTestStore, renderWithStore } from "./utils";
import { ReplayProvider } from "@/lib/context/ReplayProvider";
import { replayActions } from "@/lib/store/features/replay";

const AT = "2025-05-15T18:00:00.000Z";

const cloudTop = { validTime: "2025-05-15T18:01:17.900Z", cloudPct: 55.68 };
const cloudBase = { run: AT, basePct: 39.1 };
const liquid = { run: AT, coveragePct: 3.54 };
const radar = { validTime: "2025-05-15T17:59:00.000Z", echoPct: 2.09 };

function mockStats() {
  return vi.fn(async (url: string) => {
    const body = url.startsWith("/cloudtop")
      ? cloudTop
      : url.startsWith("/candidate/cloudbase")
        ? cloudBase
        : url.startsWith("/forecast")
          ? liquid
          : radar;
    return { ok: true, json: async () => body } as Response;
  });
}

describe("ReplayProvider", () => {
  it("fetches nothing until an hour is picked", () => {
    const fetchMock = mockStats();
    vi.stubGlobal("fetch", fetchMock);

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, createTestStore());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks every source for the chosen hour", async () => {
    const fetchMock = mockStats();
    vi.stubGlobal("fetch", fetchMock);
    const store = createTestStore();

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, store);
    store.dispatch(replayActions.setAt(AT));

    await waitFor(() => expect(store.getState().replay.ready).toBe(AT));

    const asked = fetchMock.mock.calls.map((call) => call[0] as string);
    const at = encodeURIComponent(AT);
    expect(asked).toContain(`/cloudtop/temperature/stats?at=${at}`);
    expect(asked).toContain(`/forecast/liquid/stats?hour=0&at=${at}`);
    expect(asked).toContain(`/radar/reflectivity/stats?at=${at}`);
    expect(asked).toContain(`/candidate/cloudbase/stats?at=${at}`);
  });

  // Awaiting every one of them is what makes the layers appear together: the stats
  // routes build the same cached scenes the geometry routes serve.
  it("does not release the map until every source has answered", async () => {
    let releaseRadar: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/radar")) {
          return new Promise<Response>((resolve) => {
            releaseRadar = resolve;
          });
        }
        const body = url.startsWith("/cloudtop")
          ? cloudTop
          : url.startsWith("/candidate/cloudbase")
            ? cloudBase
            : liquid;
        return { ok: true, json: async () => body } as Response;
      })
    );
    const store = createTestStore();

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, store);
    store.dispatch(replayActions.setAt(AT));

    await waitFor(() => expect(store.getState().replay.loading).toBe(true));
    expect(store.getState().replay.ready).toBe(null);

    releaseRadar({ ok: true, json: async () => radar } as Response);

    await waitFor(() => expect(store.getState().replay.ready).toBe(AT));
    expect(store.getState().replay.loading).toBe(false);
  });

  it("records what each source reported", async () => {
    vi.stubGlobal("fetch", mockStats());
    const store = createTestStore();

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, store);
    store.dispatch(replayActions.setAt(AT));

    await waitFor(() => expect(store.getState().replay.stats).not.toBe(null));
    expect(store.getState().replay.stats!.cloudTop.validTime).toBe(
      "2025-05-15T18:01:17.900Z"
    );
    expect(store.getState().replay.stats!.radar.validTime).toBe(
      "2025-05-15T17:59:00.000Z"
    );
    expect(store.getState().replay.stats!.cloudBase.run).toBe(AT);
  });

  it("reports a failure instead of leaving the spinner running", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response)
    );
    const store = createTestStore();

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, store);
    store.dispatch(replayActions.setAt(AT));

    await waitFor(() => expect(store.getState().replay.error).not.toBe(null));
    expect(store.getState().replay.loading).toBe(false);
    expect(store.getState().replay.ready).toBe(null);
  });

  it("refetches when a new hour is picked", async () => {
    const fetchMock = mockStats();
    vi.stubGlobal("fetch", fetchMock);
    const store = createTestStore();

    renderWithStore(<ReplayProvider>{null}</ReplayProvider>, store);
    store.dispatch(replayActions.setAt(AT));
    await waitFor(() => expect(store.getState().replay.ready).toBe(AT));

    const next = "2025-05-16T18:00:00.000Z";
    store.dispatch(replayActions.setAt(next));
    await waitFor(() => expect(store.getState().replay.ready).toBe(next));

    const asked = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(asked.some((url) => url.includes(encodeURIComponent(next)))).toBe(
      true
    );
  });
});
