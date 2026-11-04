import { describe, expect, it } from "vitest";
import { getCurveErrors, type CurvePoint, type CurveType } from "./curves";

const falling: CurvePoint[] = [
  { x: 0, y: 10 },
  { x: 1, y: 5 },
];
const rising: CurvePoint[] = [
  { x: 0, y: 5 },
  { x: 1, y: 10 },
];
const single: CurvePoint[] = [{ x: 1, y: 1 }];

describe("getCurveErrors", () => {
  it.each<[CurveType | undefined, CurvePoint[], boolean]>([
    ["pump", falling, true],
    ["pump", rising, false],
    ["pump", single, true],
    ["volume", rising, true],
    ["volume", falling, false],
    ["volume", single, false],
    ["valve", rising, true],
    ["valve", falling, false],
    ["valve", single, true],
    ["headloss", falling, true],
    ["headloss", single, false],
    ["efficiency", falling, true],
    ["efficiency", single, false],
    [undefined, falling, true],
    [undefined, single, false],
  ])("checks a %s curve by its type's rule", (type, points, isValid) => {
    expect(getCurveErrors(type, points).length === 0).toBe(isValid);
  });
});
