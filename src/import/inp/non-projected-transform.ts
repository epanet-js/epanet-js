import { Position } from "geojson";
import { InpData, ItemData } from "./inp-data";
import { computeCentroid, transformPoint } from "src/projections";

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
