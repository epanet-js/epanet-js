import { LineLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  CustomerPoint,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import { hexToArray, strokeColorFor } from "src/lib/color";
import { colors } from "src/lib/constants";

interface ConnectionLineData {
  sourcePosition: [number, number];
  targetPosition: [number, number];
}

const fillColor = hexToArray(colors.gray500);
const strokeColor = hexToArray(strokeColorFor(colors.gray500));
const connectionLineColor = hexToArray(colors.gray300);

const highlightFillColor = hexToArray(colors.cyan500);
const haloFillColor = hexToArray(colors.cyan300, 0.8) as [
  number,
  number,
  number,
  number,
];

export type CustomerPointsLayer = ScatterplotLayer | LineLayer;
export type CustomerPointsOverlay = CustomerPointsLayer[];

export const shouldShowOvelay = (zoom: number) => zoom >= 14;

export const updateCustomerPointsOverlayVisibility = (
  overlay: CustomerPointsOverlay,
  zoom: number,
) => {
  return overlay.map(
    (layer) =>
      layer.clone({ visible: shouldShowOvelay(zoom) }) as CustomerPointsLayer,
  );
};

export const buildCustomerPointsOverlay = (
  customerPoints: CustomerPoints,
  zoom: number,
): CustomerPointsOverlay => {
  const connectionLines: ConnectionLineData[] = [];

  for (const customerPoint of customerPoints.values()) {
    const snapPosition = customerPoint.snapPosition;
    if (snapPosition) {
      connectionLines.push({
        sourcePosition: customerPoint.coordinates as [number, number],
        targetPosition: snapPosition as [number, number],
      });
    }
  }

  const isVisible = shouldShowOvelay(zoom);

  const connectionLinesLayer = new LineLayer({
    id: "customer-connection-lines-layer",
    beforeId: "imported-pipes",
    data: connectionLines,
    getSourcePosition: (d: ConnectionLineData) => d.sourcePosition,
    getTargetPosition: (d: ConnectionLineData) => d.targetPosition,

    widthUnits: "meters",
    getWidth: 0.8,
    widthMinPixels: 0,
    widthMaxPixels: 2,

    getColor: connectionLineColor,
    antialiasing: true,
    visible: isVisible,
  });

  const scatterLayer = new ScatterplotLayer({
    id: "customer-points-layer",
    beforeId: "ephemeral-junction-highlight",
    data: [...customerPoints.values()],
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 1.5,
    radiusMinPixels: 0,
    radiusMaxPixels: 4,

    getFillColor: fillColor,
    stroked: true,
    getLineColor: strokeColor,
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    antialiasing: true,
    visible: isVisible,
  });

  return [connectionLinesLayer, scatterLayer];
};

export const buildCustomerPointsHighlightOverlay = (
  highlightedPoints: CustomerPoint[],
  zoom: number,
): CustomerPointsOverlay => {
  if (highlightedPoints.length === 0) {
    return [];
  }

  const isVisible = shouldShowOvelay(zoom);

  const haloLayer = new ScatterplotLayer({
    id: "customer-points-halo-layer",
    beforeId: "ephemeral-junction-highlight",
    data: highlightedPoints,
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 3,
    radiusMinPixels: 0,
    radiusMaxPixels: 6,

    getFillColor: haloFillColor,
    antialiasing: true,
    visible: isVisible,
  });

  const highlightLayer = new ScatterplotLayer({
    id: "customer-points-highlight-layer",
    beforeId: "ephemeral-junction-highlight",
    data: highlightedPoints,
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 1.5,
    radiusMinPixels: 0,
    radiusMaxPixels: 4,

    getFillColor: highlightFillColor,
    stroked: true,
    getLineColor: haloFillColor,
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    antialiasing: true,
    visible: isVisible,
  });

  return [haloLayer, highlightLayer];
};
