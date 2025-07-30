import { CircleLayer } from "mapbox-gl";
import { POINT_COLORS_SELECTED, colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";

const defaultInnerColor = colors.indigo200;
const selectedInnerColor = POINT_COLORS_SELECTED;

export const junctionCircleSizes = (): Partial<CircleLayer["paint"]> => {
  return {
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      13,
      0.5,
      16,
      1,
    ],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 5],
  };
};

export const junctionsLayer = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": opacityExpression(symbology),
      "circle-stroke-color": strokeColorExpression(),
      ...junctionCircleSizes(),
      "circle-stroke-opacity": opacityExpression(symbology),
      "circle-color": colorExpression(),
    },
    minzoom: 13,
  };
};

export const junctionResultsLayer = ({
  source,
  layerId,
  symbology,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
}): CircleLayer => ({
  id: layerId,
  type: "circle",
  source,
  filter: ["==", ["get", "type"], "junction"],
  layout: { visibility: "none" },
  paint: {
    "circle-opacity": opacityExpression(symbology),
    "circle-stroke-color": strokeColorExpression(),
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      0.1,
      14,
      1,
    ],
    "circle-stroke-opacity": opacityExpression(symbology),
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 6],
    "circle-color": colorExpression(),
  },
  maxzoom: 13,
});

const opacityExpression = (symbology: ISymbology): mapboxgl.Expression => [
  "case",
  ["boolean", ["feature-state", "hidden"], false],
  0,
  asNumberExpression({
    symbology,
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
