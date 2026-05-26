import { describe, it, expect } from "vitest";
import { applyZoneImport } from "./apply-zone-import";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Zone } from "src/hydraulic-model/zones";
import type { ZoneFeature } from "src/commands/read-zone-features";
import type { Polygon, MultiPolygon } from "geojson";

describe("applyZoneImport", () => {
  it("builds zones from features and sets them on the model", () => {
    const model = HydraulicModelBuilder.with().build();
    const features = [
      makeFeature(polygon, { name: "North" }),
      makeFeature(polygon, { name: "South" }),
    ];

    const updated = applyZoneImport(model, features, "name");

    expect(updated.zones.size).toBe(2);
    const labels = Array.from(updated.zones.values()).map((z) => z.label);
    expect(labels).toContain("North");
    expect(labels).toContain("South");
  });

  it("auto-generates labels when no label property is provided", () => {
    const model = HydraulicModelBuilder.with().build();
    const features = [makeFeature(polygon), makeFeature(polygon)];

    const updated = applyZoneImport(model, features, undefined);

    expect(updated.zones.size).toBe(2);
    const labels = Array.from(updated.zones.values()).map((z) => z.label);
    expect(labels).toContain("Z1");
    expect(labels).toContain("Z2");
  });

  it("replaces existing zones", () => {
    const model = HydraulicModelBuilder.with().build();
    model.zones.set(99, new Zone(99, polygon, { label: "Old" }));

    const updated = applyZoneImport(model, [makeFeature(polygon)], undefined);

    expect(updated.zones.has(99)).toBe(false);
    expect(updated.zones.size).toBe(1);
  });

  it("preserves geometry on created zones", () => {
    const model = HydraulicModelBuilder.with().build();
    const features = [makeFeature(multiPolygon)];

    const updated = applyZoneImport(model, features, undefined);

    const zone = Array.from(updated.zones.values())[0];
    expect(zone.geometry).toEqual(multiPolygon);
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
