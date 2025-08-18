import { LineLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import {
  CustomerPoint,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import { hexToArray, strokeColorFor } from "src/lib/color";
import { colors } from "src/lib/constants";
import { Position } from "src/types";

interface ConnectionLineData {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  customerPointId: string;
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

export type CustomerPointsLayer = ScatterplotLayer | LineLayer | PathLayer;
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
  excludedCustomerPointIds?: Set<string>,
): CustomerPointsOverlay => {
  const connectionLines: ConnectionLineData[] = [];
  const visibleCustomerPoints: CustomerPoint[] = [];

  for (const customerPoint of customerPoints.values()) {
    if (excludedCustomerPointIds?.has(customerPoint.id)) {
      continue;
    }

    visibleCustomerPoints.push(customerPoint);

    const snapPosition = customerPoint.snapPosition;
    if (snapPosition) {
      connectionLines.push({
        sourcePosition: customerPoint.coordinates as [number, number],
        targetPosition: snapPosition as [number, number],
        customerPointId: customerPoint.id,
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
    data: visibleCustomerPoints,
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
    pickable: true,
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

export const buildConnectCustomerPointsPreviewOverlay = (
  customerPoints: CustomerPoint[],
  snapPoints: Position[],
  zoom: number,
): CustomerPointsOverlay => {
  if (customerPoints.length === 0 || snapPoints.length === 0) {
    return [];
  }

  const connectionLines: ConnectionLineData[] = [];

  for (let i = 0; i < customerPoints.length && i < snapPoints.length; i++) {
    const customerPoint = customerPoints[i];
    const snapPoint = snapPoints[i];

    connectionLines.push({
      sourcePosition: customerPoint.coordinates as [number, number],
      targetPosition: snapPoint as [number, number],
      customerPointId: customerPoint.id,
    });
  }

  const isVisible = shouldShowOvelay(zoom);

  const previewConnectionLinesLayer = new PathLayer({
    id: "customer-connect-preview-lines-layer",
    beforeId: "imported-pipes",
    data: connectionLines,
    getPath: (d: ConnectionLineData) => [d.sourcePosition, d.targetPosition],
    widthUnits: "meters",
    getWidth: 0.8,
    widthMinPixels: 1,
    widthMaxPixels: 3,
    getColor: highlightFillColor,
    getDashArray: [5, 3],
    dashJustified: true,
    extensions: [new PathStyleExtension({ dash: true })],
    antialiasing: true,
    visible: isVisible,
  });

  const highlightCustomerPointsLayer = new ScatterplotLayer({
    id: "customer-connect-preview-points-layer",
    beforeId: "ephemeral-junction-highlight",
    data: customerPoints,
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 2,
    radiusMinPixels: 1,
    radiusMaxPixels: 5,

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

  return [previewConnectionLinesLayer, highlightCustomerPointsLayer];
};
