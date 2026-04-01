import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { Persistence } from "./persistence";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { presets } from "src/lib/project-settings/quantities-spec";

describe("Persistence putDemands", () => {
  it("keeps old demands when moment does not include demands", () => {
    const store = createStore();
    const labelManager = new LabelManager();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aDemandPattern(1, "PAT1", [1, 2])
      .build();
    setInitialState({ store, hydraulicModel: model });
    store.set(
      modelFactoriesAtom,
      initializeModelFactories({
        idGenerator: new ConsecutiveIdsGenerator(),
        labelManager,
        defaults: presets.LPS.defaults,
      }),
    );
    const persistence = new Persistence(store);
    const transact = persistence.useTransact();

    transact({
      note: "no demand change",
      putAssets: [],
      deleteAssets: [],
    });

    expect(labelManager.count("PAT1")).toEqual(1);
  });
});
