import { describe, it, expect } from "vitest";
import { buildZoneFeatures } from "./zones";
import { Zone } from "src/hydraulic-model/zones";
import type { Polygon, MultiPolygon } from "geojson";

describe("buildZoneFeatures", () => {
  it("returns empty array for empty zones", () => {
    const zones = new Map();
    expect(buildZoneFeatures(zones)).toEqual([]);
  });

  it("builds a feature from a Polygon zone", () => {
    const zones = new Map([[1, new Zone(1, polygon, { label: "Z1" })]]);

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(1);
    expect(features[0].geometry).toEqual(polygon);
    expect(features[0].properties).toEqual({ id: 1, label: "Z1" });
  });

  it("builds a feature from a MultiPolygon zone", () => {
    const zones = new Map([[1, new Zone(1, multiPolygon, { label: "Z1" })]]);

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(1);
    expect(features[0].geometry).toEqual(multiPolygon);
  });

  it("builds features for multiple zones", () => {
    const zones = new Map([
      [1, new Zone(1, polygon, { label: "Z1" })],
      [2, new Zone(2, multiPolygon, { label: "Z2" })],
      [3, new Zone(3, polygon, { label: "Z3" })],
    ]);

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(3);
  });
});

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

const multiPolygon: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  ],
};
