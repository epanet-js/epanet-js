import { LineLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import {
  CustomerPoint,
  CustomerPoints,
} from "src/hydraulic-model/customer-points";
import { hexToArray, strokeColorFor } from "src/lib/color";
import { colors } from "src/lib/constants";
import { Position } from "src/types";
import { AssetsMap } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

interface ConnectionLineData {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  customerPointId: number;
}

interface CustomerPointData {
  id: number;
  coordinates: Position;
  snapPosition: Position | null;
  isActive: boolean;
}

const fillColor = hexToArray(colors.gray500);
const strokeColor = hexToArray(strokeColorFor(colors.gray500));
const connectionLineColor = hexToArray(colors.gray300);

const disabledFillColor = hexToArray(colors.gray300);
const disabledStrokeColor = hexToArray(colors.gray400);
const disabledConnectionLineColor = hexToArray(colors.gray300);

const highlightFillColor = hexToArray(colors.cyan500);
const haloFillColor = hexToArray(colors.cyan300, 0.8) as [
  number,
  number,
  number,
  number,
];

const selectionFillColor = hexToArray(colors.fuchsia300);
const selectionHaloFillColor = hexToArray(colors.fuchsia600, 0.8) as [
  number,
  number,
  number,
  number,
];
const selectionDisabledFillColor = hexToArray(colors.fuchsia200);
const selectionDisabledHaloFillColor = hexToArray(colors.fuchsia300) as [
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
  assets: AssetsMap,
  zoom: number,
  excludedCustomerPointIds?: Set<number>,
): CustomerPointsOverlay => {
  const customerPointsData: CustomerPointData[] = [];
  const connectionLinesData: Array<ConnectionLineData & { isActive: boolean }> =
    [];

  for (const customerPoint of customerPoints.values()) {
    if (excludedCustomerPointIds?.has(customerPoint.id)) {
      continue;
    }

    let isActive = false;

    if (customerPoint.connection) {
      const pipe = assets.get(customerPoint.connection.pipeId) as
        | Pipe
        | undefined;
      isActive = pipe?.isActive ?? false;
    }

    customerPointsData.push({
      id: customerPoint.id,
      coordinates: customerPoint.coordinates,
      snapPosition: customerPoint.snapPosition,
      isActive,
    });

    const snapPosition = customerPoint.snapPosition;
    if (snapPosition) {
      connectionLinesData.push({
        sourcePosition: customerPoint.coordinates as [number, number],
        targetPosition: snapPosition as [number, number],
        customerPointId: customerPoint.id,
        isActive,
      });
    }
  }

  const isVisible = shouldShowOvelay(zoom);

  const connectionLinesLayer = new LineLayer({
    id: "customer-connection-lines-layer",
    beforeId: "main-features-pipes",
    data: connectionLinesData,
    getSourcePosition: (d: ConnectionLineData) => d.sourcePosition,
    getTargetPosition: (d: ConnectionLineData) => d.targetPosition,

    widthUnits: "meters",
    getWidth: 0.8,
    widthMinPixels: 0,
    widthMaxPixels: 2,

    getColor: (d) =>
      d.isActive ? connectionLineColor : disabledConnectionLineColor,
    antialiasing: true,
    visible: isVisible,
  });

  const scatterLayer = new ScatterplotLayer({
    id: "customer-points-layer",
    beforeId: "ephemeral-junction-highlight",
    data: customerPointsData,
    getPosition: (d) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 1.5,
    radiusMinPixels: 0,
    radiusMaxPixels: 4,

    getFillColor: (d) => (d.isActive ? fillColor : disabledFillColor),
    stroked: true,
    getLineColor: (d) => (d.isActive ? strokeColor : disabledStrokeColor),
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

export const buildCustomerPointsSelectionOverlay = (
  selectedPoints: CustomerPoint[],
  isActive: boolean,
  zoom: number,
): CustomerPointsOverlay => {
  if (selectedPoints.length === 0) {
    return [];
  }

  const isVisible = shouldShowOvelay(zoom);

  const haloLayer = new ScatterplotLayer({
    id: "customer-points-selection-halo-layer",
    beforeId: "ephemeral-junction-highlight",
    data: selectedPoints,
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 3,
    radiusMinPixels: 0,
    radiusMaxPixels: 6,

    getFillColor: isActive
      ? selectionHaloFillColor
      : selectionDisabledHaloFillColor,
    antialiasing: true,
    visible: isVisible,
  });

  const selectionLayer = new ScatterplotLayer({
    id: "customer-points-selection-layer",
    beforeId: "ephemeral-junction-highlight",
    data: selectedPoints,
    getPosition: (d: CustomerPoint) => d.coordinates as [number, number],

    radiusUnits: "meters",
    getRadius: 1.5,
    radiusMinPixels: 0,
    radiusMaxPixels: 4,

    getFillColor: isActive ? selectionFillColor : selectionDisabledFillColor,
    stroked: true,
    getLineColor: isActive
      ? selectionHaloFillColor
      : selectionDisabledHaloFillColor,
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    antialiasing: true,
    visible: isVisible,
  });

  return [haloLayer, selectionLayer];
};

export const buildConnectCustomerPointsPreviewOverlay = (
  customerPoints: CustomerPoint[],
  snapPoints: Position[],
  zoom: number,
  mode: "highlight" | "quiet" = "highlight",
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

  const isQuietMode = mode === "quiet";
  const lineColor = isQuietMode ? connectionLineColor : highlightFillColor;
  const pointFillColor = isQuietMode ? fillColor : highlightFillColor;
  const pointStrokeColor = isQuietMode ? strokeColor : haloFillColor;
  const pointRadius = isQuietMode ? 1.5 : 2;
  const pointMaxRadius = isQuietMode ? 4 : 5;

  const previewConnectionLinesLayer = new PathLayer({
    id: "customer-connect-preview-lines-layer",
    beforeId: "main-features-pipes",
    data: connectionLines,
    getPath: (d: ConnectionLineData) => [d.sourcePosition, d.targetPosition],
    widthUnits: "meters",
    getWidth: 0.8,
    widthMinPixels: 1,
    widthMaxPixels: 3,
    getColor: lineColor,
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
    getRadius: pointRadius,
    radiusMinPixels: 1,
    radiusMaxPixels: pointMaxRadius,

    getFillColor: pointFillColor,
    stroked: true,
    getLineColor: pointStrokeColor,
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    antialiasing: true,
    visible: isVisible,
  });

  return [previewConnectionLinesLayer, highlightCustomerPointsLayer];
};
