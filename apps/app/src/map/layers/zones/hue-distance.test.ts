import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHue,
  hueDistance,
  colorDistSq,
  buildHueGroupMap,
} from "./hue-distance";

describe("hexToRgb", () => {
  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("parses white", () => {
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
  });

  it("parses an arbitrary color", () => {
    expect(hexToRgb("#7F3C8D")).toEqual([127, 60, 141]);
  });
});

describe("rgbToHue", () => {
  it("returns 0 for pure red", () => {
    expect(rgbToHue([255, 0, 0])).toBeCloseTo(0);
  });

  it("returns 120 for pure green", () => {
    expect(rgbToHue([0, 255, 0])).toBeCloseTo(120);
  });

  it("returns 240 for pure blue", () => {
    expect(rgbToHue([0, 0, 255])).toBeCloseTo(240);
  });

  it("returns 0 for achromatic colors", () => {
    expect(rgbToHue([128, 128, 128])).toBe(0);
  });
});

describe("hueDistance", () => {
  it("returns direct difference for close hues", () => {
    expect(hueDistance(30, 50)).toBe(20);
  });

  it("wraps around 360", () => {
    expect(hueDistance(10, 350)).toBe(20);
  });

  it("is symmetric", () => {
    expect(hueDistance(100, 250)).toBe(hueDistance(250, 100));
  });

  it("returns 180 for opposite hues", () => {
    expect(hueDistance(0, 180)).toBe(180);
  });
});

describe("colorDistSq", () => {
  it("returns 0 for identical colors", () => {
    expect(colorDistSq([100, 100, 100], [100, 100, 100])).toBe(0);
  });

  it("returns squared euclidean distance", () => {
    expect(colorDistSq([0, 0, 0], [3, 4, 0])).toBe(25);
  });
});

describe("buildHueGroupMap", () => {
  it("groups colors within the threshold", () => {
    const palette = ["#FF0000", "#FF3300", "#00FF00"];
    const groups = buildHueGroupMap(palette, 40);
    expect(groups.has(0)).toBe(true);
    expect(groups.get(0)).toEqual(groups.get(1));
    expect(groups.has(2)).toBe(false);
  });

  it("returns empty map when no colors are close", () => {
    const palette = ["#FF0000", "#00FF00", "#0000FF"];
    const groups = buildHueGroupMap(palette, 10);
    expect(groups.size).toBe(0);
  });

  it("forms transitive groups", () => {
    const palette = ["#FF0000", "#FF1A00", "#FF3300"];
    const groups = buildHueGroupMap(palette, 20);
    const group = groups.get(0)!;
    expect(group.size).toBe(3);
    expect(group).toEqual(groups.get(1));
    expect(group).toEqual(groups.get(2));
  });
});
