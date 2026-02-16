import { Position } from "geojson";
import { InpData, ItemData } from "./inp-data";

const METERS_PER_DEGREE = 111_320;

export const transformNonProjectedCoordinates = (inpData: InpData): void => {
  const allPoints = collectAllPoints(inpData.coordinates, inpData.vertices);

  if (allPoints.length === 0) return;

  const centroid = computeCentroid(allPoints);

  for (const [id, position] of inpData.coordinates.entries()) {
    inpData.coordinates.set(id, transformPoint(position, centroid));
  }

  for (const [id, positions] of inpData.vertices.entries()) {
    inpData.vertices.set(
      id,
      positions.map((p) => transformPoint(p, centroid)),
    );
  }
};

const collectAllPoints = (
  coordinates: ItemData<Position>,
  vertices: ItemData<Position[]>,
): Position[] => {
  const points: Position[] = [];
  for (const [, position] of coordinates.entries()) {
    points.push(position);
  }
  for (const [, positions] of vertices.entries()) {
    for (const p of positions) {
      points.push(p);
    }
  }
  return points;
};

const computeCentroid = (points: Position[]): Position => {
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += p[0];
    sumY += p[1];
  }
  return [sumX / points.length, sumY / points.length];
};

const transformPoint = (point: Position, centroid: Position): Position => [
  Math.max(-180, Math.min(180, (point[0] - centroid[0]) / METERS_PER_DEGREE)),
  Math.max(-90, Math.min(90, (point[1] - centroid[1]) / METERS_PER_DEGREE)),
];
