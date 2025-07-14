import { ScatterplotLayer } from "@deck.gl/layers";
import { CustomerPoint } from "src/hydraulic-model/customer-points";

export const buildCustomerPointsOverlay = (
  customerPoints: Map<string, CustomerPoint>,
): ScatterplotLayer => {
  const scatterLayer = new ScatterplotLayer({
    id: "scatter-layer",
    data: [...customerPoints.values()],
    getPosition: (d: CustomerPoint) => d.coordinates,
    getRadius: 10,
    getFillColor: [255, 0, 0],
    minZoom: 10, // only show this layer when zoom is 10 or higher
  });
  return scatterLayer;
};
