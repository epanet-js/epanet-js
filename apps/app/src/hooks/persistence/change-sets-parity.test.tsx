import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";
import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { snapshot } from "src/__helpers__/model-snapshot";
import { setInitialState } from "src/__helpers__/state";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { changeProperty } from "src/hydraulic-model/model-operations/change-property";
import { deleteAssets } from "src/hydraulic-model/model-operations/delete-assets";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";

const IDS = { J1: 1, J2: 2, P1: 3, J4: 4 } as const;

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aProject = (): Store => {
  const idGenerator = new ConsecutiveIdsGenerator(IDS.P1);
  const labelManager = new LabelManager();
  const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [10, 0], elevation: 20 })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
    .build();

  const store = setInitialState({ hydraulicModel });
  store.set(
    modelFactoriesAtom,
    initializeModelFactories({ idGenerator, labelManager }),
  );
  return store;
};

const observe = (store: Store) => {
  const model = store.get(stagingModelDerivedAtom);
  const { labelManager } = store.get(modelFactoriesAtom);
  return {
    model: snapshot({ model, labelManager }),
    assetOrder: [...model.assets.keys()],
  };
};

const runSequence = (changeSetsOn: boolean) => {
  changeSetsOn
    ? stubFeatureOn("FLAG_CHANGE_SETS")
    : stubFeatureOff("FLAG_CHANGE_SETS");

  const store = aProject();
  const { result } = renderHook(
    () => ({ ...useMomentTransaction(), ...useUndoableTransactions() }),
    withStore(store),
  );

  const checkpoints: ReturnType<typeof observe>[] = [];
  const edit = (build: () => Parameters<typeof result.current.transact>[0]) => {
    const moment = build();
    act(() => {
      result.current.transact(moment);
    });
    checkpoints.push(observe(store));
  };
  const history = async (direction: "undo" | "redo") => {
    await act(async () => {
      await result.current.historyControl(direction);
    });
    checkpoints.push(observe(store));
  };

  return (async () => {
    checkpoints.push(observe(store));

    edit(() => {
      const factories = store.get(modelFactoriesAtom);
      return addNode(store.get(stagingModelDerivedAtom), {
        nodeType: "junction",
        coordinates: [20, 20],
        elevation: 5,
        lengthUnit: "m",
        assetFactory: factories.assetFactory,
        labelManager: factories.labelManager,
      });
    });

    edit(() =>
      changeProperty(store.get(stagingModelDerivedAtom), {
        assetIds: [IDS.J1],
        property: "elevation",
        value: 99,
      }),
    );

    edit(() =>
      deleteAssets(store.get(stagingModelDerivedAtom), {
        assetIds: [IDS.P1],
      }),
    );

    await history("undo");
    await history("undo");
    await history("undo");
    await history("redo");
    await history("redo");

    return checkpoints;
  })();
};

const AFTER_EDITS = 4;
const AFTER_PROPERTY_CHANGE = 2;
const AFTER_RESTORING_THE_PIPE = 4;

describe("change sets parity with the moment path", () => {
  it("reaches the same model through edits, undo and redo", async () => {
    const viaMoments = await runSequence(false);
    const viaChangeSets = await runSequence(true);

    expect(viaChangeSets.map((c) => c.model)).toEqual(
      viaMoments.map((c) => c.model),
    );
  });

  it("orders assets the same way while editing forwards", async () => {
    const viaMoments = await runSequence(false);
    const viaChangeSets = await runSequence(true);

    expect(
      viaChangeSets.slice(0, AFTER_EDITS).map((c) => c.assetOrder),
    ).toEqual(viaMoments.slice(0, AFTER_EDITS).map((c) => c.assetOrder));
  });

  it("restores a deleted asset to the position it had", async () => {
    const viaChangeSets = await runSequence(true);

    expect(viaChangeSets[AFTER_RESTORING_THE_PIPE].assetOrder).toEqual(
      viaChangeSets[AFTER_PROPERTY_CHANGE].assetOrder,
    );
  });

  it("is the moment path that moves a restored asset to the front", async () => {
    const viaMoments = await runSequence(false);

    expect(viaMoments[AFTER_RESTORING_THE_PIPE].assetOrder).not.toEqual(
      viaMoments[AFTER_PROPERTY_CHANGE].assetOrder,
    );
    expect(viaMoments[AFTER_RESTORING_THE_PIPE].assetOrder[0]).toBe(IDS.P1);
  });
});
