// Testing
import { render, screen } from "@testing-library/react";

// ArcGIS
import { ALL_LEGENDS, CandidateLegend } from "@/lib/arcgis/legends";

// Components
import { About } from "@/app/components/about/About";

describe("About", () => {
  it("gives every layer a section", () => {
    render(<About />);

    for (const legend of ALL_LEGENDS) {
      expect(screen.getByText(legend.name)).toBeTruthy();
      expect(screen.getAllByText(legend.source).length).toBeGreaterThan(0);
    }
  });

  it("opens a section with the same sentence the panel shows", () => {
    render(<About />);

    expect(screen.getByText(CandidateLegend.summary)).toBeTruthy();
  });

  it("prints every fact a layer carries", () => {
    render(<About />);

    for (const line of CandidateLegend.detail) {
      expect(screen.getByText(line)).toBeTruthy();
    }
  });

  // The page carries both kinds of layer, and which is which is the one
  // thing an operator has to be able to tell from reading it.
  it("says the cloud-base layer is modeled", () => {
    render(<About />);

    expect(screen.getAllByText(/model/i).length).toBeGreaterThan(0);
  });

  it("says the radar is measured", () => {
    render(<About />);

    expect(screen.getAllByText(/measured/i).length).toBeGreaterThan(0);
  });

  // FLY is the one figure on the click panel that is not an approximation,
  // and the page has to say so plainly or the section below reads as a
  // caveat on the call itself.
  it("defines FLY as the cell being green", () => {
    render(<About />);

    expect(screen.getByText(/the cell you clicked is green/)).toBeTruthy();
  });

  // The approximations sit last, after every layer, because they are read
  // once the layers make sense — and each one has to name its cost rather
  // than only its shortcut.
  it("lists what a click approximates, under the layers", () => {
    const { container } = render(<About />);

    const headings = Array.from(container.querySelectorAll("h2")).map(
      (h) => h.textContent
    );
    expect(headings[headings.length - 1]).toBe("What a Click Reports");
    expect(screen.getByText(/nearest edge of the storm outline/)).toBeTruthy();
    expect(screen.getByText(/within 40 km/)).toBeTruthy();
    expect(screen.getByText(/the model is wrong/)).toBeTruthy();
  });

  it("needs no store to render", () => {
    const { container } = render(<About />);

    expect(container.innerHTML).not.toBe("");
  });
});
