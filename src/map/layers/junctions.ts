import type * as mapboxgl from "mapbox-gl";
import { CircleLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import type { NodeDefaults } from "src/map/symbology";
import {
  NODE_SIZE_RAMP_MIN_ZOOM,
  NODE_SIZE_RAMP_MAX_ZOOM,
  NODE_RESULT_LAYER_MAX_ZOOM,
} from "src/map/symbology/symbology-types";

type CircleSizes = {
  "circle-radius": mapboxgl.Expression;
  "circle-stroke-width": mapboxgl.Expression;
};

export const junctionCircleSizes = (
  minSize: number = 4,
  maxSize: number = 10,
): CircleSizes => ({
  "circle-radius": [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    NODE_SIZE_RAMP_MIN_ZOOM,
    minSize,
    NODE_SIZE_RAMP_MAX_ZOOM,
    maxSize,
  ],
  "circle-stroke-width": [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    NODE_SIZE_RAMP_MIN_ZOOM,
    1,
    NODE_SIZE_RAMP_MAX_ZOOM,
    Math.max(2, maxSize * 0.15),
  ],
});

export const junctionResultCircleSizes = (
  minSize: number = 4,
  maxSize: number = 10,
): CircleSizes => {
  const resultMax = maxSize * 0.3;
  return {
    "circle-radius": [
      "interpolate",
      ["exponential", 2],
      ["zoom"],
      NODE_SIZE_RAMP_MIN_ZOOM,
      minSize,
      NODE_RESULT_LAYER_MAX_ZOOM,
      resultMax,
    ],
    "circle-stroke-width": [
      "interpolate",
      ["exponential", 2],
      ["zoom"],
      NODE_SIZE_RAMP_MIN_ZOOM,
      0.5,
      NODE_RESULT_LAYER_MAX_ZOOM,
      Math.max(1, resultMax * 0.15),
    ],
  };
};

export const junctionFillColorExpression = (
  defaultNodeColor: string,
): mapboxgl.Expression => [
  "case",
  ["==", ["get", "isActive"], false],
  colors.gray300,
  ["coalesce", ["get", "color"], defaultNodeColor],
];

export const junctionStrokeColorExpression = (
  defaultNodeColor: string,
): mapboxgl.Expression => [
  "case",
  ["==", ["get", "isActive"], false],
  colors.gray400,
  ["coalesce", ["get", "strokeColor"], strokeColorFor(defaultNodeColor)],
];

export const junctionsLayer = ({
  source,
  layerId,
  symbology,
  nodeDefaults,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
  nodeDefaults: NodeDefaults;
}): CircleLayer => {
  return {
    id: layerId,
    type: "circle",
    source,
    filter: ["==", ["get", "type"], "junction"],
    paint: {
      "circle-opacity": opacityExpression(symbology),
      "circle-stroke-color": junctionStrokeColorExpression(nodeDefaults.color),
      ...junctionCircleSizes(nodeDefaults.minSize, nodeDefaults.maxSize),
      "circle-stroke-opacity": opacityExpression(symbology),
      "circle-color": junctionFillColorExpression(nodeDefaults.color),
    },
    minzoom: nodeDefaults.minVisibility,
  };
};

export const junctionResultsLayer = ({
  source,
  layerId,
  symbology,
  nodeDefaults,
}: {
  source: DataSource;
  layerId: LayerId;
  symbology: ISymbology;
  nodeDefaults: NodeDefaults;
}): CircleLayer => ({
  id: layerId,
  type: "circle",
  source,
  filter: [
    "all",
    ["==", ["get", "type"], "junction"],
    ["==", ["get", "isActive"], true],
  ],
  layout: { visibility: "none" },
  paint: {
    "circle-opacity": opacityExpression(symbology),
    "circle-stroke-color": junctionStrokeColorExpression(nodeDefaults.color),
    ...junctionResultCircleSizes(nodeDefaults.minSize, nodeDefaults.maxSize),
    "circle-stroke-opacity": opacityExpression(symbology),
    "circle-color": junctionFillColorExpression(nodeDefaults.color),
  },
  maxzoom: NODE_RESULT_LAYER_MAX_ZOOM,
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

export const junctionsSymbologyFilterExpression = (
  excludeIds: number[],
): mapboxgl.Expression => {
  const filters: mapboxgl.Expression[] = [
    ["==", ["get", "type"], "junction"],
    ["==", ["get", "isActive"], true],
  ];

  if (excludeIds.length) {
    filters.push(["!", ["in", ["id"], ["literal", excludeIds]]]);
  }
  return ["all", ...filters];
};
