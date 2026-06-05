import { describe, it, expect } from "vitest";
import { buildZoneFeatures } from "./zones";
import type { MultiPolygon } from "geojson";
import type { Zone } from "src/lib/zones";

describe("buildZoneFeatures", () => {
  it("builds a feature from a MultiPolygon zone", () => {
    const zones = { 1: makeZone(1, "Z1") };

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(1);
    expect(features[0].geometry).toEqual(multiPolygon);
  });

  it("builds features for multiple zones", () => {
    const zones = {
      1: makeZone(1, "Z1"),
      2: makeZone(2, "Z2"),
    };

    const features = buildZoneFeatures(zones);

    expect(features).toHaveLength(2);
    expect(features[0].properties?.label).toEqual("Z1");
    expect(features[1].properties?.label).toEqual("Z2");
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

const makeZone = (id: number, label: string): Zone => ({
  id,
  label,
  geometry: multiPolygon,
  bbox: [0, 0, 1, 1],
});
