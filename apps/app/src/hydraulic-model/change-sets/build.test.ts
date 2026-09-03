import { describe, it, expect } from "vitest";
import { WHOLE_VALUE } from "@epanet-js/change-set";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { changeSet } from "./build";
import {
  dropAssets,
  putAssets,
  replaceCurves,
  setAsset,
  setDemands,
  setPipeLibrary,
} from "./intents";

describe("change-set builder", () => {
  it("records a new asset as a create", () => {
    const IDS = { J1: 1, J2: 2 } as const;
    const { labelManager, assetFactory } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const junction = assetFactory.createJunction({
      id: IDS.J2,
      coordinates: [5, 5],
      elevation: 20,
    });
    const built = changeSet(model, "addNode", [putAssets([junction])]);
    const record = built.records[0];

    expect(built.records).toHaveLength(1);
    expect(record.kind).toBe("create");
    expect(record.entity).toBe("junction");
    expect(record.id).toBe(IDS.J2);
    expect(record.before).toEqual({});
    expect(record.after.elevation).toBe(20);
    expect(record.after.coordinates).toEqual([5, 5]);
  });

  it("records a put over an existing asset as an update of what moved", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const edited = model.assets.get(IDS.J1)!.copy();
    edited.setProperty("elevation", 42);

    const built = changeSet(model, "changeProperty", [putAssets([edited])]);
    const record = built.records[0];

    expect(record.kind).toBe("update");
    expect(record.before).toEqual({ elevation: 10 });
    expect(record.after).toEqual({ elevation: 42 });
  });

  it("produces nothing when a put changes no value", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const untouched = model.assets.get(IDS.J1)!.copy();

    expect(changeSet(model, "noop", [putAssets([untouched])]).isEmpty).toBe(
      true,
    );
  });

  it("records a patch against only the named fields", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const built = changeSet(model, "changeProperty", [
      setAsset(IDS.J1, { elevation: 99 }),
    ]);
    const record = built.records[0];

    expect(Object.keys(record.after)).toEqual(["elevation"]);
    expect(record.before).toEqual({ elevation: 10 });
  });

  it("records a delete carrying the whole asset as before", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const built = changeSet(model, "deleteAssets", [dropAssets([IDS.J1])]);
    const record = built.records[0];

    expect(record.kind).toBe("delete");
    expect(record.before.elevation).toBe(10);
    expect(record.before.coordinates).toBeDefined();
    expect(record.after).toEqual({});
  });

  it("skips ids that are not in the model", () => {
    const IDS = { J1: 1, MISSING: 404 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .build();

    expect(
      changeSet(model, "deleteAssets", [dropAssets([IDS.MISSING])]).isEmpty,
    ).toBe(true);
  });

  it("diffs a whole-collection curve replacement down to the one that changed", () => {
    const IDS = { C1: 1, C2: 2, C3: 3 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aCurve({ id: IDS.C1, type: "volume", points: [{ x: 1, y: 1 }] })
      .aCurve({ id: IDS.C2, type: "volume", points: [{ x: 2, y: 2 }] })
      .build();

    const next = new Map(model.curves);
    next.set(IDS.C3, {
      id: IDS.C3,
      label: "C3",
      type: "volume",
      points: [{ x: 3, y: 3 }],
    });
    next.delete(IDS.C2);

    const built = changeSet(model, "changeCurves", [replaceCurves(next)]);
    const byId = new Map(built.records.map((r) => [r.id, r]));

    expect(built.records).toHaveLength(2);
    expect(byId.get(IDS.C3)!.kind).toBe("create");
    expect(byId.get(IDS.C2)!.kind).toBe("delete");
    expect(byId.has(IDS.C1)).toBe(false);
  });

  it("records a demand assignment as a whole value against its owner", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .aJunctionDemand(IDS.J1, [{ baseDemand: 5 }])
      .build();

    const built = changeSet(model, "changeDemandAssignment", [
      setDemands([{ junctionId: IDS.J1, demands: [{ baseDemand: 9 }] }]),
    ]);
    const record = built.records[0];

    expect(record.entity).toBe("junctionDemand");
    expect(record.id).toBe(IDS.J1);
    expect(record.before[WHOLE_VALUE]).toEqual([{ baseDemand: 5 }]);
    expect(record.after[WHOLE_VALUE]).toEqual([{ baseDemand: 9 }]);
  });

  it("records the pipe library as a singleton whole value", () => {
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager }).build();

    const materials = [{ label: "PVC", entries: [{ age: 0, roughness: 140 }] }];
    const built = changeSet(model, "changePipeMaterials", [
      setPipeLibrary(materials),
    ]);
    const record = built.records[0];

    expect(record.entity).toBe("pipeLibrary");
    expect(record.before[WHOLE_VALUE]).toEqual([]);
    expect(record.after[WHOLE_VALUE]).toEqual(materials);
  });

  it("unsets a field the replacing asset no longer carries", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    model.assets.get(IDS.J1)!.setProperty("custom-1", "north");

    const replacement = model.assets.get(IDS.J1)!.copy();
    replacement.setProperty("custom-1", undefined);

    const built = changeSet(model, "replaceNode", [putAssets([replacement])]);
    const record = built.records[0];

    expect(record.before["custom-1"]).toBe("north");
    expect("custom-1" in record.after).toBe(true);
    expect(record.after["custom-1"]).toBeUndefined();
  });

  it("produces nothing when empty demands are assigned to an owner with none", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .build();

    const built = changeSet(model, "changeDemandAssignment", [
      setDemands([{ junctionId: IDS.J1, demands: [] }]),
    ]);

    expect(built.isEmpty).toBe(true);
  });

  it("reads every before against the same unmutated model", () => {
    const IDS = { J1: 1 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { elevation: 10 })
      .build();

    const built = changeSet(model, "compound", [
      setAsset(IDS.J1, { elevation: 20 }),
      setAsset(IDS.J1, { elevation: 30 }),
    ]);
    const record = built.records[0];

    expect(built.records).toHaveLength(1);
    expect(record.before).toEqual({ elevation: 10 });
    expect(record.after).toEqual({ elevation: 30 });
  });
});
