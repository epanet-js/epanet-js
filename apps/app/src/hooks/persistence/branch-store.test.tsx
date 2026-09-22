import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { ChangeSet, squash, type Direction } from "@epanet-js/change-set";
import {
  initializeWorktree,
  nullBranchStore,
  type Branch,
  type BranchStore,
} from "@epanet-js/worktree";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import {
  useOpenPersistedProject,
  type OpenPersistedProjectResult,
} from "src/hooks/persistence/use-open-persisted-project";
import { registerBranchStore } from "src/lib/branching";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { branchStateAtom } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { worktreeAtom } from "src/state/scenarios";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import type { Store } from "src/state";

type Recorded = {
  branchId: string;
  changeSet: ChangeSet;
  direction: Direction;
};

const aRecordingStore = () => {
  const recorded: Recorded[] = [];
  const store: BranchStore = {
    ...nullBranchStore,
    recordChange: (branchId, changeSet, direction) => {
      recorded.push({ branchId, changeSet, direction });
      return Promise.resolve();
    },
    load: () => {
      const worktree = initializeWorktree();
      const deltas = new Map<string, ChangeSet>();
      const branches = new Map(worktree.branches);
      branches.set("main", { ...branches.get("main")!, status: "locked" });
      let number = 0;
      for (const { branchId } of recorded) {
        if (!branches.has(branchId)) number += 1;
        branches.set(branchId, aScenarioBranch(branchId, number));
        deltas.set(
          branchId,
          squash(
            "",
            recorded
              .filter((entry) => entry.branchId === branchId)
              .map((entry) => entry.changeSet),
          ),
        );
      }
      return Promise.resolve({
        worktree: {
          ...worktree,
          branches,
          scenarios: [...deltas.keys()],
          highestScenarioNumber: deltas.size,
        },
        deltas,
      });
    },
  };
  return { store, recorded };
};

const aScenarioBranch = (id: string, number: number): Branch => ({
  id,
  name: `Scenario #${number}`,
  parentId: "main",
  status: "open",
});

const scenarioBranch = aScenarioBranch("scenario-1", 1);

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aSavedProject = async (): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(1, { coordinates: [0, 0] })
    .build();
  const store = setInitialState({ hydraulicModel });
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const switchToScenario = (store: Store, branch: Branch = scenarioBranch) => {
  const { result } = renderHook(
    () => ({ ...useInitializeBranch(), ...useSwitchBranch() }),
    withStore(store),
  );

  act(() => {
    result.current.initializeBranch(branch);
    result.current.switchBranch(branch.id);
  });

  const worktree = store.get(worktreeAtom);
  const scenarios = worktree.scenarios.includes(branch.id)
    ? worktree.scenarios
    : [...worktree.scenarios, branch.id];
  store.set(worktreeAtom, {
    ...worktree,
    branches: new Map(worktree.branches).set(branch.id, branch),
    scenarios,
    activeBranchId: branch.id,
    highestScenarioNumber: scenarios.length,
  });
};

const addJunction = (store: Store) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  const factories = store.get(modelFactoriesAtom);
  const moment = addNode(store.get(stagingModelDerivedAtom), {
    nodeType: "junction",
    coordinates: [10, 10],
    elevation: 5,
    lengthUnit: "m",
    assetFactory: factories.assetFactory,
    labelManager: factories.labelManager,
  });

  act(() => {
    result.current.transact(moment);
  });
};

const undo = (store: Store) => {
  const { result } = renderHook(
    () => useUndoableTransactions(),
    withStore(store),
  );

  act(() => {
    result.current.historyControl("undo");
  });
};

const reopen = async (store: Store) => {
  const bytes = await db.exportDb();
  const { result } = renderHook(
    () => useOpenPersistedProject(),
    withStore(store),
  );

  let outcome!: OpenPersistedProjectResult;
  await act(async () => {
    outcome = await result.current.openPersistedProject({
      file: new File([bytes], "project.ejs"),
    });
  });
  return outcome;
};

const maxAssetId = (store: Store) =>
  Math.max(...store.get(stagingModelDerivedAtom).assets.keys());

const activateScenario = (store: Store, branch: Branch) => {
  const { result } = renderHook(() => useSwitchBranch(), withStore(store));

  act(() => {
    result.current.switchBranch(branch.id);
  });

  store.set(worktreeAtom, {
    ...store.get(worktreeAtom),
    activeBranchId: branch.id,
  });
};

const labelsIn = (store: Store) =>
  new Set(
    [...store.get(stagingModelDerivedAtom).assets.values()].map(
      (asset) => asset.label,
    ),
  );

const persistedAssetCount = async () =>
  (await db.fetchProject({})).hydraulicModel.assets.size;

describe("branch store", () => {
  useInProcessDb();

  beforeEach(() => {
    stubFeatureOn("FLAG_PERSIST_SCENARIOS");
  });

  afterEach(() => {
    registerBranchStore(nullBranchStore);
  });

  it("records a scenario's edits in the store and leaves main's rows alone", async () => {
    const { store: branchStore, recorded } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);

    addJunction(store);
    undo(store);
    await writeQueue.whenIdle();

    expect(
      recorded.map(({ branchId, direction }) => [branchId, direction]),
    ).toEqual([
      ["scenario-1", "forward"],
      ["scenario-1", "reverse"],
    ]);
    expect(await persistedAssetCount()).toEqual(1);
  });

  it("restores a scenario from its stored delta on open", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    const scenarioAssets = store.get(stagingModelDerivedAtom).assets.size;
    await writeQueue.whenIdle();

    await reopen(store);

    const worktree = store.get(worktreeAtom);
    expect(worktree.scenarios).toEqual(["scenario-1"]);
    expect(worktree.activeBranchId).toEqual("main");
    expect(worktree.branches.get("main")!.status).toEqual("locked");
    const branchStates = store.get(branchStateAtom);
    expect(branchStates.get("main")!.hydraulicModel.assets.size).toEqual(1);
    expect(branchStates.get("scenario-1")!.hydraulicModel.assets.size).toEqual(
      scenarioAssets,
    );
  });

  it("keeps the id pools above every id a stored delta holds", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    const scenarioMaxId = maxAssetId(store);
    await writeQueue.whenIdle();

    await reopen(store);

    expect(
      store.get(modelFactoriesAtom).idPools.newId("asset"),
    ).toBeGreaterThan(scenarioMaxId);
  });

  it("refuses to open when the stored branches cannot be read", async () => {
    const store = await aSavedProject();
    const beforeBranchStates = store.get(branchStateAtom);
    registerBranchStore({
      ...nullBranchStore,
      load: () => Promise.reject(new Error("delta unreadable")),
    });

    const result = await reopen(store);

    expect(result.status).toEqual("scenarios-failed");
    expect(store.get(branchStateAtom)).toBe(beforeBranchStates);
  });

  it("suggests a label no sibling scenario has already used", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const first = aScenarioBranch("scenario-1", 1);
    const second = aScenarioBranch("scenario-2", 2);
    const store = await aSavedProject();
    await reopen(store);

    switchToScenario(store, first);
    addJunction(store);
    switchToScenario(store, second);
    addJunction(store);
    const siblingLabels = labelsIn(store);
    await writeQueue.whenIdle();

    await reopen(store);
    activateScenario(store, first);
    const before = labelsIn(store);
    addJunction(store);
    const added = [...labelsIn(store)].filter((label) => !before.has(label));

    expect(added).toHaveLength(1);
    expect(siblingLabels).not.toContain(added[0]);
  });

  it("opens main only when nothing is registered", async () => {
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    await writeQueue.whenIdle();

    await reopen(store);

    expect(store.get(worktreeAtom).scenarios).toEqual([]);
    expect([...store.get(branchStateAtom).keys()]).toEqual(["main"]);
  });

  describe("with FLAG_PERSIST_SCENARIOS off", () => {
    beforeEach(() => {
      stubFeatureOff("FLAG_PERSIST_SCENARIOS");
    });

    it("skips persisting a scenario's edits", async () => {
      const { store: branchStore, recorded } = aRecordingStore();
      registerBranchStore(branchStore);
      const store = await aSavedProject();
      switchToScenario(store);

      addJunction(store);
      undo(store);
      await writeQueue.whenIdle();

      expect(recorded).toEqual([]);
      expect(await persistedAssetCount()).toEqual(1);
    });

    it("opens main only, whatever the store holds", async () => {
      const { store: branchStore } = aRecordingStore();
      registerBranchStore(branchStore);
      await branchStore.recordChange(
        "scenario-1",
        ChangeSet.empty(),
        "forward",
      );
      const store = await aSavedProject();

      await reopen(store);

      expect(store.get(worktreeAtom).scenarios).toEqual([]);
      expect([...store.get(branchStateAtom).keys()]).toEqual(["main"]);
    });
  });
});
