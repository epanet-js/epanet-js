import { e6position } from "@epanet-js/geometry";

export function getMapCoord(
  e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
) {
  return e6position(e.lngLat.toArray(), 7) as Pos2;
}
