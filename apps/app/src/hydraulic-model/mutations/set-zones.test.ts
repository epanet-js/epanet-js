import { describe, it, expect } from "vitest";
import { setZones } from "./set-zones";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Zone } from "src/hydraulic-model/zones";
import type { Polygon } from "geojson";

describe("setZones", () => {
  it("sets zones on an empty model", () => {
    const IDS = { Z1: 1, Z2: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with().build();

    const updatedModel = setZones(hydraulicModel, [
      new Zone(IDS.Z1, polygon, { label: "Z1" }),
      new Zone(IDS.Z2, polygon, { label: "Z2" }),
    ]);

    expect(updatedModel.zones.size).toBe(2);
    expect(updatedModel.zones.get(IDS.Z1)?.label).toBe("Z1");
    expect(updatedModel.zones.get(IDS.Z2)?.label).toBe("Z2");
  });

  it("clears existing zones when setting new ones", () => {
    const IDS = { OLD: 1, NEW: 2 } as const;
    const hydraulicModel = HydraulicModelBuilder.with().build();
    hydraulicModel.zones.set(
      IDS.OLD,
      new Zone(IDS.OLD, polygon, { label: "Old" }),
    );

    const updatedModel = setZones(hydraulicModel, [
      new Zone(IDS.NEW, polygon, { label: "New" }),
    ]);

    expect(updatedModel.zones.size).toBe(1);
    expect(updatedModel.zones.has(IDS.OLD)).toBe(false);
    expect(updatedModel.zones.has(IDS.NEW)).toBe(true);
  });

  it("handles empty zones array", () => {
    const IDS = { Z1: 1 } as const;
    const hydraulicModel = HydraulicModelBuilder.with().build();
    hydraulicModel.zones.set(
      IDS.Z1,
      new Zone(IDS.Z1, polygon, { label: "Z1" }),
    );

    const updatedModel = setZones(hydraulicModel, []);

    expect(updatedModel.zones.size).toBe(0);
  });

  it("returns a new model instance", () => {
    const IDS = { Z1: 1 } as const;
    const originalModel = HydraulicModelBuilder.with().build();

    const updatedModel = setZones(originalModel, [
      new Zone(IDS.Z1, polygon, { label: "Z1" }),
    ]);

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.zones).not.toBe(originalModel.zones);
    expect(originalModel.zones.size).toBe(0);
    expect(updatedModel.zones.size).toBe(1);
  });
});

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};
