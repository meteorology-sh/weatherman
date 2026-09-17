// Testing
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { warningsActions } from "@/lib/store/features/warnings";
import { replayActions } from "@/lib/store/features/replay";

// ArcGIS
import { WarningLegend } from "@/lib/arcgis/legends";

// Components
import { WarningToggle } from "@/app/components/panel/WarningToggle";
import { CandidateLayers } from "@/app/components/candidate/CandidateLayers";
import { ReplayLayers } from "@/app/components/replay/ReplayLayers";

// Types
import type { WarningStats } from "@/lib/types";

const WARNINGS: WarningStats = {
  validTime: "2025-04-26T22:44:00.000Z",
  fetchedAt: "2026-09-16T22:30:00.000Z",
  count: 5,
  severe: 4,
  tornado: 1,
  flood: 0,
};

const NONE: WarningStats = {
  ...WARNINGS,
  count: 0,
  severe: 0,
  tornado: 0,
  flood: 0,
};

const NAME = WarningLegend.name;

describe("WarningToggle", () => {
  it("renders nothing while no warning is in force", () => {
    const { container } = render(
      <WarningToggle stats={NONE} checked onChange={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing before the count has arrived", () => {
    const { container } = render(
      <WarningToggle stats={undefined} checked onChange={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("offers the layer and says what is in force", () => {
    render(<WarningToggle stats={WARNINGS} checked onChange={() => {}} />);

    expect(screen.getByLabelText(NAME)).toBeTruthy();
    expect(
      screen.getByText(
        "4 severe thunderstorm warnings, 1 tornado warning in force at 22:44Z."
      )
    ).toBeTruthy();
  });

  it("names flash flood warnings with the rest", () => {
    render(
      <WarningToggle
        stats={{ ...WARNINGS, count: 6, flood: 1 }}
        checked
        onChange={() => {}}
      />
    );

    expect(
      screen.getByText(
        "4 severe thunderstorm warnings, 1 tornado warning, 1 flash flood warning in force at 22:44Z."
      )
    ).toBeTruthy();
  });

  it("reports the switch", () => {
    const onChange = vi.fn();
    render(<WarningToggle stats={WARNINGS} checked onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(NAME));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  // No switch reads as "no warnings", which a failed read does not know.
  it("says so when the warnings could not be read", () => {
    render(<WarningToggle stats={null} checked onChange={() => {}} />);
    expect(
      screen.getByText("Severe weather warnings could not be read.")
    ).toBeTruthy();
    expect(screen.queryByLabelText(NAME)).toBe(null);
  });
});

describe("the warning switch on each map", () => {
  it("appears on the candidate map only once a warning is in force", () => {
    const store = createTestStore();
    renderWithStore(<CandidateLayers />, store);

    expect(screen.queryByLabelText(NAME)).toBe(null);

    act(() => {
      store.dispatch(warningsActions.setStats(NONE));
    });
    expect(screen.queryByLabelText(NAME)).toBe(null);

    act(() => {
      store.dispatch(warningsActions.setStats(WARNINGS));
    });
    fireEvent.click(screen.getByLabelText(NAME));
    expect(store.getState().warnings.visible).toBe(false);
  });

  it("reports a failed live read on the candidate map", () => {
    const store = createTestStore();
    store.dispatch(warningsActions.setError("boom"));
    renderWithStore(<CandidateLayers />, store);

    expect(
      screen.getByText("Severe weather warnings could not be read.")
    ).toBeTruthy();
  });

  it("appears on the replay map only when the hour had a warning", () => {
    const store = createTestStore();
    const stats = { warnings: NONE } as unknown as Parameters<
      typeof replayActions.setReady
    >[0]["stats"];
    store.dispatch(replayActions.setReady({ at: WARNINGS.validTime, stats }));
    renderWithStore(<ReplayLayers />, store);

    expect(screen.queryByLabelText(NAME)).toBe(null);

    act(() => {
      store.dispatch(
        replayActions.setReady({
          at: WARNINGS.validTime,
          stats: { ...stats, warnings: WARNINGS },
        })
      );
    });
    fireEvent.click(screen.getByLabelText(NAME));
    expect(store.getState().replay.warnings).toBe(false);
  });
});
