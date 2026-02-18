import type * as mapboxgl from "mapbox-gl";

export const gridMinorLayer = (): mapboxgl.AnyLayer => ({
  id: "grid-minor",
  type: "line",
  source: "grid",
  filter: ["==", ["get", "rank"], "minor"],
  paint: {
    "line-color": "#555",
    "line-width": 0.25,
    "line-opacity": 0.03,
    "line-opacity-transition": { duration: 0, delay: 0 },
    "line-width-transition": { duration: 0, delay: 0 },
  },
});

export const gridMajorLayer = (): mapboxgl.AnyLayer => ({
  id: "grid-major",
  type: "line",
  source: "grid",
  filter: ["==", ["get", "rank"], "major"],
  paint: {
    "line-color": "#aaa",
    "line-width": 1.5,
    "line-opacity": 0.55,
    "line-opacity-transition": { duration: 0, delay: 0 },
    "line-width-transition": { duration: 0, delay: 0 },
  },
});
