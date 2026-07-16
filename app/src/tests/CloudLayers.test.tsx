// Testing
import { fireEvent } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { interactionsActions } from "@/lib/store/features/interactions";

// Components
import { CloudLayers } from "@/app/components/CloudLayers";

const radio = (name: RegExp) => ({ name });

describe("CloudLayers", () => {
  it("offers both GOES renderings", () => {
    const { getAllByRole } = renderWithStore(
      <CloudLayers />,
      createTestStore()
    );

    expect(getAllByRole("radio").map((el) => el.textContent)).toEqual([
      "GeoColor",
      "Band 13 (Clean IR)",
    ]);
  });

  it("marks the active layer as checked", () => {
    const { getByRole } = renderWithStore(<CloudLayers />, createTestStore());

    expect(getByRole("radio", radio(/GeoColor/)).getAttribute("aria-checked")) //
      .toBe("true");
    expect(getByRole("radio", radio(/Band 13/)).getAttribute("aria-checked")) //
      .toBe("false");
  });

  it("dispatches the layer choice when a rendering is picked", () => {
    const { store, getByRole } = renderWithStore(
      <CloudLayers />,
      createTestStore()
    );

    fireEvent.click(getByRole("radio", radio(/Band 13/)));

    expect(store.getState().interactions.cloudLayer).toBe("band13");
  });

  it("follows the store when the layer changes elsewhere", () => {
    const store = createTestStore();
    store.dispatch(interactionsActions.setCloudLayer("band13"));

    const { getByRole } = renderWithStore(<CloudLayers />, store);

    expect(getByRole("radio", radio(/Band 13/)).getAttribute("aria-checked")) //
      .toBe("true");
  });

  it("shows no colour ramp for GeoColor, which is imagery not a scale", () => {
    const { container } = renderWithStore(<CloudLayers />, createTestStore());

    expect(container.querySelector("[style*='linear-gradient']")).toBeNull();
  });

  it("shows the temperature ramp for Band13", () => {
    const store = createTestStore();
    store.dispatch(interactionsActions.setCloudLayer("band13"));

    const { container } = renderWithStore(<CloudLayers />, store);

    const bar = container.querySelector("[style*='linear-gradient']");
    expect(bar).not.toBeNull();
  });

  it("labels the Band13 ramp in degrees across its real range", () => {
    const store = createTestStore();
    store.dispatch(interactionsActions.setCloudLayer("band13"));

    const { getByText } = renderWithStore(<CloudLayers />, store);

    expect(getByText("-80°")).toBeDefined();
    expect(getByText("40°")).toBeDefined();
  });

  it("marks the seeding band on the Band13 ramp", () => {
    const store = createTestStore();
    store.dispatch(interactionsActions.setCloudLayer("band13"));

    const { getByText } = renderWithStore(<CloudLayers />, store);

    expect(getByText(/−12 to −5 °C/)).toBeDefined();
  });

  it("states what each layer does not tell the operator", () => {
    const { getByText, store, rerender } = renderWithStore(
      <CloudLayers />,
      createTestStore()
    );

    expect(getByText(/not how thick it is/)).toBeDefined();

    store.dispatch(interactionsActions.setCloudLayer("band13"));
    rerender(<CloudLayers />);

    expect(getByText(/temperature of the cloud top/)).toBeDefined();
  });
});
