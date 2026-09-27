// Format
import { latLon } from "@/lib/format";

describe("latLon", () => {
  // Degrees and decimal minutes, which is what a GPS or an FMS takes. Decimal
  // degrees would be a number the crew has to convert before they can fly to
  // it, and converting a coordinate by hand is how a digit goes missing.
  it("reads a point the way a crew types one in", () => {
    expect(latLon(-101.41, 32.09)).toBe("N32°05.40′ W101°24.60′");
  });

  it("names the hemisphere rather than signing the number", () => {
    expect(latLon(101.41, -32.09)).toBe("S32°05.40′ E101°24.60′");
    expect(latLon(-101.41, 32.09)).not.toContain("-");
  });

  // The minute is always two digits before the point, so a column of these
  // lines up and 5.4 cannot be misread as 54.
  it("pads the minute so a column of points aligns", () => {
    expect(latLon(-101.005, 32.005)).toBe("N32°00.30′ W101°00.30′");
  });

  // A click is rounded to 0.001°, which is 0.06 of a minute. Two decimals
  // hold that; one would round two distinguishable clicks onto one readout.
  it("keeps the resolution the click was rounded to", () => {
    expect(latLon(-101.001, 32.001)).not.toBe(latLon(-101.002, 32.002));
  });
});
