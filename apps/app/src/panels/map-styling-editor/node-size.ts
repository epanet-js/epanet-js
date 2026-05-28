import type * as mapboxgl from "mapbox-gl";
import type { NodeSizeConfig } from "src/map/symbology/symbology-types";

// Mirrors the map's zoom range (see MAP_OPTIONS.maxZoom in src/map/map-engine.ts).
export const MAP_MIN_ZOOM = 0;
export const MAP_MAX_ZOOM = 26;

// Junction layers' maxzoom — one above the map's max so they are never hidden at
// the top zoom (mapbox hides a layer when zoom >= maxzoom).
export const JUNCTION_MAX_ZOOM = MAP_MAX_ZOOM + 1;

// The mapbox style spec caps a layer's zoom range at 24
export const LAYER_MAX_ZOOM = 24;

// Cap on the user-selectable min visible zoom — kept strictly below
// LAYER_MAX_ZOOM (the radius interpolation's upper stop) so the interpolation
// stops always stay ascending and we never build an invalid expression.
export const MAX_MIN_VISIBLE_ZOOM = LAYER_MAX_ZOOM - 1;

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
  // Degenerate range: minVisibleZoom is at/above the upper interpolation stop,
  // so the interpolation would have equal/inverted stops. Hold at maxSize.
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
