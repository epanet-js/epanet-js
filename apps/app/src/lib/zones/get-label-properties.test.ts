import { describe, it, expect } from "vitest";
import { getLabelProperties } from "./get-label-properties";
import type { ZoneFeature } from "./read-zone-features";

describe("getLabelProperties", () => {
  it("returns properties present in all features with non-null values", () => {
    const features = [
      aZone({ name: "Zone A", region: "north", id: 1, owner: "someone" }),
      aZone({ name: "Zone B", region: "north", id: 2, owner: null, a: 123 }),
    ];

    const result = getLabelProperties(features);

    expect(result).toContain("name");
    expect(result).toContain("id");
    expect(result).toContain("region");
    expect(result).not.toContain("owner");
    expect(result).not.toContain("a");
  });

  it("excludes properties with empty string, whitespace, or null-byte values", () => {
    const features = [
      aZone({
        name: "Zone A",
        empty: "",
        whitespace: "   ",
        nullBytes: "\0\0",
      }),
      aZone({ name: "Zone B", empty: "x", whitespace: "y", nullBytes: "z" }),
    ];

    const result = getLabelProperties(features);

    expect(result).toContain("name");
    expect(result).not.toContain("empty");
    expect(result).not.toContain("whitespace");
    expect(result).not.toContain("nullBytes");
  });

  it("allows properties with duplicate values", () => {
    const features = [
      aZone({ id: 1, value: 100 }),
      aZone({ id: 2, value: 100 }),
    ];

    const result = getLabelProperties(features);

    expect(result).toContain("id");
    expect(result).toContain("value");
  });
});

const aZone = (properties: Record<string, unknown> | null): ZoneFeature => ({
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
