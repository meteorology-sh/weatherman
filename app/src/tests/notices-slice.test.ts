// Store
import reducer, { noticesActions } from "@/lib/store/features/notices";

// Types
import type { SourceNotice } from "@/lib/types";

const notice: SourceNotice = {
  id: "MRMS echo top@2026-09-11T01:18:00.000Z",
  source: "MRMS echo top",
  detail: "The live data looks wrong. Showing NOAA's archived copy.",
  delayMinutes: 4,
  since: "2026-09-11T01:18:00.000Z",
};

const initial = reducer(undefined, { type: "@@INIT" });

describe("notices slice", () => {
  it("starts with nothing to say", () => {
    expect(initial.items).toEqual([]);
    expect(initial.dismissed).toEqual([]);
  });

  it("replaces the notices whole on each poll", () => {
    const one = reducer(initial, noticesActions.setItems([notice]));
    const none = reducer(one, noticesActions.setItems([]));
    expect(one.items).toEqual([notice]);
    expect(none.items).toEqual([]);
  });

  it("remembers a closed notice while its problem lasts", () => {
    const shown = reducer(initial, noticesActions.setItems([notice]));
    const closed = reducer(shown, noticesActions.dismiss(notice.id));
    const polled = reducer(closed, noticesActions.setItems([notice]));
    expect(polled.dismissed).toEqual([notice.id]);
  });

  it("forgets a closed notice once its problem clears", () => {
    const shown = reducer(initial, noticesActions.setItems([notice]));
    const closed = reducer(shown, noticesActions.dismiss(notice.id));
    const cleared = reducer(closed, noticesActions.setItems([]));
    expect(cleared.dismissed).toEqual([]);
  });

  it("does not record the same close twice", () => {
    const shown = reducer(initial, noticesActions.setItems([notice]));
    const once = reducer(shown, noticesActions.dismiss(notice.id));
    const twice = reducer(once, noticesActions.dismiss(notice.id));
    expect(twice.dismissed).toEqual([notice.id]);
  });
});
