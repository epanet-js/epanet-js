import { describe, it, expect } from "vitest";
import type { ZoneFeature } from "./read-zone-features";
import { importZoneFeatures } from "./import-zone-features";

describe("importZoneFeatures", () => {
  it("generates auto labels when no label property is provided", () => {
    const features = [polygonFeature(), polygonFeature()];

    const { zones } = importZoneFeatures(features);

    expect(zones.get(1)!.label).toBe("Z2");
    expect(zones.get(2)!.label).toBe("Z3");
  });

  it("uses the specified label property", () => {
    const features = [
      polygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone B" }),
    ];

    const { zones } = importZoneFeatures(features, "name");

    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(2)!.label).toBe("Zone B");
  });

  it("falls back to auto label when property is missing on a feature", () => {
    const features = [polygonFeature({ name: "Zone A" }), polygonFeature({})];

    const { zones } = importZoneFeatures(features, "name");

    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(2)!.label).toBe("Z2");
  });

  it("converts Polygon geometry to MultiPolygon", () => {
    const features = [polygonFeature()];

    const { zones } = importZoneFeatures(features);

    expect(zones.get(1)!.geometry.type).toBe("MultiPolygon");
    expect(zones.get(1)!.geometry.coordinates).toEqual([
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

    const { zones } = importZoneFeatures(features);

    expect(zones.get(1)!.geometry.type).toBe("MultiPolygon");
  });

  it("assigns sequential ids starting from 1", () => {
    const features = [polygonFeature(), polygonFeature(), polygonFeature()];

    const { zones } = importZoneFeatures(features);

    expect([...zones.keys()]).toEqual([1, 2, 3]);
    expect(zones.get(1)!.id).toBe(1);
    expect(zones.get(2)!.id).toBe(2);
    expect(zones.get(3)!.id).toBe(3);
  });

  it("merges features with the same label into a single zone", () => {
    const features = [
      polygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone A" }, [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2],
      ]),
      polygonFeature({ name: "Zone B" }),
    ];

    const { zones } = importZoneFeatures(features, "name");

    expect(zones.size).toBe(2);
    expect(zones.get(1)!.label).toBe("Zone A");
    expect(zones.get(1)!.geometry.coordinates).toHaveLength(2);
    expect(zones.get(2)!.label).toBe("Zone B");
    expect(zones.get(2)!.geometry.coordinates).toHaveLength(1);
  });

  it("returns merged zone info for zones with multiple features", () => {
    const features = [
      polygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone A" }, [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2],
      ]),
      polygonFeature({ name: "Zone B" }),
    ];

    const { mergedZones } = importZoneFeatures(features, "name");

    expect(mergedZones).toEqual([{ label: "Zone A", featureCount: 2 }]);
  });

  it("returns empty mergedZones when no merging occurs", () => {
    const features = [
      polygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone B" }),
    ];

    const { mergedZones } = importZoneFeatures(features, "name");

    expect(mergedZones).toEqual([]);
  });

  it("merges MultiPolygon features with the same label", () => {
    const features = [
      multiPolygonFeature({ name: "Zone A" }),
      polygonFeature({ name: "Zone A" }),
    ];

    const { zones } = importZoneFeatures(features, "name");

    expect(zones.size).toBe(1);
    expect(zones.get(1)!.geometry.coordinates).toHaveLength(2);
  });

  it("does not merge when no label property is provided", () => {
    const features = [polygonFeature(), polygonFeature()];

    const { zones, mergedZones } = importZoneFeatures(features);

    expect(zones.size).toBe(2);
    expect(mergedZones).toEqual([]);
  });
});

const polygonFeature = (
  properties: Record<string, unknown> = {},
  coordinates = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 0],
  ],
): ZoneFeature => ({
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [coordinates],
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
