import type * as mapboxgl from "mapbox-gl";
import { CircleLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import type { NodeDefaults } from "src/map/symbology";

type CircleSizes = {
  "circle-radius": mapboxgl.Expression;
  "circle-stroke-width": mapboxgl.Expression;
};

export const junctionCircleSizes = (size: number = 50): CircleSizes => {
  const s = size / 50;
  return {
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      0.5 * s,
      24,
      2 * s,
    ],
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      0.5 * s,
      24,
      20 * s,
    ],
  };
};

export const junctionResultCircleSizes = (size: number = 50): CircleSizes => {
  const s = size / 50;
  return {
    "circle-stroke-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      8,
      0.1 * s,
      14,
      1 * s,
    ],
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1 * s, 16, 6 * s],
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
      ...junctionCircleSizes(nodeDefaults.size),
      "circle-stroke-opacity": opacityExpression(symbology),
      "circle-color": junctionFillColorExpression(nodeDefaults.color),
    },
    minzoom: 8,
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
    ...junctionResultCircleSizes(nodeDefaults.size),
    "circle-stroke-opacity": opacityExpression(symbology),
    "circle-color": junctionFillColorExpression(nodeDefaults.color),
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
