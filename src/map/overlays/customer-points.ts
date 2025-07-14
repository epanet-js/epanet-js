import { ScatterplotLayer } from "@deck.gl/layers";
import { CustomerPoint } from "src/hydraulic-model/customer-points";
import { DEFAULT_ZOOM } from "../map-engine";

const getRadiusForZoom = (zoom: number): number => {
  if (zoom < DEFAULT_ZOOM) return 0;
  if (zoom < 16) return 2;
  if (zoom < 17) return 3;
  if (zoom < 18) return 4;
  return 6;
};

const getOpacityForZoom = (zoom: number): number => {
  if (zoom < 14) return 0;
  return 180;
};

export const buildCustomerPointsOverlay = (
  customerPoints: Map<string, CustomerPoint>,
  currentZoom: number,
): ScatterplotLayer => {
  const scatterLayer = new ScatterplotLayer({
    id: "customer-points-layer",
    data: [...customerPoints.values()],
    getPosition: (d: CustomerPoint) => d.coordinates,
    radiusUnits: "pixels",
    getRadius: getRadiusForZoom(currentZoom),
    radiusMinPixels: 1,
    radiusMaxPixels: 6,
    getFillColor: [107, 114, 128, getOpacityForZoom(currentZoom)],
    antialiasing: true,
  });
  return scatterLayer;
};
