import { describe, it, expect } from "vitest";
import { junctionCircleRadiusExpression, MAP_MAX_ZOOM } from "./node-size";
import { defaultNodeSizeConfig } from "src/map/symbology/symbology-types";

describe("junctionCircleRadiusExpression", () => {
  it("interpolates minSize at minVisibleZoom up to maxSize at the max map zoom", () => {
    expect(junctionCircleRadiusExpression(defaultNodeSizeConfig)).toEqual([
      "interpolate",
      ["linear"],
      ["zoom"],
      12,
      0.5,
      MAP_MAX_ZOOM,
      5,
    ]);
  });

  it("uses the configured min zoom and sizes as the interpolation stops", () => {
    expect(
      junctionCircleRadiusExpression({
        minVisibleZoom: 14,
        minSize: 2,
        maxSize: 12,
      }),
    ).toEqual(["interpolate", ["linear"], ["zoom"], 14, 2, MAP_MAX_ZOOM, 12]);
  });

  it("keeps stops strictly ascending when minVisibleZoom reaches the max zoom", () => {
    const expr = junctionCircleRadiusExpression({
      minVisibleZoom: MAP_MAX_ZOOM,
      minSize: 1,
      maxSize: 8,
    });

    const lowerZoom = expr[3] as number;
    const upperZoom = expr[5] as number;
    expect(lowerZoom).toBe(MAP_MAX_ZOOM);
    expect(upperZoom).toBeGreaterThan(lowerZoom);
  });

  it("guards the upper stop above minVisibleZoom even beyond the max zoom", () => {
    const expr = junctionCircleRadiusExpression({
      minVisibleZoom: 30,
      minSize: 1,
      maxSize: 8,
    });

    expect(expr[5]).toBe(30.5);
  });
});
