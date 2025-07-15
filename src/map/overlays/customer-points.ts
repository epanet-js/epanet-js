import { LineLayer, ScatterplotLayer } from "@deck.gl/layers";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { hexToArray, strokeColorFor } from "src/lib/color";
import { colors } from "src/lib/constants";

const getRadiusForZoom = (zoom: number): number => {
  if (zoom < 15) return 0;
  if (zoom < 16) return 1;
  if (zoom < 17) return 2;
  return 3;
};

const getOpacityForZoom = (zoom: number): number => {
  if (zoom < 15) return 0;
  return 255;
};

const getConnectionLineWidthForZoom = (zoom: number): number => {
  if (zoom < 20) return 0.3;
  if (zoom < 22) return 1;
  return 2;
};

interface ConnectionLineData {
  sourcePosition: [number, number];
  targetPosition: [number, number];
}

const fillColor = hexToArray(colors.gray500);
const strokeColor = hexToArray(strokeColorFor(colors.gray500));
const connectionLineColor = hexToArray(colors.gray300);

export const buildCustomerPointsOverlay = (
  customerPoints: Map<string, CustomerPoint>,
  currentZoom: number,
): (ScatterplotLayer | LineLayer)[] => {
  const connectionLines: ConnectionLineData[] = [];

  for (const customerPoint of customerPoints.values()) {
    if (customerPoint.connection) {
      connectionLines.push({
        sourcePosition: customerPoint.coordinates,
        targetPosition: customerPoint.connection.snapPoint,
      });
    }
  }

  const connectionLinesLayer = new LineLayer({
    id: "customer-connection-lines-layer",
    beforeId: "imported-pipes",
    data: connectionLines,
    getSourcePosition: (d: ConnectionLineData) => d.sourcePosition,
    getTargetPosition: (d: ConnectionLineData) => d.targetPosition,
    getWidth: getConnectionLineWidthForZoom(currentZoom),
    widthUnits: "pixels",
    widthMinPixels: 1,
    widthMaxPixels: 2,
    getColor: [
      connectionLineColor[0],
      connectionLineColor[1],
      connectionLineColor[2],
      getOpacityForZoom(currentZoom),
    ],
    antialiasing: true,
  });

  const scatterLayer = new ScatterplotLayer({
    id: "customer-points-layer",
    beforeId: "ephemeral-junction-highlight",
    data: [...customerPoints.values()],
    getPosition: (d: CustomerPoint) => d.coordinates,
    radiusUnits: "pixels",
    getRadius: getRadiusForZoom(currentZoom),
    radiusMinPixels: 1,
    radiusMaxPixels: 4,
    getFillColor: [
      fillColor[0],
      fillColor[1],
      fillColor[2],
      getOpacityForZoom(currentZoom),
    ],
    stroked: true,
    getLineColor: [
      strokeColor[0],
      strokeColor[1],
      strokeColor[2],
      getOpacityForZoom(currentZoom),
    ],
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 2,
    antialiasing: true,
  });

  return [connectionLinesLayer, scatterLayer];
};
