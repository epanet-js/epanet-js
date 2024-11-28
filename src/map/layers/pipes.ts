import { LineLayer } from "mapbox-gl";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import { ISymbolization } from "src/types";
import { asColorExpression, asNumberExpression } from "src/lib/symbolization";
import { DataSource } from "../data-source";

export const pipesLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: string;
  symbolization: ISymbolization;
}): LineLayer => {
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["any", ["==", "$type", "LineString"], ["==", "$type", "Polygon"]],
    paint: {
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
      "line-width": asNumberExpression({
        symbolization,
        part: "stroke-width",
        defaultValue: 4,
      }),
      "line-color": handleSelected(
        asColorExpression({ symbolization, part: "stroke" }),
        false,
        LINE_COLORS_SELECTED,
      ),
    },
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
