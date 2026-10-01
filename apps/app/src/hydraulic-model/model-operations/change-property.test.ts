import type { ChangeSet } from "@epanet-js/change-set";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { applyOperation } from "src/__helpers__/apply-operation";
import type { HydraulicModel } from "src/hydraulic-model";
import {
  changeProperty,
  changeProperties,
  type ChangeableProperty,
  type PropertyChange,
} from "./change-property";

const { labelManager } = buildTestFactories();

const aModel = () => HydraulicModelBuilder.with({ labelManager });

const apply = (model: HydraulicModel, changeSet: ChangeSet) => {
  applyOperation(model, changeSet, labelManager);
  return changeSet;
};

const changedIds = (changeSet: ChangeSet) =>
  changeSet.records.map((record) => record.id);

const prop = (model: HydraulicModel, id: number, name: string) =>
  model.assets.get(id)!.getProperty(name);

describe("change property", () => {
  it("changes a property of an asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.junctionID, { elevation: 15 })
      .build();

    apply(
      hydraulicModel,
      changeProperty(hydraulicModel, {
        assetIds: [IDS.junctionID],
        property: "elevation",
        value: 20,
      }),
    );

    expect(prop(hydraulicModel, IDS.junctionID, "elevation")).toBe(20);
  });

  it("can change properties of many assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();

    apply(
      hydraulicModel,
      changeProperty(hydraulicModel, {
        assetIds: [IDS.A, IDS.B],
        property: "elevation",
        value: 20,
      }),
    );

    expect(prop(hydraulicModel, IDS.A, "elevation")).toBe(20);
    expect(prop(hydraulicModel, IDS.B, "elevation")).toBe(20);
  });

  it("ignores assets that do not have the property provided", () => {
    const IDS = { A: 1, B: 2, PIPE: 3 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.A)
      .aJunction(IDS.B)
      .aPipe(IDS.PIPE, { diameter: 10 })
      .build();

    const changeSet = apply(
      hydraulicModel,
      changeProperty(hydraulicModel, {
        assetIds: [IDS.A, IDS.B, IDS.PIPE],
        property: "diameter",
        value: 20,
      }),
    );

    expect(changedIds(changeSet)).toEqual([IDS.PIPE]);
    expect(prop(hydraulicModel, IDS.PIPE, "diameter")).toBe(20);
  });

  it("silently ignores isActive property changes", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = aModel().aJunction(IDS.J1).build();

    const changeSet = changeProperty(hydraulicModel, {
      assetIds: [IDS.J1],
      property: "isActive",
      value: false,
    });

    expect(changeSet.size).toBe(0);
  });
});

describe("change properties", () => {
  it("changes multiple properties of a single asset", () => {
    const IDS = { junctionID: 1 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.junctionID, { elevation: 15 })
      .build();

    apply(
      hydraulicModel,
      changeProperties(hydraulicModel, {
        assetIds: [IDS.junctionID],
        changes: [
          { property: "elevation", value: 20 },
          { property: "label", value: "RENAMED" },
        ],
      }),
    );

    expect(prop(hydraulicModel, IDS.junctionID, "elevation")).toBe(20);
    expect(prop(hydraulicModel, IDS.junctionID, "label")).toBe("RENAMED");
  });

  it("changes multiple properties across multiple assets", () => {
    const IDS = { A: 1, B: 2 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.A, { elevation: 15 })
      .aReservoir(IDS.B, { elevation: 35 })
      .build();

    apply(
      hydraulicModel,
      changeProperties(hydraulicModel, {
        assetIds: [IDS.A, IDS.B],
        changes: [{ property: "elevation", value: 20 }],
      }),
    );

    expect(prop(hydraulicModel, IDS.A, "elevation")).toBe(20);
    expect(prop(hydraulicModel, IDS.B, "elevation")).toBe(20);
  });

  it("ignores properties an asset does not have", () => {
    const IDS = { A: 1, PIPE: 2 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.A)
      .aPipe(IDS.PIPE, { diameter: 10 })
      .build();

    const changeSet = apply(
      hydraulicModel,
      changeProperties(hydraulicModel, {
        assetIds: [IDS.A, IDS.PIPE],
        changes: [{ property: "diameter", value: 20 }],
      }),
    );

    expect(changedIds(changeSet)).toEqual([IDS.PIPE]);
    expect(prop(hydraulicModel, IDS.PIPE, "diameter")).toBe(20);
  });

  it("silently ignores isActive property changes", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const changeSet = apply(
      hydraulicModel,
      changeProperties(hydraulicModel, {
        assetIds: [IDS.J1],
        changes: [
          { property: "isActive", value: false },
          { property: "elevation", value: 20 },
        ],
      }),
    );

    expect(changeSet.records[0].after).toEqual({ elevation: 20 });
    expect(prop(hydraulicModel, IDS.J1, "isActive")).toBe(true);
    expect(prop(hydraulicModel, IDS.J1, "elevation")).toBe(20);
  });

  it("throws on invalid asset id", () => {
    const hydraulicModel = aModel().aJunction(1).build();

    expect(() =>
      changeProperties(hydraulicModel, {
        assetIds: [999],
        changes: [{ property: "elevation", value: 20 }],
      }),
    ).toThrow("Invalid asset id 999");
  });
});

describe("custom attribute properties", () => {
  it("sets a custom-<id> property even when the asset does not have it yet", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = aModel().aJunction(IDS.J1).build();

    apply(
      hydraulicModel,
      changeProperty(hydraulicModel, {
        assetIds: [IDS.J1],
        property: "custom-1" as ChangeableProperty,
        value: "high" as never,
      }),
    );

    expect(prop(hydraulicModel, IDS.J1, "custom-1")).toBe("high");
  });

  it("keeps mapped keys while carrying the custom key in a mixed change", () => {
    const IDS = { J1: 1 } as const;
    const hydraulicModel = aModel()
      .aJunction(IDS.J1, { elevation: 15 })
      .build();

    apply(
      hydraulicModel,
      changeProperties(hydraulicModel, {
        assetIds: [IDS.J1],
        changes: [
          { property: "elevation", value: 20 },
          { property: "custom-2", value: 5 },
        ] as PropertyChange[],
      }),
    );

    expect(prop(hydraulicModel, IDS.J1, "elevation")).toBe(20);
    expect(prop(hydraulicModel, IDS.J1, "custom-2")).toBe(5);
  });
});
