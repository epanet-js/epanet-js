import { describe, it, expect } from "vitest";
import { buildZoneFeatures } from "./zones";
import type { MultiPolygon } from "geojson";

describe("buildZoneFeatures", () => {
  it("builds a feature from a MultiPolygon zone", () => {
    const zones = { 1: { label: "Z1", id: 1, geometry: multiPolygon } };

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(1);
    expect(features[0].geometry).toEqual(multiPolygon);
  });

  it("builds features for multiple zones", () => {
    const zones = {
      1: { label: "Z1", id: 1, geometry: multiPolygon },
      2: { label: "Z2", id: 2, geometry: multiPolygon },
    };

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(3);
  });
});

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
