import { describe, it, expect } from "vitest";
import { buildZonesFromFeatures } from "./build-zones-from-features";
import type { ZoneFeature } from "src/commands/read-zone-features";
import type { Polygon, MultiPolygon } from "geojson";

describe("buildZonesFromFeatures", () => {
  it("auto-generates labels when no property is selected", () => {
    const features = [
      makeFeature(polygon),
      makeFeature(polygon),
      makeFeature(polygon),
    ];

    const zones = buildZonesFromFeatures(features, undefined);

    expect(zones).toHaveLength(3);
    expect(zones[0].label).toBe("Z1");
    expect(zones[1].label).toBe("Z2");
    expect(zones[2].label).toBe("Z3");
  });

  it("uses the specified property as label", () => {
    const features = [
      makeFeature(polygon, { name: "North" }),
      makeFeature(polygon, { name: "South" }),
    ];

    const zones = buildZonesFromFeatures(features, "name");

    expect(zones[0].label).toBe("North");
    expect(zones[1].label).toBe("South");
  });

  it("assigns unique ids to each zone", () => {
    const features = [makeFeature(polygon), makeFeature(polygon)];

    const zones = buildZonesFromFeatures(features, undefined);

    expect(zones[0].id).not.toBe(zones[1].id);
  });

  it("preserves geometry on created zones", () => {
    const features = [makeFeature(polygon, {}), makeFeature(multiPolygon, {})];

    const zones = buildZonesFromFeatures(features, undefined);

    expect(zones[0].geometry).toEqual(polygon);
    expect(zones[1].geometry).toEqual(multiPolygon);
  });

  it("auto-generates label when property is missing from a feature", () => {
    const features = [
      makeFeature(polygon, { name: "A" }),
      makeFeature(polygon, {}),
    ];

    const zones = buildZonesFromFeatures(features, "name");

    expect(zones[0].label).toBe("A");
    expect(zones[1].label).toBe("Z1");
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

const makeFeature = (
  geometry: Polygon | MultiPolygon,
  properties: Record<string, unknown> = {},
): ZoneFeature => ({
  type: "Feature",
  geometry,
  properties,
});
