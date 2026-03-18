import type * as mapboxgl from "mapbox-gl";
import { CircleLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import type { NodeDefaults } from "src/map/symbology";

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
      ...junctionCircleSizes(),
      "circle-stroke-opacity": opacityExpression(symbology),
      "circle-color": junctionFillColorExpression(nodeDefaults.color),
    },
    minzoom: 13,
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
