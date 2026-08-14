// Testing
import { render, screen } from "@testing-library/react";

// ArcGIS
import { ALL_LEGENDS, CandidateLegend } from "@/lib/arcgis/legends";

// Components
import { About } from "@/app/components/about/About";

describe("About", () => {
  // The page is the only place a layer gets explained at length, so a layer
  // missing from it is a switch with nothing behind it anywhere.
  it("gives every layer a section", () => {
    render(<About />);

    for (const legend of ALL_LEGENDS) {
      expect(screen.getByText(legend.name)).toBeTruthy();
      // Four layers come off HRRR, so a feed can name more than one section.
      expect(screen.getAllByText(legend.source).length).toBeGreaterThan(0);
    }
  });

  // The panel and the page read one legend. A reader arriving from the switch
  // has to land on the sentence they came in on, not a reworded second version.
  it("opens a section with the same sentence the panel shows", () => {
    render(<About />);

    expect(screen.getByText(CandidateLegend.summary)).toBeTruthy();
  });

  it("prints every paragraph a layer carries", () => {
    render(<About />);

    for (const paragraph of CandidateLegend.detail) {
      expect(screen.getByText(paragraph)).toBeTruthy();
    }
  });

  // Modelled data on the observed map is a real exception to this repo's
  // editorial split. The panel has no room to say so, so this page must.
  it("says the liquid layer is modelled, not observed", () => {
    render(<About />);

    expect(
      screen.getAllByText(/Modelled, not observed/).length
    ).toBeGreaterThan(0);
  });

  // The one measured layer on either map — every other contour here is a
  // model's opinion.
  it("says the radar is measured, not modelled", () => {
    render(<About />);

    expect(screen.getByText(/Measured, not modelled/)).toBeTruthy();
  });

  // Radar sees falling water, not cloud water. Quiet air over a cloud is not
  // evidence about what is inside it, and the page must not imply otherwise.
  it("warns that radar is a mask, not a detector", () => {
    render(<About />);

    expect(screen.getByText(/never confirm one/)).toBeTruthy();
  });

  // The page renders no map and reads no store, which is why it needs neither a
  // provider nor a fake ArcGIS. Rendering it bare is the assertion.
  it("needs no store to render", () => {
    const { container } = render(<About />);

    expect(container.innerHTML).not.toBe("");
  });
});
