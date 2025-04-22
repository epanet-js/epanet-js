import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { LineLayer, LinePaint } from "mapbox-gl";
import { LINE_COLORS_SELECTED, colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization";

export const valveLines = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): LineLayer => {
  const paint = {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbolization,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 2],
    "line-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      ["coalesce", ["get", "color"], colors.orange700],
    ],
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "off"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "type", "valve"],
    paint: paint as LinePaint,
  };
};
