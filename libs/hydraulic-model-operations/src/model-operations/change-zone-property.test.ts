import { describe, it, expect } from "vitest";
import {
  changeZoneProperty,
  changeZoneProperties,
} from "./change-zone-property";
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

describe("changeZoneProperty", () => {
  it("changes only the given property of the given zone", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = changeZoneProperty(hydraulicModel, {
      zoneIds: [IDS.Z1],
      property: "label",
      value: "EAST",
    });
    applyOperation(hydraulicModel, changeSet, labelManager);

    expect(hydraulicModel.zones.get(IDS.Z1)).toEqual(
      buildZone({ id: IDS.Z1, label: "EAST", ...aSquare(0) }),
    );
    expect(hydraulicModel.zones.get(IDS.Z2)!.label).toBe("SOUTH");
  });

  it("restores the previous value on undo", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = changeZoneProperty(hydraulicModel, {
      zoneIds: [IDS.Z1],
      property: "label",
      value: "EAST",
    });
    const { undo } = applyOperation(hydraulicModel, changeSet, labelManager);
    undo();

    expect(hydraulicModel.zones.get(IDS.Z1)!.label).toBe("NORTH");
  });

  it("updates label manager after apply and undo", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = changeZoneProperty(hydraulicModel, {
      zoneIds: [IDS.Z1],
      property: "label",
      value: "EAST",
    });
    const { undo } = applyOperation(hydraulicModel, changeSet, labelManager);

    expect(labelManager.isLabelAvailable("EAST", "zone")).toBe(false);
    expect(labelManager.isLabelAvailable("NORTH", "zone")).toBe(true);

    undo();

    expect(labelManager.isLabelAvailable("EAST", "zone")).toBe(true);
    expect(labelManager.isLabelAvailable("NORTH", "zone")).toBe(false);
  });

  it("throws for a non-existent zone", () => {
    const hydraulicModel = buildModel();

    expect(() =>
      changeZoneProperty(hydraulicModel, {
        zoneIds: [999],
        property: "label",
        value: "EAST",
      }),
    ).toThrow("Zone 999 not found");
  });
});

describe("changeZoneProperties", () => {
  it("applies the label and custom attributes in one change", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = buildModel(labelManager);

    const changeSet = changeZoneProperties(hydraulicModel, {
      zoneIds: [IDS.Z1],
      changes: [
        { property: "label", value: "EAST" },
        { property: "custom-1", value: "LOW" },
        { property: "custom-2", value: 5 },
      ],
    });
    applyOperation(hydraulicModel, changeSet, labelManager);

    expect(hydraulicModel.zones.get(IDS.Z1)).toEqual(
      buildZone({
        id: IDS.Z1,
        label: "EAST",
        ...aSquare(0),
        customAttributes: { "custom-1": "LOW", "custom-2": 5 },
      }),
    );
    expect(hydraulicModel.zones.get(IDS.Z2)!.label).toBe("SOUTH");
  });

  it("restores the previous values on undo", () => {
    const { labelManager } = buildTestFactories();
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aZone({
        id: IDS.Z1,
        label: "NORTH",
        ...aSquare(0),
        customAttributes: { "custom-1": "HIGH" },
      })
      .build();

    const changeSet = changeZoneProperties(hydraulicModel, {
      zoneIds: [IDS.Z1],
      changes: [
        { property: "label", value: "EAST" },
        { property: "custom-1", value: "LOW" },
      ],
    });
    const { undo } = applyOperation(hydraulicModel, changeSet, labelManager);
    undo();

    expect(hydraulicModel.zones.get(IDS.Z1)).toEqual(
      buildZone({
        id: IDS.Z1,
        label: "NORTH",
        ...aSquare(0),
        customAttributes: { "custom-1": "HIGH" },
      }),
    );
  });

  it("throws for a non-existent zone", () => {
    const hydraulicModel = buildModel();

    expect(() =>
      changeZoneProperties(hydraulicModel, {
        zoneIds: [999],
        changes: [{ property: "label", value: "EAST" }],
      }),
    ).toThrow("Zone 999 not found");
  });
});
