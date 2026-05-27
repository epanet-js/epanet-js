import { describe, it, expect } from "vitest";
import {
  junctionCircleRadius,
  junctionLayerMinZoom,
  MAP_MAX_ZOOM,
  LAYER_MAX_ZOOM,
} from "./node-size";
import { defaultNodeSizeConfig } from "src/map/symbology/symbology-types";

describe("junctionCircleRadius", () => {
  it("interpolates minSize at minVisibleZoom up to maxSize at the max map zoom", () => {
    expect(junctionCircleRadius(defaultNodeSizeConfig)).toEqual([
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
      junctionCircleRadius({
        minVisibleZoom: 14,
        minSize: 2,
        maxSize: 12,
      }),
    ).toEqual(["interpolate", ["linear"], ["zoom"], 14, 2, MAP_MAX_ZOOM, 12]);
  });

  it("returns a flat radius (no interpolation) when min and max size are equal", () => {
    expect(
      junctionCircleRadius({ minVisibleZoom: 12, minSize: 4, maxSize: 4 }),
    ).toBe(4);
  });
});

describe("junctionLayerMinZoom", () => {
  it("uses the configured min visible zoom", () => {
    expect(
      junctionLayerMinZoom({ minVisibleZoom: 12, minSize: 1, maxSize: 5 }),
    ).toBe(12);
  });

  it("clamps to the style-spec layer max (24) above it", () => {
    expect(
      junctionLayerMinZoom({ minVisibleZoom: 26, minSize: 1, maxSize: 5 }),
    ).toBe(LAYER_MAX_ZOOM);
  });
});
