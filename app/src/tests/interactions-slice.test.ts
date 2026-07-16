// Store
import interactionsReducer, {
  interactionsActions,
} from "@/lib/store/features/interactions";

const initialState = interactionsReducer(undefined, { type: "@@INIT" });

describe("interactions reducer", () => {
  it("starts with no coordinates", () => {
    expect(initialState.coordinates).toBeNull();
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
