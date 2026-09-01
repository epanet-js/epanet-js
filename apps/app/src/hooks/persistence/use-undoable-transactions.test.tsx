import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { Mock, vi } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { historyPendingAtom } from "src/state/transactions";
import * as transactionHelpers from "src/lib/persistence/transaction-helpers";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { Store } from "src/state";

vi.mock("src/lib/persistence/transaction-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("src/lib/persistence/transaction-helpers")
    >();
  return {
    ...actual,
    prepareHistoryAction: vi.fn(actual.prepareHistoryAction),
  };
});

const IDS = { J1: 1, J2: 2, J3: 3 } as const;

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

const holdPrepare = () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  (transactionHelpers.prepareHistoryAction as Mock).mockImplementation(
    async (action: transactionHelpers.HistoryAction) => {
      await gate;
      return action;
    },
  );
  return release;
};

describe("undoable transactions", () => {
  useInProcessDb();

  beforeEach(() => {
    (transactionHelpers.prepareHistoryAction as Mock).mockImplementation(
      (action: transactionHelpers.HistoryAction) => Promise.resolve(action),
    );
  });

  it("undoes an edit", async () => {
    const store = await aProject();
    addJunction(store);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    await act(async () => {
      await result.current.historyControl("undo");
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

    await act(async () => {
      await result.current.historyControl("undo");
    });
    await act(async () => {
      await result.current.historyControl("redo");
    });

    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);
  });

  it("marks history as pending while preparing", async () => {
    const store = await aProject();
    addJunction(store);
    const release = holdPrepare();

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.historyControl("undo");
    });

    expect(store.get(historyPendingAtom)).toBe(true);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);

    release();
    await act(async () => {
      await pending;
    });

    expect(store.get(historyPendingAtom)).toBe(false);
    expect(assetIds(store)).toEqual([IDS.J1]);
  });

  it("blocks edition while preparing", async () => {
    const store = await aProject();
    addJunction(store);
    const release = holdPrepare();

    const { result } = renderHook(
      () => ({
        ...useUndoableTransactions(),
        isEditionBlocked: useIsEditionBlocked(),
      }),
      withStore(store),
    );

    expect(result.current.isEditionBlocked).toBe(false);

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.historyControl("undo");
    });

    expect(result.current.isEditionBlocked).toBe(true);

    release();
    await act(async () => {
      await pending;
    });

    expect(result.current.isEditionBlocked).toBe(false);
  });

  it("rejects a second history action while one is pending", async () => {
    const store = await aProject();
    addJunction(store);
    addJunction(store);
    const release = holdPrepare();

    const { result } = renderHook(
      () => useUndoableTransactions(),
      withStore(store),
    );

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.historyControl("undo");
    });

    let rejected!: boolean;
    await act(async () => {
      rejected = await result.current.historyControl("undo");
    });

    expect(rejected).toBe(false);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2, IDS.J3]);

    release();
    await act(async () => {
      await pending;
    });

    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);
  });

  it("rejects an edit while a history action is pending", async () => {
    const store = await aProject();
    addJunction(store);
    const release = holdPrepare();

    const { result } = renderHook(
      () => ({
        ...useUndoableTransactions(),
        ...useMomentTransaction(),
      }),
      withStore(store),
    );

    const moment = buildAddJunctionMoment(store);

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.historyControl("undo");
    });

    let applied!: boolean;
    act(() => {
      applied = result.current.transact(moment);
    });

    expect(applied).toBe(false);
    expect(assetIds(store)).toEqual([IDS.J1, IDS.J2]);

    release();
    await act(async () => {
      await pending;
    });
  });
});
