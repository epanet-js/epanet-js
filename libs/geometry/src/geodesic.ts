import type { Position } from "geojson";
import { lineString } from "@turf/helpers";
import turfAlong from "@turf/along";
import turfDestination from "@turf/destination";
import turfDistance from "@turf/distance";
import turfLength from "@turf/length";
import turfNearestPointOnLine from "@turf/nearest-point-on-line";

const KILOMETERS = { units: "kilometers" } as const;

export type NearestPointWithChainage = {
  point: Position;
  distance: number;
  chainage: number;
  fraction: number;
};

export const geodesicDistance = (a: Position, b: Position): number =>
  turfDistance(a, b, KILOMETERS) * 1000;

export const geodesicLength = (line: Position[]): number =>
  turfLength(lineString(line), KILOMETERS) * 1000;

export const pointAlong = (line: Position[], meters: number): Position => {
  const clamped = Math.min(Math.max(meters, 0), geodesicLength(line));
  return turfAlong(lineString(line), clamped / 1000, KILOMETERS).geometry
    .coordinates;
};

export const nearestPointWithChainage = (
  line: Position[],
  position: Position,
): NearestPointWithChainage => {
  const nearest = turfNearestPointOnLine(
    lineString(line),
    position,
    KILOMETERS,
  );
  const chainage = (nearest.properties.location ?? 0) * 1000;
  const length = geodesicLength(line);
  return {
    point: nearest.geometry.coordinates,
    distance: (nearest.properties.dist ?? 0) * 1000,
    chainage,
    fraction: length === 0 ? 0 : chainage / length,
  };
};

export const destination = (
  from: Position,
  bearing: number,
  meters: number,
): Position =>
  turfDestination(from, meters / 1000, bearing, KILOMETERS).geometry
    .coordinates;
