import type { Position } from "geojson";
import {
  destination,
  geodesicDistance,
  geodesicLength,
  nearestPointWithChainage,
  pointAlong,
} from "./geodesic";

const oneDegreeAtEquator = 111195.08;

describe("geodesic helpers", () => {
  it("measures distance and length in meters", () => {
    const line: Position[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];

    expect(geodesicDistance([0, 0], [1, 0])).toBeCloseTo(oneDegreeAtEquator, 0);
    expect(geodesicLength(line)).toBeCloseTo(2 * oneDegreeAtEquator, 0);
  });

  it("walks along a line, clamped to its ends", () => {
    const line: Position[] = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];

    const atCorner = pointAlong(line, oneDegreeAtEquator);
    expect(atCorner[0]).toBeCloseTo(1, 6);
    expect(atCorner[1]).toBeCloseTo(0, 6);
    expect(pointAlong(line, -10)).toEqual([0, 0]);
    expect(pointAlong(line, 10 * oneDegreeAtEquator)).toEqual([1, 1]);
  });

  it("finds the nearest point with its offset, chainage and fraction", () => {
    const line: Position[] = [
      [0, 0],
      [1, 0],
    ];

    const nearest = nearestPointWithChainage(line, [0.5, 0.001]);

    expect(nearest.point[0]).toBeCloseTo(0.5, 6);
    expect(nearest.point[1]).toBeCloseTo(0, 6);
    expect(nearest.distance).toBeCloseTo(oneDegreeAtEquator / 1000, 0);
    expect(nearest.chainage).toBeCloseTo(oneDegreeAtEquator / 2, 0);
    expect(nearest.fraction).toBeCloseTo(0.5, 6);
  });

  it("gives a zero fraction on a zero-length line", () => {
    const nearest = nearestPointWithChainage(
      [
        [1, 1],
        [1, 1],
      ],
      [2, 2],
    );

    expect(nearest.chainage).toEqual(0);
    expect(nearest.fraction).toEqual(0);
  });

  it("places a point a distance away on a bearing", () => {
    const east = destination([0, 0], 90, 1000);

    expect(east[1]).toBeCloseTo(0, 6);
    expect(geodesicDistance([0, 0], east)).toBeCloseTo(1000, 3);
  });
});
