import type * as mapboxgl from "mapbox-gl";
import { ISymbology } from "src/types";
import { LINE_COLORS_SELECTED } from "src/lib/constants";
import {
  asColorExpression,
  asNumberExpression,
} from "src/lib/symbolization-deprecated";

export function CIRCLE_PAINT(symbology: ISymbology): mapboxgl.CirclePaint {
  return {
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "circle-opacity",
        defaultValue: 1,
      }),
    ],
    "circle-stroke-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      "white",
    ],
    "circle-stroke-width": 0,
    "circle-radius": 6,
    "circle-color": [
      "match",
      ["feature-state", "selected"],
      "true",
      LINE_COLORS_SELECTED,
      asColorExpression({
        symbology,
        part: "stroke",
      }),
    ],
  };
}

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

export function FILL_PAINT(
  symbology: ISymbology,
  exp = false,
): mapboxgl.FillPaint {
  return {
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "fill-opacity",
        defaultValue:
          typeof symbology.defaultOpacity === "number"
            ? symbology.defaultOpacity
            : 0.3,
      }),
    ],
    "fill-color": handleSelected(
      asColorExpression({ symbology, part: "fill" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}

export function LINE_PAINT(
  symbology: ISymbology,
  exp = false,
): mapboxgl.LinePaint {
  return {
    "line-opacity": [
      "case",
      ["boolean", ["feature-state", "hidden"], false],
      0,
      asNumberExpression({
        symbology,
        part: "stroke-opacity",
        defaultValue: 1,
      }),
    ],
    "line-width": asNumberExpression({
      symbology,
      part: "stroke-width",
      defaultValue: 4,
    }),
    "line-color": handleSelected(
      asColorExpression({ symbology, part: "stroke" }),
      exp,
      LINE_COLORS_SELECTED,
    ),
  };
}
