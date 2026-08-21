import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeaturesOn } from "src/__helpers__/feature-flags";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  LabelManager,
  initializeModelFactories,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { getWorker } from "@epanet-js/ejsdb";
import { writeQueue } from "src/lib/persistence/write-queue";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { Store } from "src/state";

const IDS = { J1: 1, J2: 2, J3: 3 } as const;

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const configureSessionHistory = (sessionHistory: boolean) =>
  getWorker().configure({
    mode: "memory",
    sahpoolId: "test",
    sessionHistory,
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

const addJunction = (store: Store) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  act(() => {
    const factories = store.get(modelFactoriesAtom);
    void result.current.transact(
      addNode(store.get(stagingModelDerivedAtom), {
        nodeType: "junction",
        coordinates: [10, 10],
        elevation: 5,
        lengthUnit: "m",
        assetFactory: factories.assetFactory,
        labelManager: factories.labelManager,
      }),
    );
  });
};

const historyControl = async (store: Store, direction: "undo" | "redo") => {
  const { result } = renderHook(
    () => useUndoableTransactions(),
    withStore(store),
  );
  await act(async () => {
    await result.current.historyControl(direction);
  });
};

const readHistory = async () => {
  await writeQueue.whenIdle();
  return db.fetchSessionHistory();
};

describe("session history when enabled at storage configuration", () => {
  useInProcessDb();

  beforeEach(async () => {
    stubFeaturesOn(["FLAG_ASYNC_UNDO"]);
    await configureSessionHistory(true);
  });

  it("initializes the session db with the project db, before any edit", async () => {
    await aProject();

    const history = await readHistory();
    expect(history.attached).toBe(true);
    expect(history.entryCount).toBe(0);
    expect(history.pointer).toBe(-1);
    expect(await getWorker().sessionHistoryFailure()).toBeNull();
  });

  it("records one entry per edit", async () => {
    const store = await aProject();

    addJunction(store);
    addJunction(store);

    const history = await readHistory();
    expect(history.attached).toBe(true);
    expect(history.entryCount).toBe(2);
    expect(history.pointer).toBe(1);
    expect(history.entries.map((entry) => entry.seq)).toEqual([1, 0]);
    expect(history.entries.every((entry) => entry.byteSize > 0)).toBe(true);
    expect(history.entries.every((entry) => entry.hasChangeset)).toBe(true);
  });

  it("keeps the state id and note of the moment that produced it", async () => {
    const store = await aProject();

    addJunction(store);

    const history = await readHistory();
    const [entry] = history.entries;
    expect(entry.stateId).toEqual(store.get(stagingModelDerivedAtom).version);
    expect(entry.note).not.toEqual("");
  });

  it("moves the pointer on undo and redo without recording", async () => {
    const store = await aProject();
    addJunction(store);
    addJunction(store);

    await historyControl(store, "undo");

    let history = await readHistory();
    expect(history.entryCount).toBe(2);
    expect(history.pointer).toBe(0);

    await historyControl(store, "redo");

    history = await readHistory();
    expect(history.entryCount).toBe(2);
    expect(history.pointer).toBe(1);
  });

  it("truncates the future when an edit follows an undo", async () => {
    const store = await aProject();
    addJunction(store);
    addJunction(store);
    await historyControl(store, "undo");

    addJunction(store);

    const history = await readHistory();
    expect(history.entryCount).toBe(2);
    expect(history.pointer).toBe(1);
    expect(history.entries[0].stateId).toEqual(
      store.get(stagingModelDerivedAtom).version,
    );
  });

  it("records a moment that persists nothing, so seq keeps tracking the log", async () => {
    await aProject();

    await db.applyMomentToDb(db.buildMomentPayload({ note: "no-op" }), {
      kind: "edit",
      seq: 0,
      stateId: "state-no-op",
      note: "no-op",
    });

    const history = await readHistory();
    expect(history.entryCount).toBe(1);
    expect(history.pointer).toBe(0);
    expect(history.entries[0].stateId).toEqual("state-no-op");
  });

  it("clears when another network is loaded", async () => {
    const store = await aProject();
    addJunction(store);
    expect((await readHistory()).entryCount).toBe(1);

    await db.importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J3, { coordinates: [0, 0] })
        .build(),
      simulationSettings: defaultSimulationSettings,
    });

    expect((await readHistory()).entryCount).toBe(0);
  });

  it("clears when a whole project is re-imported into the open database", async () => {
    const store = await aProject();
    addJunction(store);
    expect((await readHistory()).entryCount).toBe(1);

    await db.importProject({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J3, { coordinates: [0, 0] })
        .build(),
      simulationSettings: defaultSimulationSettings,
    });

    expect((await readHistory()).entryCount).toBe(0);
  });
});

describe("session history when disabled at storage configuration", () => {
  useInProcessDb();

  beforeEach(async () => {
    stubFeaturesOn(["FLAG_ASYNC_UNDO"]);
    await configureSessionHistory(false);
  });

  it("records nothing and never attaches", async () => {
    const store = await aProject();

    addJunction(store);

    const history = await readHistory();
    expect(history.attached).toBe(false);
    expect(history.entryCount).toBe(0);
  });

  it("reports nothing when a recovery has no history to carry over", async () => {
    await aProject();

    const restored = await db.restoreSessionHistory("some-dead-pool");

    expect(restored).toBe(false);
    expect(await getWorker().sessionHistoryFailure()).toBeNull();
  });
});
