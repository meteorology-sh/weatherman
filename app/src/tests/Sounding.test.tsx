// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Sounding } from "@/app/components/candidate/Sounding";

// Types
import type { Sounding as SoundingT } from "@/lib/types";

/** Kansas, 12 Aug 2026 04Z, from the live route. */
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

describe("Sounding", () => {
  it("renders nothing before the profile arrives", () => {
    const { container } = renderWithStore(<Sounding />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the column is being read", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<Sounding />, store);
    act(() => {
      store.dispatch(soundingActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when the profile fails", () => {
    const store = createTestStore();

    renderWithStore(<Sounding />, store);
    act(() => {
      store.dispatch(
        soundingActions.setError(
          "No HRRR data at 21, -158 — the domain is CONUS"
        )
      );
    });

    expect(
      screen.getByText("No HRRR data at 21, -158 — the domain is CONUS")
    ).toBeTruthy();
  });

  // The number in the flight plan: the altitudes between the two isotherms.
  it("reports the band as the altitudes to fly between", () => {
    withData();

    expect(screen.getByText("18,685–22,066 ft")).toBeTruthy();
  });

  it("reports the freezing level against the ground under it", () => {
    withData();

    expect(screen.getByText("16,433 ft")).toBeTruthy();
    expect(screen.getByText(/Ground is at 1,830 ft/)).toBeTruthy();
  });

  // Two opposite reasons the band can be missing. An arctic column really is
  // too cold to seed; a column we did not read high enough is a limit of ours.
  // Reporting them the same way is how a false negative gets shipped.
  it("says the air is too cold when the column's base is below the band", () => {
    withData({ bandBaseFt: null, bandTopFt: null, baseC: -22, topC: -40 });

    expect(
      screen.getByText(/colder than the band all the way down/)
    ).toBeTruthy();
  });

  it("blames the levels read, not the sky, when the band is above the column", () => {
    withData({ bandBaseFt: null, bandTopFt: null, baseC: 20, topC: -2 });

    expect(screen.getByText(/a limit of the levels read/)).toBeTruthy();
  });

  it("does not call a too-cold column a missing band", () => {
    withData({ bandBaseFt: null, bandTopFt: null, baseC: -22, topC: -40 });

    expect(screen.queryByText(/limit of the levels read/)).toBeNull();
  });

  // A winter airmass already inside the band at the surface has no −5 °C
  // crossing to find, and the band runs from the ground up. Reporting that as
  // "no band" would hide the column with the most seedable air in it.
  it("reports a band that reaches the bottom of the column", () => {
    withData({
      bandBaseFt: null,
      bandTopFt: 9000,
      baseC: -8,
      topC: -40,
      levels: [
        { mb: 1013.2, tempC: -8, heightFt: 500 },
        { mb: 900, tempC: -14, heightFt: 3500 },
      ],
    });

    expect(screen.getByText("500–9,000 ft")).toBeTruthy();
    expect(
      screen.getByText(/In band from the bottom of the column up/)
    ).toBeTruthy();
  });

  it("does not call that column bandless", () => {
    withData({
      bandBaseFt: null,
      bandTopFt: 9000,
      baseC: -8,
      topC: -40,
      levels: [{ mb: 1013.2, tempC: -8, heightFt: 500 }],
    });

    expect(
      screen.queryByText(/colder than the band all the way down/)
    ).toBeNull();
  });

  // HRRR extrapolates pressure levels below ground, so an isotherm can come back
  // as a real number that is inside a mountain.
  it("warns when the band starts below the terrain", () => {
    withData({ bandBaseFt: 900, bandTopFt: 4000, surfaceFt: 9000 });

    expect(screen.getByText(/starts below ground here/)).toBeTruthy();
  });

  it("does not warn about terrain when the band is in free air", () => {
    withData();

    expect(screen.queryByText(/starts below ground here/)).toBeNull();
  });

  // The readout is about a 3 km cell, not about the pixel that was clicked,
  // and saying otherwise would imply a precision the grid does not have.
  it("reports the cell it sampled, not the click", () => {
    withData();

    expect(screen.getByText(/Sampled at 39.8, -98.54/)).toBeTruthy();
    expect(screen.getByText(/not the click itself/)).toBeTruthy();
  });
});
