import type * as mapboxgl from "mapbox-gl";

export const gridLayer = (): mapboxgl.AnyLayer => ({
  id: "grid-lines",
  type: "line",
  source: "grid",
  paint: {
    "line-color": "#e0e0e0",
    "line-width": 0.5,
  },
});
