// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { ClickedPoint } from "@/app/components/candidate/ClickedPoint";

// Types
import type { CandidatePoint, Sounding as SoundingT } from "@/lib/types";

/** Kansas, 12 Aug 2026 04Z, from the live route — clear air, dashes for most
 * of it, which is exactly what must not appear before a click. */
const sounding: SoundingT = {
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  freezingFt: 16390,
  bandBaseFt: 19237,
  bandTopFt: 26618,
  baseC: 34.9,
  topC: -18.1,
  levels: [{ mb: 550, tempC: -1.32, heightFt: 16966 }],
  diagnostics: noDiagnostics,
};

/** The join over the same cell. */
const here: CandidatePoint = {
  run: "2026-08-12T04:00:00.000Z",
  validTime: "2026-08-12T04:00:00.000Z",
  sceneTime: "2026-08-12T04:01:17.900Z",
  radarTime: "2026-08-12T04:00:39.000Z",
  lat: 32.05,
  lon: -101.42,
  verdict: "candidate",
  slwGM2: 140,
  cloudBaseFt: 5800,
  cloudTopC: -14,
  dbz: null,
  radarCovered: true,
};

describe("ClickedPoint", () => {
  // The column is read over the default point to warm the profile grid, and
  // that read used to draw itself: a heading, a panel of dashes and "no answer
  // for this point" about a cell nobody had picked.
  it("renders nothing before the map is clicked, warm profile or not", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<ClickedPoint />, store);

    act(() => {
      store.dispatch(soundingActions.setData(sounding));
    });

    expect(container.innerHTML).toBe("");
  });

  it("draws the column and the diagnostics once a cell is picked", () => {
    const store = createTestStore();
    renderWithStore(<ClickedPoint />, store);

    act(() => {
      store.dispatch(soundingActions.setPoint([-101.42, 32.05]));
      store.dispatch(soundingActions.setData(sounding));
    });

    expect(screen.getByText("Seeding band altitude")).toBeTruthy();
    expect(screen.getByText("Cloud and convection here")).toBeTruthy();
  });

  // The panel rules its sections off with a border on each of them, so the
  // three have to sit in that column themselves. Wrapping them in a div would
  // rule the group off as one section and lose the lines between them.
  it("puts the three readouts in the panel's own column", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<ClickedPoint />, store);

    act(() => {
      store.dispatch(soundingActions.setPoint([-101.42, 32.05]));
      store.dispatch(soundingActions.setData(sounding));
      store.dispatch(seedabilityActions.setHere(here));
    });

    expect(container.children.length).toBe(3);
  });
});
