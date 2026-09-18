import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { deleteAssets } from "src/hydraulic-model/model-operations/delete-assets";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { historyPendingAtom } from "src/state/transactions";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { Store } from "src/state";

const IDS = { J1: 1, J2: 2 } as const;

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aProject = async (): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0] })
    .build();
  const store = setInitialState({ hydraulicModel });
  store.set(
    modelFactoriesAtom,
    initializeModelFactories({
      idGenerator: new ConsecutiveIdsGenerator(IDS.J1),
      labelManager: new LabelManager(),
    }),
  );
  await db.importProject({
    idPools: null,
    newDb: true,
    hydraulicModel,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const buildAddJunctionMoment = (store: Store) => {
  const factories = store.get(modelFactoriesAtom);
  return addNode(store.get(stagingModelDerivedAtom), {
    nodeType: "junction",
    coordinates: [10, 10],
    elevation: 5,
    lengthUnit: "m",
    assetFactory: factories.assetFactory,
    labelManager: factories.labelManager,
  });
};

const addJunction = (store: Store) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  act(() => {
    void result.current.transact(buildAddJunctionMoment(store));
  });
};

const assetIds = (store: Store) =>
  [...store.get(stagingModelDerivedAtom).assets.keys()].sort((a, b) => a - b);

const assetOrder = (store: Store) => [
  ...store.get(stagingModelDerivedAtom).assets.keys(),
];

describe("undoable transactions", () => {
  useInProcessDb();

  it("undoes an edit", async () => {
    const store = await aProject();
    addJunction(store);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    act(() => {
      result.current.historyControl("undo");
    });

    expect(assetIds(store)).toEqual([IDS.J1]);
    expect(store.get(historyPendingAtom)).toBe(false);
  });

  it("redoes an undone edit", async () => {
    const store = await aProject();
    addJunction(store);

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    act(() => {
      result.current.historyControl("undo");
    });
    act(() => {
      result.current.historyControl("redo");
    });

    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);
  });

  it("restores a deleted asset to the position it had", async () => {
    const store = await aProject();
    addJunction(store);
    const orderBeforeDelete = assetOrder(store);

    const { result } = renderHook(
      () => ({ ...useMomentTransaction(), ...useUndoableTransactions() }),
      withStore(store),
    );

    act(() => {
      result.current.transact(
        deleteAssets(store.get(stagingModelDerivedAtom), {
          assetIds: [IDS.J2],
        }),
      );
    });
    expect(assetIds(store)).toEqual([IDS.J1]);

    act(() => {
      result.current.historyControl("undo");
    });

    expect(assetOrder(store)).toEqual(orderBeforeDelete);
  });

  it("rejects a history action while one is pending", async () => {
    const store = await aProject();
    addJunction(store);
    store.set(historyPendingAtom, true);

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    let applied!: boolean;
    act(() => {
      applied = result.current.historyControl("undo");
    });

    expect(applied).toBe(false);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);
  });

  it("rejects an edit while a history action is pending", async () => {
    const store = await aProject();
    store.set(historyPendingAtom, true);

    const { result } = renderHook(
      () => useMomentTransaction(),
      withStore(store),
    );

    let applied!: boolean;
    act(() => {
      applied = result.current.transact(buildAddJunctionMoment(store));
    });

    expect(applied).toBe(false);
    expect(assetIds(store)).toEqual([IDS.J1]);
  });
});
