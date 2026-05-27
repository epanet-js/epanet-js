import type * as mapboxgl from "mapbox-gl";
import type { NodeSizeConfig } from "src/map/symbology/symbology-types";

// Mirrors the map's zoom range (see MAP_OPTIONS.maxZoom in src/map/map-engine.ts).
export const MAP_MIN_ZOOM = 0;
export const MAP_MAX_ZOOM = 26;

// Builds the circle-radius interpolation: minSize at minVisibleZoom → maxSize at
// the max map zoom. The upper stop is guarded to stay strictly above the lower
// one, since mapbox requires strictly ascending interpolation input stops.
export const junctionCircleRadiusExpression = ({
  minVisibleZoom,
  minSize,
  maxSize,
}: NodeSizeConfig): mapboxgl.Expression => {
  const upperZoom = Math.max(MAP_MAX_ZOOM, minVisibleZoom + 0.5);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    minVisibleZoom,
    minSize,
    upperZoom,
    maxSize,
  ];
};
