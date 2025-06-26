import { Position } from "src/types";

export function lockDirection(lastCoord: Position, nextCoord: Position): Pos2 {
  // Use euclidean projected coordinates for this
  const angleBetween = Math.atan2(
    lastCoord[1] - nextCoord[1],
    lastCoord[0] - nextCoord[0],
  );

  if (
    Math.abs(angleBetween) < Math.PI / 4 ||
    Math.abs(angleBetween) > Math.PI * (3 / 4)
  ) {
    return [nextCoord[0], lastCoord[1]];
  }
  return [lastCoord[0], nextCoord[1]];
}
