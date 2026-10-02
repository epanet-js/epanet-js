import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { ChangeSet, squashOnto, type Direction } from "@epanet-js/change-set";
import {
  initializeWorktree,
  nullBranchingRules,
  nullBranchStore,
  type Branch,
  type BranchingRules,
  type BranchStore,
  type Worktree,
} from "@epanet-js/worktree";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { addNodeDeprecated } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useSimulationSettingsTransaction } from "src/hooks/persistence/use-simulation-settings-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import {
  useOpenPersistedProject,
  type OpenPersistedProjectPhase,
  type OpenPersistedProjectResult,
} from "src/hooks/persistence/use-open-persisted-project";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import {
  getBranchStore,
  registerBranchingRules,
  registerBranchStore,
} from "src/lib/branching";
import { dialogAtom } from "src/state/dialog";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { branchStateAtom, isBranchLoaded } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import type { SimulationState } from "src/state/simulation";
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
  const recordedSettings = new Map<string, string>();
  const deltaOf = (branchId: string) =>
    recorded
      .filter((entry) => entry.branchId === branchId)
      .reduce(
        (delta, entry) => squashOnto(delta, entry.changeSet, entry.direction),
        ChangeSet.empty(),
      );
  const recordChange: BranchStore["recordChange"] = (
    branchId,
    changeSet,
    direction,
  ) => {
    recorded.push({ branchId, changeSet, direction });
    return Promise.resolve();
  };
  const loadWorktree = (): Worktree => {
    const worktree = initializeWorktree();
    const branches = new Map(worktree.branches);
    branches.set("main", { ...branches.get("main")!, status: "locked" });
    const branchIds = [
      ...new Set([
        ...recorded.map((entry) => entry.branchId),
        ...recordedSettings.keys(),
      ]),
    ];
    branchIds.forEach((branchId, index) => {
      branches.set(branchId, aScenarioBranch(branchId, index + 1));
    });
    return {
      ...worktree,
      branches,
      scenarios: branchIds,
      highestScenarioNumber: branchIds.length,
    };
  };
  const store: BranchStore = {
    ...nullBranchStore,
    loadBranch: (branchId) =>
      Promise.resolve({
        delta: deltaOf(branchId),
        simulationSettings: recordedSettings.get(branchId) ?? null,
      }),
    recordChange,
    duplicateBranch: (sourceId, branch) => {
      recorded.push({
        branchId: branch.id,
        changeSet: deltaOf(sourceId),
        direction: "forward",
      });
      return Promise.resolve();
    },
    recordSimulationSettings: (branchId, data) => {
      recordedSettings.set(branchId, data);
      return Promise.resolve();
    },
    load: () => Promise.resolve({ worktree: loadWorktree() }),
  };
  return { store, recorded, recordedSettings };
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
  const moment = addNodeDeprecated(store.get(stagingModelDerivedAtom), {
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

const reopen = async (
  store: Store,
  onProgress?: (phase: OpenPersistedProjectPhase) => void,
) => {
  const bytes = await db.exportDb();
  const { result } = renderHook(
    () => useOpenPersistedProject(),
    withStore(store),
  );

  let outcome!: OpenPersistedProjectResult;
  await act(async () => {
    outcome = await result.current.openPersistedProject({
      file: new File([bytes], "project.ejs"),
      onProgress,
    });
  });
  return outcome;
};

const maxAssetId = (store: Store) =>
  Math.max(...store.get(stagingModelDerivedAtom).assets.keys());

const labelsIn = (store: Store) =>
  new Set(
    [...store.get(stagingModelDerivedAtom).assets.values()].map(
      (asset) => asset.label,
    ),
  );

const persistedAssetCount = async () =>
  (await db.fetchProject({})).hydraulicModel.assets.size;

const setDemandMultiplier = (store: Store, multiplier: number) => {
  const { result } = renderHook(
    () => useSimulationSettingsTransaction(),
    withStore(store),
  );

  act(() => {
    result.current.transact({
      ...store.get(simulationSettingsDerivedAtom),
      globalDemandMultiplier: multiplier,
    });
  });
};

const modelOf = (store: Store, branchId: string) => {
  const state = store.get(branchStateAtom).get(branchId)!;
  if (!isBranchLoaded(state)) throw new Error(`${branchId} is not loaded`);
  return state.hydraulicModel;
};

const isLoaded = (store: Store, branchId: string) =>
  isBranchLoaded(store.get(branchStateAtom).get(branchId)!);

const testBranchingRules: BranchingRules = {
  ...nullBranchingRules,
  isAvailable: true,
  switchToBranch: (worktree, branchId) => ({
    worktree: {
      ...worktree,
      activeBranchId: branchId,
      lastActiveBranchId: worktree.activeBranchId,
    },
    activated: worktree.branches.get(branchId) ?? null,
  }),
  deleteBranch: (worktree, branchId) => {
    const branches = new Map(worktree.branches);
    branches.delete(branchId);
    const scenarios = worktree.scenarios.filter((id) => id !== branchId);
    const nextActiveId = scenarios[0] ?? worktree.mainId;
    return {
      worktree: {
        ...worktree,
        branches,
        scenarios,
        activeBranchId: nextActiveId,
      },
      nextActive: branches.get(nextActiveId) ?? null,
    };
  },
  duplicateBranch: (worktree, branchId) => {
    const created = aScenarioBranch(
      `${branchId}-copy`,
      worktree.highestScenarioNumber + 1,
    );
    return {
      worktree: {
        ...worktree,
        branches: new Map(worktree.branches).set(created.id, created),
        scenarios: [...worktree.scenarios, created.id],
        highestScenarioNumber: worktree.highestScenarioNumber + 1,
      },
      created,
    };
  },
};

const switchTo = async (store: Store, branchId: string) => {
  const { result } = renderHook(
    () => useScenarioOperations(),
    withStore(store),
  );

  act(() => {
    result.current.switchToBranch(branchId);
  });
  await waitFor(() =>
    expect(store.get(worktreeAtom).activeBranchId).toEqual(branchId),
  );
};

const aProjectWithTwoScenarios = async () => {
  const { store: branchStore } = aRecordingStore();
  registerBranchStore(branchStore);
  const first = aScenarioBranch("scenario-1", 1);
  const second = aScenarioBranch("scenario-2", 2);
  const store = await aSavedProject();
  await reopen(store);
  switchToScenario(store, first);
  addJunction(store);
  addJunction(store);
  switchToScenario(store, second);
  addJunction(store);
  await writeQueue.whenIdle();
  await reopen(store);
  return store;
};

const persistedDemandMultiplier = async () =>
  (await db.fetchProject({})).simulationSettings.globalDemandMultiplier;

describe("branch store", () => {
  useInProcessDb();

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

  it("keeps a scenario's simulation settings out of main's rows", async () => {
    const store = await aSavedProject();
    switchToScenario(store);

    setDemandMultiplier(store, 1.5);
    await writeQueue.whenIdle();

    expect(
      store.get(simulationSettingsDerivedAtom).globalDemandMultiplier,
    ).toEqual(1.5);
    expect(
      store.get(branchStateAtom).get("main")!.simulationSettings
        .globalDemandMultiplier,
    ).toEqual(1);
    expect(await persistedDemandMultiplier()).toEqual(1);
  });

  it("persists simulation settings changed on main", async () => {
    const store = await aSavedProject();

    setDemandMultiplier(store, 1.5);
    await writeQueue.whenIdle();

    expect(await persistedDemandMultiplier()).toEqual(1.5);
  });

  it("restores a scenario's simulation settings on open", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);

    setDemandMultiplier(store, 1.5);
    await writeQueue.whenIdle();

    await reopen(store);

    const branchStates = store.get(branchStateAtom);
    expect(
      branchStates.get("scenario-1")!.simulationSettings.globalDemandMultiplier,
    ).toEqual(1.5);
    expect(
      branchStates.get("main")!.simulationSettings.globalDemandMultiplier,
    ).toEqual(1);
  });

  it("reopens with no unsaved changes when scenarios are restored", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    await writeQueue.whenIdle();

    await reopen(store);

    const { result } = renderHook(
      () => useHasUnsavedChanges(),
      withStore(store),
    );
    expect(store.get(worktreeAtom).scenarios).toEqual(["scenario-1"]);
    expect(result.current).toBe(false);
  });

  it("leaves a scenario on main's simulation settings when it changed none", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    setDemandMultiplier(store, 2);
    switchToScenario(store);
    addJunction(store);
    await writeQueue.whenIdle();

    await reopen(store);

    expect(
      store.get(branchStateAtom).get("scenario-1")!.simulationSettings
        .globalDemandMultiplier,
    ).toEqual(2);
  });

  it("restores the stored scenarios on open", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    await writeQueue.whenIdle();

    await reopen(store);

    const worktree = store.get(worktreeAtom);
    expect(worktree.scenarios).toEqual(["scenario-1"]);
    expect(worktree.activeBranchId).toEqual("main");
    expect(worktree.branches.get("main")!.status).toEqual("locked");
    expect(modelOf(store, "main").assets.size).toEqual(1);
  });

  it("reports reading the scenarios as its own phase on open", async () => {
    const { store: branchStore } = aRecordingStore();
    registerBranchStore(branchStore);
    const store = await aSavedProject();
    switchToScenario(store);
    addJunction(store);
    await writeQueue.whenIdle();
    const phases: OpenPersistedProjectPhase[] = [];

    await reopen(store, (phase) => phases.push(phase));

    expect(phases.slice(-3)).toEqual([
      "building",
      "reading-scenarios",
      "finalizing",
    ]);
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

  describe("switching scenarios", () => {
    beforeEach(() => {
      registerBranchingRules(testBranchingRules);
    });

    afterEach(() => {
      registerBranchingRules(nullBranchingRules);
    });

    it("opens with only main's model in memory", async () => {
      const store = await aProjectWithTwoScenarios();

      expect(isLoaded(store, "main")).toBe(true);
      expect(isLoaded(store, "scenario-1")).toBe(false);
      expect(isLoaded(store, "scenario-2")).toBe(false);
      expect(
        store.get(modelFactoriesAtom).idPools.newId("asset"),
      ).toBeGreaterThan(4);
    });

    it("builds a scenario's model from its stored delta when switched to", async () => {
      const store = await aProjectWithTwoScenarios();

      await switchTo(store, "scenario-1");

      expect(isLoaded(store, "scenario-1")).toBe(true);
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(3);
      expect(modelOf(store, "main").assets.size).toEqual(1);
    });

    it("suggests a label no unloaded sibling scenario has already used", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-2");
      const siblingLabels = labelsIn(store);

      await switchTo(store, "scenario-1");
      const before = labelsIn(store);
      addJunction(store);
      const added = [...labelsIn(store)].filter((label) => !before.has(label));

      expect(added).toHaveLength(1);
      expect(siblingLabels).not.toContain(added[0]);
    });

    it("frees the scenario it leaves and keeps what is costly to rebuild", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");
      addJunction(store);
      setDemandMultiplier(store, 1.5);
      const simulation: SimulationState = {
        status: "success",
        report: "",
        modelVersion: store.get(stagingModelDerivedAtom).version,
        settingsVersion: store.get(simulationSettingsDerivedAtom).version,
      };
      store.set(simulationDerivedAtom, simulation);
      const version = store.get(stagingModelDerivedAtom).version;

      await switchTo(store, "scenario-2");

      const left = store.get(branchStateAtom).get("scenario-1")!;
      expect(isBranchLoaded(left)).toBe(false);
      expect(left.version).toEqual(version);
      expect(left.simulation).toBe(simulation);
      expect(left.simulationSettings.globalDemandMultiplier).toEqual(1.5);

      await switchTo(store, "scenario-1");

      expect(store.get(stagingModelDerivedAtom).version).toEqual(version);
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(4);
      expect(store.get(simulationDerivedAtom)).toBe(simulation);
      expect(isLoaded(store, "scenario-2")).toBe(false);

      undo(store);

      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(3);
    });

    it("keeps main loaded when leaving it", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");

      expect(isLoaded(store, "main")).toBe(true);
    });

    it("keeps the scenario it leaves for main loaded", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");
      await switchTo(store, "main");

      expect(isLoaded(store, "scenario-1")).toBe(true);
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(1);
    });

    it("frees the scenario kept over main when another one loads", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");
      await switchTo(store, "main");

      await switchTo(store, "scenario-2");

      expect(isLoaded(store, "scenario-1")).toBe(false);
      expect(isLoaded(store, "scenario-2")).toBe(true);
    });

    it("reports no unsaved changes after switching back and forth", async () => {
      const store = await aProjectWithTwoScenarios();

      await switchTo(store, "scenario-1");
      await switchTo(store, "scenario-2");
      await switchTo(store, "scenario-1");

      const { result } = renderHook(
        () => useHasUnsavedChanges(),
        withStore(store),
      );
      expect(result.current).toBe(false);
    });

    it("blocks the app with a loading dialog while a scenario loads", async () => {
      const store = await aProjectWithTwoScenarios();
      const branchStore = getBranchStore();
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      registerBranchStore({
        ...branchStore,
        loadBranch: async (branchId) => {
          await released;
          return branchStore.loadBranch(branchId);
        },
      });
      const { result } = renderHook(
        () => useScenarioOperations(),
        withStore(store),
      );

      act(() => {
        result.current.switchToBranch("scenario-1");
      });

      expect(store.get(dialogAtom)).toEqual({
        type: "loadingScenario",
        scenarioName: "Scenario #1",
      });

      release();
      await waitFor(() =>
        expect(store.get(worktreeAtom).activeBranchId).toEqual("scenario-1"),
      );
      expect(store.get(dialogAtom)).toBeNull();

      await switchTo(store, "main");

      expect(store.get(dialogAtom)).toBeNull();

      act(() => {
        result.current.switchToBranch("scenario-1");
      });

      expect(store.get(dialogAtom)).toBeNull();
    });

    it("activates a copy carrying the source's edits", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");
      addJunction(store);
      const { result } = renderHook(
        () => useScenarioOperations(),
        withStore(store),
      );

      act(() => {
        result.current.duplicateScenarioById("scenario-1");
      });
      await waitFor(() =>
        expect(store.get(worktreeAtom).activeBranchId).toEqual(
          "scenario-1-copy",
        ),
      );

      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(4);
      undo(store);
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(4);
    });

    it("loads the next scenario when the active one is deleted", async () => {
      const store = await aProjectWithTwoScenarios();
      await switchTo(store, "scenario-1");
      const { result } = renderHook(
        () => useScenarioOperations(),
        withStore(store),
      );

      act(() => {
        result.current.deleteScenarioById("scenario-1");
      });
      await waitFor(() =>
        expect(store.get(worktreeAtom).activeBranchId).toEqual("scenario-2"),
      );

      expect(store.get(branchStateAtom).has("scenario-1")).toBe(false);
      expect(store.get(stagingModelDerivedAtom).assets.size).toEqual(2);
    });
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
});
