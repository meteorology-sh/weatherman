// Types
import type { CloudLayerId } from "@/lib/types";

export type LegendTick = { label: string; percent: number };

export type CloudLayerLegend = {
  name: string;
  /** One line under the switcher saying what the operator is looking at. */
  summary: string;
  /** CSS gradient matching the layer's colour ramp; absent for imagery. */
  gradient?: string;
  ticks?: LegendTick[];
  /** Highlighted span across the ramp, positioned in gradient percent. */
  band?: { fromPercent: number; toPercent: number; label: string };
  /** What the layer does not tell you. Shown in the panel. */
  caveat: string;
};

// Sampled every 2 °C from the authoritative GIBS colour map so the bar matches
// the imagery pixel-for-pixel:
// https://gibs.earthdata.nasa.gov/colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml
// Range is -90 °C (left) to +40 °C (right).
const BAND13_GRADIENT =
  "linear-gradient(to right, " +
  "rgb(140,13,135) 0.0%, rgb(165,38,150) 1.5%, rgb(191,64,165) 3.1%, " +
  "rgb(217,89,180) 4.6%, rgb(242,114,195) 6.2%, rgb(230,230,230) 7.7%, " +
  "rgb(177,177,177) 9.2%, rgb(129,129,129) 10.8%, rgb(76,76,76) 12.3%, " +
  "rgb(27,27,27) 13.8%, rgb(26,0,0) 15.4%, rgb(77,0,0) 16.9%, " +
  "rgb(128,0,0) 18.5%, rgb(179,0,0) 20.0%, rgb(230,0,0) 21.5%, " +
  "rgb(255,26,0) 23.1%, rgb(255,77,0) 24.6%, rgb(255,128,0) 26.2%, " +
  "rgb(255,179,0) 27.7%, rgb(255,230,0) 29.2%, rgb(230,255,0) 30.8%, " +
  "rgb(179,255,0) 32.3%, rgb(128,255,0) 33.8%, rgb(77,255,0) 35.4%, " +
  "rgb(26,255,0) 36.9%, rgb(0,234,10) 38.5%, rgb(0,191,29) 40.0%, " +
  "rgb(0,149,48) 41.5%, rgb(0,106,67) 43.1%, rgb(0,64,86) 44.6%, " +
  "rgb(0,0,115) 46.2%, rgb(0,38,136) 47.7%, rgb(0,89,164) 49.2%, " +
  "rgb(0,140,192) 50.8%, rgb(0,191,220) 52.3%, rgb(0,242,248) 53.8%, " +
  "rgb(194,194,194) 55.4%, rgb(189,189,189) 56.9%, rgb(184,184,184) 58.5%, " +
  "rgb(179,179,179) 60.0%, rgb(174,174,174) 61.5%, rgb(169,169,169) 63.1%, " +
  "rgb(163,163,163) 64.6%, rgb(158,158,158) 66.2%, rgb(153,153,153) 67.7%, " +
  "rgb(148,148,148) 69.2%, rgb(143,143,143) 70.8%, rgb(138,138,138) 72.3%, " +
  "rgb(132,132,132) 73.8%, rgb(127,127,127) 75.4%, rgb(122,122,122) 76.9%, " +
  "rgb(117,117,117) 78.5%, rgb(112,112,112) 80.0%, rgb(106,106,106) 81.5%, " +
  "rgb(101,101,101) 83.1%, rgb(96,96,96) 84.6%, rgb(91,91,91) 86.2%, " +
  "rgb(86,86,86) 87.7%, rgb(81,81,81) 89.2%, rgb(75,75,75) 90.8%, " +
  "rgb(70,70,70) 92.3%, rgb(65,65,65) 93.8%, rgb(60,60,60) 95.4%, " +
  "rgb(55,55,55) 96.9%, rgb(50,50,50) 98.5%, rgb(44,44,44) 100.0%" +
  ")";

/** Position of a temperature on the -90..+40 °C bar, in percent. */
const tempPercent = (celsius: number) => ((celsius + 90) / 130) * 100;

export const CloudLayerLegends: Record<CloudLayerId, CloudLayerLegend> = {
  geocolor: {
    name: "GeoColor",
    summary: "True colour by day, IR cloud shading at night.",
    caveat:
      "Shows what the cloud deck looks like from above, not how thick it is " +
      "or what is inside it. The day and night renderings differ.",
  },
  band13: {
    name: "Band 13 (Clean IR)",
    summary: "Cloud-top brightness temperature. Identical day and night.",
    gradient: BAND13_GRADIENT,
    ticks: [-80, -60, -40, -20, 0, 20, 40].map((celsius) => ({
      label: `${celsius}°`,
      percent: tempPercent(celsius),
    })),
    band: {
      fromPercent: tempPercent(-12),
      toPercent: tempPercent(-5),
      label: "seeding band",
    },
    caveat:
      "This is the temperature of the cloud top, not of the supercooled " +
      "liquid inside it — the −5 to −12 °C layer usually sits below the top. " +
      "The ramp is tuned for deep convection, so the seeding band falls in " +
      "near-flat grey. Treat it as a hint, not a verdict.",
  },
};
