import { describe, it, expect } from "vitest";
import { removeZones } from "./remove-zones";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { applyOperation } from "../__helpers__/apply-operation";
import {
  buildTestFactories,
  buildZone,
} from "@epanet-js/hydraulic-model-testing";

const IDS = { Z1: 1, Z2: 2 } as const;

const aSquare = (x: number) => ({
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [
      [
        [
          [x, 0],
          [x + 1, 0],
          [x + 1, 1],
          [x, 1],
          [x, 0],
        ],
      ],
    ],
  },
  bbox: [x, 0, x + 1, 1] as [number, number, number, number],
});

const buildModel = (labelManager = buildTestFactories().labelManager) =>
  HydraulicModelBuilder.with({ labelManager })
    .aZone({ id: IDS.Z1, label: "NORTH", ...aSquare(0) })
    .aZone({ id: IDS.Z2, label: "SOUTH", ...aSquare(5) })
    .build();

describe("removeZones", () => {
  it("removes only the given zones", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = removeZones(hydraulicModel, { zoneIds: [IDS.Z1] });
    applyOperation(hydraulicModel, changeSet, labelManager);

    expect(hydraulicModel.zones.has(IDS.Z1)).toBe(false);
    expect(hydraulicModel.zones.get(IDS.Z2)!.label).toBe("SOUTH");
  });

  it("restores the zone and its label on undo", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = removeZones(hydraulicModel, { zoneIds: [IDS.Z1] });
    const { undo } = applyOperation(hydraulicModel, changeSet, labelManager);

    expect(labelManager.isLabelAvailable("NORTH", "zone")).toBe(true);

    undo();

    expect(hydraulicModel.zones.get(IDS.Z1)).toEqual(
      buildZone({ id: IDS.Z1, label: "NORTH", ...aSquare(0) }),
    );
    expect(labelManager.isLabelAvailable("NORTH", "zone")).toBe(false);
  });

  it("throws for a non-existent zone", () => {
    const hydraulicModel = buildModel();

    expect(() => removeZones(hydraulicModel, { zoneIds: [999] })).toThrow(
      "Zone 999 not found",
    );
  });
});
