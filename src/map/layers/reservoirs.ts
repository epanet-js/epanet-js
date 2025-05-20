import { SymbolLayer } from "mapbox-gl";
import { LayerId } from "./layer";
import { ISymbology } from "src/types";
import { POINT_COLORS_SELECTED } from "src/lib/constants";

export const reservoirsLayer = ({
  source,
  layerId,
  symbology,
}: {
  source: string;
  layerId: LayerId;
  symbology: ISymbology;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "point",
      "icon-image": "reservoir",
      "icon-size": 0.6,
      "icon-allow-overlap": true,
    },
    filter: ["==", ["get", "type"], "reservoir"],
    paint: {
      "icon-opacity": ["case", ["!=", ["feature-state", "hidden"], true], 1, 0],
      "icon-color": [
        "case",
        ["==", ["feature-state", "selected"], "true"],
        POINT_COLORS_SELECTED,
        symbology.defaultColor,
      ],
    },
  };
};
