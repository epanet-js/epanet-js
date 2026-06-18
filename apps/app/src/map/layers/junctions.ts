import type * as mapboxgl from "mapbox-gl";
import { CircleLayer } from "mapbox-gl";
import { colors } from "src/lib/constants";
import { asNumberExpression } from "src/lib/symbolization-deprecated";
import { ISymbology } from "src/types";
import { DataSource } from "../data-source";
import { LayerId } from "./layer";
import { strokeColorFor } from "src/lib/color";
import type { NodeDefaults, NodeSizeConfig } from "src/map/symbology";
import { defaultNodeSizeConfig } from "src/map/symbology";
import { LAYER_MAX_ZOOM, MAP_MIN_ZOOM } from "src/map/map-engine";

export const junctionLayerMinZoom = ({
  minVisibleZoom,
}: NodeSizeConfig): number =>
  Math.min(Math.max(minVisibleZoom, MAP_MIN_ZOOM), LAYER_MAX_ZOOM);

export const junctionCircleRadius = ({
  minVisibleZoom,
  minSize,
  maxSize,
}: NodeSizeConfig): number | mapboxgl.Expression => {
  if (minSize === maxSize) return minSize;
  // Equal/inverted interpolation stops would be invalid — hold at maxSize.
  if (minVisibleZoom >= LAYER_MAX_ZOOM) return maxSize;

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    minVisibleZoom,
    minSize,
    LAYER_MAX_ZOOM,
    maxSize,
  ];
};

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
    "circle-radius": junctionCircleRadius(defaultNodeSizeConfig),
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
    minzoom: junctionLayerMinZoom(defaultNodeSizeConfig),
  };
};

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
