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

  it("says the cloud-base layer is modelled", () => {
    render(<About />);

    expect(screen.getAllByText(/Modelled/).length).toBeGreaterThan(0);
  });

  it("says the radar is measured", () => {
    render(<About />);

    expect(screen.getByText(/Measured, not modelled/)).toBeTruthy();
  });

  it("needs no store to render", () => {
    const { container } = render(<About />);

    expect(container.innerHTML).not.toBe("");
  });
});
