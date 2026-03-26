// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";

export function crsToLngLat(
  coord: [number, number],
  proj4Def: string,
): [number, number] {
  return proj4(proj4Def, "EPSG:4326", coord) as [number, number];
}

export function lngLatToCrs(
  coord: [number, number],
  proj4Def: string,
): [number, number] {
  return proj4("EPSG:4326", proj4Def, coord) as [number, number];
}
