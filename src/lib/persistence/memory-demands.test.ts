import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { Persistence } from "./persistence";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stagingModelAtom } from "src/state/jotai";

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
});
