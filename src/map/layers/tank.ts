import { SymbolLayer } from "mapbox-gl";
import { ISymbology } from "src/types";
import { POINT_COLORS_SELECTED } from "src/lib/constants";
import { DataSource } from "../data-source";

export const tankLayers = ({
  sources,
  symbology,
}: {
  sources: DataSource[];
  symbology: ISymbology;
}): SymbolLayer[] => {
  return sources.map((source) => ({
    id: `${source}-tanks`,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": "tank",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
    filter: ["==", ["get", "type"], "tank"],
    paint: {
      "icon-opacity": ["case", ["!=", ["feature-state", "hidden"], true], 1, 0],
      "icon-color": [
        "case",
        ["==", ["feature-state", "selected"], "true"],
        POINT_COLORS_SELECTED,
        symbology.defaultColor,
      ],
    },
  }));
};
