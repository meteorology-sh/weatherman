// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Sounding, heightAtC } from "@/app/components/candidate/Sounding";

// Types
import type { Sounding as SoundingT } from "@/lib/types";

const sounding: SoundingT = {
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  freezingFt: 16433,
  bandBaseFt: 18685,
  bandTopFt: 22066,
  baseC: 34.9,
  topC: -18.1,
  levels: [
    { mb: 600, tempC: 4.37, heightFt: 14665 },
    { mb: 550, tempC: -1.32, heightFt: 16966 },
    { mb: 400, tempC: -20, heightFt: 23500 },
  ],
  diagnostics: noDiagnostics,
};

const withData = (over: Partial<SoundingT> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Sounding />, store);
  act(() => {
    store.dispatch(soundingActions.setData({ ...sounding, ...over }));
  });
  return { store, container };
};

describe("heightAtC", () => {
  it("finds the −15 °C height between two levels", () => {
    expect(
      heightAtC(
        [
          { mb: 500, tempC: -10, heightFt: 18000 },
          { mb: 400, tempC: -20, heightFt: 24000 },
        ],
        -15
      )
    ).toBe(21000);
  });
});

describe("Sounding", () => {
  it("renders nothing before the profile arrives", () => {
    const { container } = renderWithStore(<Sounding />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("reports ground, freezing, −15 °C, and the seeding band", () => {
    withData();

    expect(screen.getByText("1,830 ft")).toBeTruthy();
    expect(screen.getByText("16,433 ft")).toBeTruthy();
    expect(screen.getByText("18,685–22,066 ft")).toBeTruthy();
  });
});
