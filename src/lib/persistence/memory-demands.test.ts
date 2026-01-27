import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { MemPersistenceDeprecated } from "./memory-deprecated";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { Demands, createEmptyDemands } from "src/hydraulic-model/demands";
import { dataAtom } from "src/state/jotai";

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

describe("MemPersistenceDeprecated putDemands", () => {
  it("keeps old demands when moment does not include demands", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "PAT1", [1, 2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new MemPersistenceDeprecated(store);
    const transact = persistence.useTransact();

    transact({
      note: "no demand change",
      putAssets: [],
      deleteAssets: [],
    });

    const ctx = store.get(dataAtom);
    expect(ctx.hydraulicModel.labelManager.count("PAT1")).toEqual(1);
  });

  it("registers new pattern labels in label manager", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with().build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new MemPersistenceDeprecated(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([
      { id: 1, label: "MyPattern", multipliers: [1, 2, 3] },
    ]);

    transact({
      note: "add demands",
      putDemands: newDemands,
    });

    const ctx = store.get(dataAtom);
    expect(ctx.hydraulicModel.labelManager.count("MyPattern")).toEqual(1);
  });

  it("handles renaming a pattern (old removed, new registered)", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "OriginalName", [1])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new MemPersistenceDeprecated(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([{ id: 1, label: "RenamedPattern" }]);

    transact({
      note: "rename pattern",
      putDemands: newDemands,
    });

    const ctx = store.get(dataAtom);
    expect(ctx.hydraulicModel.labelManager.count("OriginalName")).toEqual(0);
    expect(ctx.hydraulicModel.labelManager.count("RenamedPattern")).toEqual(1);
  });

  it("handles removing a pattern from demands", () => {
    const store = createStore();
    const model = HydraulicModelBuilder.with()
      .aDemandPattern(1, "KeepThis", [1])
      .aDemandPattern(2, "RemoveThis", [2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    const persistence = new MemPersistenceDeprecated(store);
    const transact = persistence.useTransact();

    const newDemands = makeDemands([{ id: 1, label: "KeepThis" }]);

    transact({
      note: "remove pattern",
      putDemands: newDemands,
    });

    const ctx = store.get(dataAtom);
    expect(ctx.hydraulicModel.labelManager.count("KeepThis")).toEqual(1);
    expect(ctx.hydraulicModel.labelManager.count("RemoveThis")).toEqual(0);
  });
});
