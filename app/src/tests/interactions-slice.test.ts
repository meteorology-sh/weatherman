// Store
import interactionsReducer, {
  interactionsActions,
} from "@/lib/store/features/interactions";

const initialState = interactionsReducer(undefined, { type: "@@INIT" });

describe("interactions reducer", () => {
  it("starts with no coordinates", () => {
    expect(initialState.coordinates).toBeNull();
  });

  it("starts on the GeoColor imagery", () => {
    expect(initialState.cloudLayer).toBe("geocolor");
  });

  it("switches the cloud layer", () => {
    const state = interactionsReducer(
      initialState,
      interactionsActions.setCloudLayer("band13")
    );

    expect(state.cloudLayer).toBe("band13");
  });

  it("keeps the selected coordinates when the layer changes", () => {
    const selected = interactionsReducer(
      initialState,
      interactionsActions.setCoordinates([-100, 40])
    );

    const state = interactionsReducer(
      selected,
      interactionsActions.setCloudLayer("band13")
    );

    expect(state.coordinates).toEqual([-100, 40]);
  });

  it("stores the selected coordinates", () => {
    const state = interactionsReducer(
      initialState,
      interactionsActions.setCoordinates([-100, 40])
    );

    expect(state.coordinates).toEqual([-100, 40]);
  });

  it("clears the selected coordinates", () => {
    const selected = interactionsReducer(
      initialState,
      interactionsActions.setCoordinates([-100, 40])
    );

    const state = interactionsReducer(
      selected,
      interactionsActions.setCoordinates(null)
    );

    expect(state.coordinates).toBeNull();
  });

  it("replaces the previous coordinates on a new selection", () => {
    const first = interactionsReducer(
      initialState,
      interactionsActions.setCoordinates([-100, 40])
    );

    const state = interactionsReducer(
      first,
      interactionsActions.setCoordinates([-90, 30])
    );

    expect(state.coordinates).toEqual([-90, 30]);
  });
});
