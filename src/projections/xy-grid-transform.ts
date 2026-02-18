import { Position } from "geojson";

export const METERS_PER_DEGREE = 111_320;

export const computeCentroid = (points: Position[]): Position => {
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p[0];
    sumY += p[1];
  }
  return [sumX / points.length, sumY / points.length];
};

export const transformPoint = (
  point: Position,
  centroid: Position,
): Position => [
  Math.max(-180, Math.min(180, (point[0] - centroid[0]) / METERS_PER_DEGREE)),
  Math.max(-90, Math.min(90, (point[1] - centroid[1]) / METERS_PER_DEGREE)),
];
