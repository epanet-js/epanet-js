import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { Persistence } from "./persistence";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { Demands, createEmptyDemands } from "src/hydraulic-model/demands";
import { stagingModelAtom } from "src/state/jotai";

const makeDemands = (
  patterns: { id: number; label: string; multipliers?: number[] }[],
): Demands => {
  const demands = createEmptyDemands();
  for (const p of patterns) {
    demands.patterns.set(p.id, {
      id: p.id,
      label: p.label,
      multipliers: p.multipliers ?? [1],
    });
  }
  return demands;
};

describe("Persistence putDemands", () => {
  it("keeps old demands when moment does not include demands", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "PAT1", [1, 2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();

    transact({
      note: "no demand change",
      putAssets: [],
      deleteAssets: [],
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.labelManager.count("PAT1")).toEqual(1);
  });

  it("registers new pattern labels in label manager", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with().build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([
      { id: 1, label: "MyPattern", multipliers: [1, 2, 3] },
    ]);

    transact({
      note: "add demands",
      putDemands: newDemands,
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.labelManager.count("MyPattern")).toEqual(1);
  });

  it("handles renaming a pattern (old removed, new registered)", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "OriginalName", [1])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([{ id: 1, label: "RenamedPattern" }]);

    transact({
      note: "rename pattern",
      putDemands: newDemands,
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.labelManager.count("OriginalName")).toEqual(0);
    expect(hydraulicModel.labelManager.count("RenamedPattern")).toEqual(1);
  });

  it("handles removing a pattern from demands", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "KeepThis", [1])
      .aDemandPattern(2, "RemoveThis", [2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([{ id: 1, label: "KeepThis" }]);

    transact({
      note: "remove pattern",
      putDemands: newDemands,
    });

    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.labelManager.count("KeepThis")).toEqual(1);
    expect(hydraulicModel.labelManager.count("RemoveThis")).toEqual(0);
  });
});

describe("Persistence putDemands undo/redo", () => {
  it("undo restores previous pattern multipliers", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "PAT1", [1, 2, 3])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();
    const historyControl = persistence.useHistoryControl();

    const newDemands = makeDemands([
      { id: 1, label: "PAT1", multipliers: [9, 9, 9] },
    ]);
    transact({ note: "change multipliers", putDemands: newDemands });

    // Verify change was applied
    let hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.get(1)?.multipliers).toEqual([
      9, 9, 9,
    ]);

    // Undo
    historyControl("undo");

    // Verify original multipliers are restored
    hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.get(1)?.multipliers).toEqual([
      1, 2, 3,
    ]);
  });

  it("redo reapplies pattern changes", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "PAT1", [1, 2, 3])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();
    const historyControl = persistence.useHistoryControl();

    const newDemands = makeDemands([
      { id: 1, label: "PAT1", multipliers: [9, 9, 9] },
    ]);
    transact({ note: "change multipliers", putDemands: newDemands });

    // Undo then redo
    historyControl("undo");
    historyControl("redo");

    // Verify changes are reapplied
    const hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.get(1)?.multipliers).toEqual([
      9, 9, 9,
    ]);
  });

  it("undo restores deleted patterns", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "PAT1", [1])
      .aDemandPattern(2, "PAT2", [2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();
    const historyControl = persistence.useHistoryControl();

    // Remove PAT2
    const newDemands = makeDemands([{ id: 1, label: "PAT1" }]);
    transact({ note: "remove pattern", putDemands: newDemands });

    // Verify PAT2 is removed
    let hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.has(2)).toBe(false);
    expect(hydraulicModel.labelManager.count("PAT2")).toEqual(0);

    // Undo
    historyControl("undo");

    // Verify PAT2 is restored
    hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.has(2)).toBe(true);
    expect(hydraulicModel.demands.patterns.get(2)?.label).toBe("PAT2");
    expect(hydraulicModel.labelManager.count("PAT2")).toEqual(1);
  });

  it("undo restores renamed pattern to original name", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "OriginalName", [1])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();
    const historyControl = persistence.useHistoryControl();

    // Rename pattern
    const newDemands = makeDemands([{ id: 1, label: "NewName" }]);
    transact({ note: "rename pattern", putDemands: newDemands });

    // Verify rename
    let hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.get(1)?.label).toBe("NewName");
    expect(hydraulicModel.labelManager.count("NewName")).toEqual(1);
    expect(hydraulicModel.labelManager.count("OriginalName")).toEqual(0);

    // Undo
    historyControl("undo");

    // Verify original name is restored
    hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.get(1)?.label).toBe("OriginalName");
    expect(hydraulicModel.labelManager.count("OriginalName")).toEqual(1);
    expect(hydraulicModel.labelManager.count("NewName")).toEqual(0);
  });

  it("undo removes newly added patterns", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with().build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();
    const historyControl = persistence.useHistoryControl();

    // Add a new pattern
    const newDemands = makeDemands([
      { id: 1, label: "NewPattern", multipliers: [1, 2] },
    ]);
    transact({ note: "add pattern", putDemands: newDemands });

    // Verify pattern was added
    let hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.has(1)).toBe(true);
    expect(hydraulicModel.labelManager.count("NewPattern")).toEqual(1);

    // Undo
    historyControl("undo");

    // Verify pattern is removed
    hydraulicModel = store.get(stagingModelAtom);
    expect(hydraulicModel.demands.patterns.has(1)).toBe(false);
    expect(hydraulicModel.labelManager.count("NewPattern")).toEqual(0);
  });
});
