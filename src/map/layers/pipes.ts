import { LineLayer, LinePaint } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { ISymbolization } from "src/types";
import { asColorExpression, asNumberExpression } from "src/lib/symbolization";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { isFeatureOn } from "src/infra/feature-flags";

export const pipesLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): LineLayer => {
  const paint = isFeatureOn("FLAG_CLOSED_PIPES")
    ? {
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
        "line-color": handleSelected(
          asColorExpression({ symbolization, part: "stroke" }),
          false,
          LINE_COLORS_SELECTED,
        ),
        "line-dasharray": [
          "case",
          ["==", ["get", "status"], "closed"],
          ["literal", [2, 1]],
          ["literal", [1, 0]],
        ],
      }
    : {
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
        "line-color": handleSelected(
          asColorExpression({ symbolization, part: "stroke" }),
          false,
          LINE_COLORS_SELECTED,
        ),
      };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "$type", "LineString"],
    paint: paint as LinePaint,
  };
};

function handleSelected(
  expression: mapboxgl.Expression | string,
  exp = false,
  selected: mapboxgl.Expression | string,
) {
  return exp
    ? expression
    : ([
        "match",
        ["feature-state", "selected"],
        "true",
        selected,
        expression,
      ] as mapboxgl.Expression);
}
