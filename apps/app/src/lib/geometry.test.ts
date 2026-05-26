import { arePointsInLine } from "./geometry";
import type { Position } from "src/types";

describe("arePointsInLine", () => {
  it("returns false for vertex not on straight pipe", () => {
    const pipeCoordinates: Position[] = [
      [0, 0],
      [10, 0],
    ];
    const vertices: Position[] = [[5, 1]];

    expect(arePointsInLine(pipeCoordinates, vertices)).toBe(false);
  });

  it("returns true for vertices on multi-segment pipe", () => {
    const pipeCoordinates: Position[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    const vertices: Position[] = [
      [5, 0],
      [10, 5],
    ];

    expect(arePointsInLine(pipeCoordinates, vertices, 0.1)).toBe(true);
  });

  it("returns true for vertex within tolerance", () => {
    const pipeCoordinates: Position[] = [
      [0, 0],
      [10, 0],
    ];
    const vertices: Position[] = [[5, 0.0000002]];
    const tolerance = 1e-6;

    expect(arePointsInLine(pipeCoordinates, vertices, tolerance)).toBe(true);
  });

  it("respects custom tolerance parameter", () => {
    const pipeCoordinates: Position[] = [
      [0, 0],
      [10, 0],
    ];
    const vertices: Position[] = [[5, 0.005]];
    const customTolerance = 0.01;

    expect(arePointsInLine(pipeCoordinates, vertices, customTolerance)).toBe(
      true,
    );
  });
});
