import { describe, it, expect } from "vitest";
import { getLabelProperties } from "./get-label-properties";
import type { ZoneFeature } from "./read-zone-features";

describe("getLabelProperties", () => {
  it("returns properties present in all features with unique values", () => {
    const features = [
      aZone({ name: "Zone A", region: "north", id: 1, owner: "someone" }),
      aZone({ name: "Zone B", region: "north", id: 2, owner: null, a: 123 }),
    ];

    const result = getLabelProperties(features);

    expect(result).toContain("name");
    expect(result).toContain("id");
    expect(result).not.toContain("region");
    expect(result).not.toContain("owner");
    expect(result).not.toContain("a");
  });

  it("treats numeric values as unique by their string representation", () => {
    const features = [
      aZone({ id: 1, value: 100 }),
      aZone({ id: 2, value: 100 }),
    ];

    const result = getLabelProperties(features);

    expect(result).toContain("id");
    expect(result).not.toContain("value");
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
