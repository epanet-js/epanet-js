import { CircleLayer } from "mapbox-gl";
import { POINT_COLORS_SELECTED, indigo200 } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization";
import { ISymbolization } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";

const defaultInnerColor = indigo200;
const selectedInnerColor = POINT_COLORS_SELECTED;

export const junctionsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": opacityExpression(symbolization),
      "circle-stroke-color": strokeColorExpression(),
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        0.5,
        16,
        1,
      ],
      "circle-stroke-opacity": opacityExpression(symbolization),
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 5],
      "circle-color": colorExpression(),
    },
    minzoom: 13,
  };
};

export const junctionResultsLayer = ({
  source,
  layerId,
  symbolization,
}: {
  source: DataSource;
  layerId: LayerId;
  symbolization: ISymbolization;
}): CircleLayer => ({
  id: layerId,
  type: "circle",
  source,
  filter: ["==", ["get", "type"], "junction"],
  layout: { visibility: "none" },
  paint: {
    "circle-opacity": opacityExpression(symbolization),
    "circle-stroke-color": strokeColorExpression(),
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      0,
      14,
      0.5,
    ],
    "circle-stroke-opacity": opacityExpression(symbolization),
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 6],
    "circle-color": colorExpression(),
  },
  maxzoom: 14,
});

const opacityExpression = (
  symbolization: ISymbolization,
): mapboxgl.Expression => [
  "case",
  ["boolean", ["feature-state", "hidden"], false],
  0,
  asNumberExpression({
    symbolization,
    part: "circle-opacity",
    defaultValue: 1,
  }),
];

const colorExpression = (): mapboxgl.Expression => {
  return [
    "match",
    ["feature-state", "selected"],
    "true",
    selectedInnerColor,
    ["coalesce", ["get", "color"], defaultInnerColor],
  ];
};

const strokeColorExpression = (): mapboxgl.Expression => {
  return [
    "match",
    ["feature-state", "selected"],
    "true",
    strokeColorFor(selectedInnerColor),
    ["coalesce", ["get", "strokeColor"], strokeColorFor(defaultInnerColor)],
  ];
};
