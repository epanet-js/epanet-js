import { describe, it, expect } from "vitest";
import type { ZoneFeature } from "./read-zone-features";
import { importZoneFeatures } from "./import-zone-features";

describe("importZoneFeatures", () => {
  it("generates auto labels when no label property is provided", () => {
    const features = [polygonFeature(), polygonFeature()];

    const zones = importZoneFeatures(features);

    expect(zones[1].label).toBe("Z2");
    expect(zones[2].label).toBe("Z3");
  });

  it("uses the specified label property", () => {
    const features = [
      polygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone B" }),
    ];

    const zones = importZoneFeatures(features, "name");

    expect(zones[1].label).toBe("Zone A");
    expect(zones[2].label).toBe("Zone B");
  });

  it("falls back to auto label when property is missing on a feature", () => {
    const features = [polygonFeature({ name: "Zone A" }), polygonFeature({})];

    const zones = importZoneFeatures(features, "name");

    expect(zones[1].label).toBe("Zone A");
    expect(zones[2].label).toBe("Z2");
  });

  it("converts Polygon geometry to MultiPolygon", () => {
    const features = [polygonFeature()];

    const zones = importZoneFeatures(features);

    expect(zones[1].geometry.type).toBe("MultiPolygon");
    expect(zones[1].geometry.coordinates).toEqual([
      [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    ]);
  });

  it("preserves MultiPolygon geometry as-is", () => {
    const features = [multiPolygonFeature()];

    const zones = importZoneFeatures(features);

    expect(zones[1].geometry.type).toBe("MultiPolygon");
  });

  it("assigns sequential ids starting from 1", () => {
    const features = [polygonFeature(), polygonFeature(), polygonFeature()];

    const zones = importZoneFeatures(features);

    expect(Object.keys(zones)).toEqual(["1", "2", "3"]);
    expect(zones[1].id).toBe(1);
    expect(zones[2].id).toBe(2);
    expect(zones[3].id).toBe(3);
  });
});

const polygonFeature = (
  properties: Record<string, unknown> = {},
): ZoneFeature => ({
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
  properties,
});

const multiPolygonFeature = (
  properties: Record<string, unknown> = {},
): ZoneFeature => ({
  type: "Feature",
  geometry: {
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
  },
  properties,
});
