import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import ColorVariable from "@arcgis/core/renderers/visualVariables/ColorVariable";
import SizeVariable from "@arcgis/core/renderers/visualVariables/SizeVariable";

// Cloud cover ramps from faint blue (clear) to solid white (overcast)
export const CloudCoverRenderer = new SimpleRenderer({
  symbol: new SimpleMarkerSymbol({
    style: "circle",
    outline: new SimpleLineSymbol({ color: [255, 255, 255, 0.15], width: 0.5 }),
  }),
  visualVariables: [
    new ColorVariable({
      field: "cloudCover",
      stops: [
        { value: 0, color: [56, 168, 255, 0.15] },
        { value: 50, color: [200, 205, 215, 0.5] },
        { value: 100, color: [255, 255, 255, 0.9] },
      ],
    }),
    new SizeVariable({
      field: "cloudCover",
      stops: [
        { value: 0, size: 5 },
        { value: 100, size: 20 },
      ],
    }),
  ],
});
