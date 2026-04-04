import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { Persistence } from "./persistence";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("Persistence putDemands", () => {
  it("keeps old demands when moment does not include demands", () => {
    const store = createStore();
    const factories = buildTestFactories();
    const { labelManager } = factories;
    const model = HydraulicModelBuilder.with({ labelManager })
      .aDemandPattern(1, "PAT1", [1, 2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    store.set(modelFactoriesAtom, factories);
    const persistence = new Persistence(store);
    const transact = persistence.useTransactDeprecated();

    transact({
      note: "no demand change",
      putAssets: [],
      deleteAssets: [],
    });

    expect(labelManager.count("PAT1")).toEqual(1);
  });
});
