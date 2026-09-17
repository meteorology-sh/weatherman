// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Local
import { warningsOf, warningsPath } from "./warnings.mjs";

const ring = [
  [-103.61234, 31.03],
  [-103.58, 31.14],
  [-103.28, 31.21],
  [-103.61234, 31.03],
];

const feature = (phenomenon, geometry) => ({
  type: "Feature",
  properties: {
    phenomenon,
    event: "Severe Thunderstorm Warning",
    office: "MAF",
    eventId: 102,
  },
  geometry,
});

describe("warningsOf", () => {
  it("keeps each warning with its kind and rounded rings", () => {
    const marks = warningsOf({
      validTime: "2025-04-26T23:00:00.000Z",
      features: [feature("SV", { type: "Polygon", coordinates: [ring] })],
    });
    assert.equal(marks.validTime, "2025-04-26T23:00:00.000Z");
    assert.equal(marks.warnings.length, 1);
    assert.equal(marks.warnings[0].phenomenon, "SV");
    assert.equal(marks.warnings[0].office, "MAF");
    assert.deepEqual(marks.warnings[0].rings[0][0], [-103.612, 31.03]);
  });

  it("flattens a multipolygon into its rings", () => {
    const marks = warningsOf({
      features: [
        feature("FF", { type: "MultiPolygon", coordinates: [[ring], [ring]] }),
      ],
    });
    assert.equal(marks.warnings[0].rings.length, 2);
  });

  it("drops a warning with nothing to draw", () => {
    const marks = warningsOf({
      features: [
        feature("TO", null),
        feature("TO", { type: "Polygon", coordinates: [ring.slice(0, 2)] }),
      ],
    });
    assert.deepEqual(marks.warnings, []);
  });
});

describe("warningsPath", () => {
  it("asks for the analysis inside the program's window", () => {
    assert.equal(
      warningsPath("2025-04-26T23:00:00.000Z", {
        west: -104.5,
        east: -101.5,
        south: 29.5,
        north: 32.2,
      }),
      "/warnings/severe?at=2025-04-26T23%3A00%3A00.000Z" +
        "&west=-104.5&east=-101.5&south=29.5&north=32.2"
    );
  });
});
