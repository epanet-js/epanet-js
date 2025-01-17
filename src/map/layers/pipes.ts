import { LineLayer, LinePaint, SymbolLayer } from "mapbox-gl";
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
    "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
    "line-color": isFeatureOn("FLAG_MAPBOX_PIPE_RESULTS")
      ? [
          "match",
          ["feature-state", "selected"],
          "true",
          LINE_COLORS_SELECTED,
          ["coalesce", ["get", "color"], symbolization.defaultColor],
        ]
      : handleSelected(
          asColorExpression({ symbolization, part: "stroke" }),
          LINE_COLORS_SELECTED,
        ),
    "line-dasharray": [
      "case",
      ["==", ["get", "status"], "closed"],
      ["literal", [2, 1]],
      ["literal", [1, 0]],
    ],
  };
  return {
    id: layerId,
    type: "line",
    source,
    filter: ["==", "$type", "LineString"],
    paint: paint as LinePaint,
  };
};

export const pipeArrows = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: string;
  symbolization: ISymbolization;
}): SymbolLayer => {
  return {
    id: layerId,
    type: "symbol",
    source,
    layout: {
      "symbol-placement": "line-center",
      "icon-image": "arrow",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.25, 24, 1],
      visibility: "none",
    },
    filter: ["==", "$type", "LineString"],
    paint: {
      "icon-color": [
        "match",
        ["feature-state", "selected"],
        "true",
        LINE_COLORS_SELECTED,
        ["coalesce", ["get", "color"], symbolization.defaultColor],
      ],
    },
    minzoom: 14,
  };
};

function handleSelected(
  expression: mapboxgl.Expression | string,
  selectedColor: string,
) {
  return [
    "match",
    ["feature-state", "selected"],
    "true",
    selectedColor,
    expression,
  ] as mapboxgl.Expression;
}
