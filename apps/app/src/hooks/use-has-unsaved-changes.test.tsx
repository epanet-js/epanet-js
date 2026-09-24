import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useProjectSettingsTransaction } from "src/hooks/persistence/use-project-settings-transaction";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import { worktreeAtom } from "src/state/scenarios";
import {
  nullBranchingRules,
  type Branch,
  type BranchingRules,
} from "@epanet-js/worktree";
import { nanoid } from "nanoid";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { registerBranchingRules } from "src/lib/branching";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { useSimulationSettingsTransaction } from "src/hooks/persistence/use-simulation-settings-transaction";
import { markProjectSavedAtom } from "src/state/project-revision";
import { useCustomerPointsImportReset } from "src/hooks/persistence/use-customer-points-import-reset";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  simulationSettingsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { Store } from "src/state";

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aSavedProject = async ({
  isProjectSaved = true,
}: { isProjectSaved?: boolean } = {}): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(1, { coordinates: [0, 0] })
    .build();
  const store = setInitialState({ hydraulicModel, isProjectSaved });
  await db.importProject({
    newDb: true,
    hydraulicModel,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const addJunction = (store: Store, coordinates: number[]) => {
  const { result } = renderHook(() => useMomentTransaction(), withStore(store));
  const factories = store.get(modelFactoriesAtom);
  const moment = addNode(store.get(stagingModelDerivedAtom), {
    nodeType: "junction",
    coordinates,
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

const renameProject = async (store: Store, name: string) => {
  const { result } = renderHook(
    () => useProjectSettingsTransaction(),
    withStore(store),
  );

  await act(async () => {
    await result.current.transact({ ...store.get(projectSettingsAtom), name });
  });
};

const createScenario = (store: Store) => {
  const { result } = renderHook(
    () => ({
      ...useInitializeBranch(),
      ...useSwitchBranch(),
    }),
    withStore(store),
  );

  const branch: Branch = {
    id: "scenario-1",
    name: "Scenario #1",
    parentId: "main",
    status: "open",
  };

  act(() => {
    result.current.initializeBranch(branch);
    result.current.switchBranch(branch.id);
  });

  const worktree = store.get(worktreeAtom);
  store.set(worktreeAtom, {
    ...worktree,
    branches: new Map(worktree.branches).set(branch.id, branch),
    scenarios: [branch.id],
    activeBranchId: branch.id,
    lastActiveBranchId: worktree.activeBranchId,
    highestScenarioNumber: 1,
  });
};

const importCustomerPoints = async (store: Store) => {
  const { result } = renderHook(
    () => useCustomerPointsImportReset(),
    withStore(store),
  );
  const hydraulicModel = addCustomerPoints(store.get(stagingModelDerivedAtom), [
    buildCustomerPoint(1, { coordinates: [10, 20] }),
  ]);

  await act(async () => {
    await result.current.customerPointsImportReset({ hydraulicModel });
  });
};

const testBranchingRules: BranchingRules = {
  isAvailable: true,
  createBranch: (worktree) => {
    const number = worktree.highestScenarioNumber + 1;
    const created: Branch = {
      id: `scenario-${number}`,
      name: `Scenario #${number}`,
      parentId: worktree.mainId,
      status: "open",
    };
    return {
      worktree: {
        ...worktree,
        branches: new Map(worktree.branches).set(created.id, created),
        scenarios: [...worktree.scenarios, created.id],
        highestScenarioNumber: number,
      },
      created,
    };
  },
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
    return {
      worktree: {
        ...worktree,
        branches,
        scenarios: worktree.scenarios.filter((id) => id !== branchId),
        activeBranchId: worktree.mainId,
      },
      nextActive: worktree.branches.get(worktree.mainId) ?? null,
    };
  },
  renameBranch: (worktree, branchId, name) => ({
    ...worktree,
    branches: new Map(worktree.branches).set(branchId, {
      ...worktree.branches.get(branchId)!,
      name,
    }),
  }),
};

const scenarioOperations = (store: Store) =>
  renderHook(() => useScenarioOperations(), withStore(store)).result;

const createNewScenario = (store: Store): string => {
  const operations = scenarioOperations(store);
  let scenarioId = "";
  act(() => {
    scenarioId = operations.current.createNewScenario()!.scenarioId;
  });
  return scenarioId;
};

const deleteScenario = (store: Store, scenarioId: string) => {
  const operations = scenarioOperations(store);
  act(() => {
    operations.current.deleteScenarioById(scenarioId);
  });
};

const renameScenario = (store: Store, scenarioId: string, name: string) => {
  const operations = scenarioOperations(store);
  act(() => {
    operations.current.renameScenarioById(scenarioId, name);
  });
};

const switchToMain = (store: Store) => {
  const operations = scenarioOperations(store);
  act(() => {
    operations.current.switchToMain();
  });
};

const changeDemandMultiplier = (store: Store, multiplier: number) => {
  const { result } = renderHook(
    () => useSimulationSettingsTransaction(),
    withStore(store),
  );

  act(() => {
    result.current.transact({
      ...store.get(simulationSettingsDerivedAtom),
      version: nanoid(),
      globalDemandMultiplier: multiplier,
    });
  });
};

const save = (store: Store) => {
  store.set(markProjectSavedAtom);
};

const hasUnsavedChanges = (store: Store): boolean => {
  const { result } = renderHook(() => useHasUnsavedChanges(), withStore(store));
  return result.current;
};

describe("unsaved changes", () => {
  useInProcessDb();

  describe.each([{ flag: "on" }, { flag: "off" }])(
    "with FLAG_PERSIST_SCENARIOS $flag",
    ({ flag }) => {
      beforeEach(() => {
        flag === "on"
          ? stubFeatureOn("FLAG_PERSIST_SCENARIOS")
          : stubFeatureOff("FLAG_PERSIST_SCENARIOS");
      });

      it("reports saved when nothing changed since the last save", async () => {
        const store = await aSavedProject();

        expect(hasUnsavedChanges(store)).toBe(false);
      });

      it("reports unsaved when the project was never saved", async () => {
        const store = await aSavedProject({ isProjectSaved: false });

        expect(hasUnsavedChanges(store)).toBe(true);
      });

      it("reports unsaved after a model edit", async () => {
        const store = await aSavedProject();

        addJunction(store, [10, 20]);

        expect(hasUnsavedChanges(store)).toBe(true);
      });

      it("goes back to saved when the edit is undone", async () => {
        const store = await aSavedProject();

        addJunction(store, [10, 20]);
        undo(store);

        expect(hasUnsavedChanges(store)).toBe(false);
      });

      it("reports unsaved after a project settings change", async () => {
        const store = await aSavedProject();

        await renameProject(store, "Another name");

        expect(hasUnsavedChanges(store)).toBe(true);
      });

      it("keeps unsaved after a settings change even when undo is triggered", async () => {
        const store = await aSavedProject();

        await renameProject(store, "Another name");
        undo(store);

        expect(hasUnsavedChanges(store)).toBe(true);
      });

      it("reports unsaved after importing customer points", async () => {
        const store = await aSavedProject();

        await importCustomerPoints(store);

        expect(hasUnsavedChanges(store)).toBe(true);
      });

      it("reports unsaved after changing main's simulation settings", async () => {
        const store = await aSavedProject();

        changeDemandMultiplier(store, 1.5);

        expect(hasUnsavedChanges(store)).toBe(true);
      });
    },
  );

  describe("with FLAG_PERSIST_SCENARIOS off", () => {
    beforeEach(() => {
      stubFeatureOff("FLAG_PERSIST_SCENARIOS");
    });

    it("ignores edits made on a scenario", async () => {
      const store = await aSavedProject();

      createScenario(store);
      addJunction(store, [10, 20]);

      expect(hasUnsavedChanges(store)).toBe(false);
    });
  });

  describe("with FLAG_PERSIST_SCENARIOS on", () => {
    beforeEach(() => {
      stubFeatureOn("FLAG_PERSIST_SCENARIOS");
      registerBranchingRules(testBranchingRules);
    });

    afterEach(() => {
      registerBranchingRules(nullBranchingRules);
    });

    it("reports unsaved after creating a scenario", async () => {
      const store = await aSavedProject();

      createNewScenario(store);

      expect(hasUnsavedChanges(store)).toBe(true);
    });

    it("goes back to saved when a new scenario is deleted", async () => {
      const store = await aSavedProject();

      const scenarioId = createNewScenario(store);
      addJunction(store, [10, 20]);
      changeDemandMultiplier(store, 1.5);
      deleteScenario(store, scenarioId);

      expect(hasUnsavedChanges(store)).toBe(false);
    });

    it("reports unsaved after an edit made on a scenario", async () => {
      const store = await aSavedProject();
      createNewScenario(store);
      save(store);

      addJunction(store, [10, 20]);

      expect(hasUnsavedChanges(store)).toBe(true);
    });

    it("goes back to saved when the scenario edit is undone", async () => {
      const store = await aSavedProject();
      createNewScenario(store);
      save(store);

      addJunction(store, [10, 20]);
      undo(store);

      expect(hasUnsavedChanges(store)).toBe(false);
    });

    it("reports unsaved after changing a scenario's simulation settings", async () => {
      const store = await aSavedProject();
      createNewScenario(store);
      save(store);

      changeDemandMultiplier(store, 1.5);

      expect(hasUnsavedChanges(store)).toBe(true);
    });

    it("keeps saved when switching between branches", async () => {
      const store = await aSavedProject();
      createNewScenario(store);
      save(store);

      switchToMain(store);

      expect(hasUnsavedChanges(store)).toBe(false);
    });

    it("goes back to saved when a scenario is renamed back", async () => {
      const store = await aSavedProject();
      const scenarioId = createNewScenario(store);
      save(store);

      renameScenario(store, scenarioId, "Another name");
      expect(hasUnsavedChanges(store)).toBe(true);

      renameScenario(store, scenarioId, "Scenario #1");
      expect(hasUnsavedChanges(store)).toBe(false);
    });

    it("reports unsaved after deleting a saved scenario", async () => {
      const store = await aSavedProject();
      const scenarioId = createNewScenario(store);
      save(store);

      deleteScenario(store, scenarioId);

      expect(hasUnsavedChanges(store)).toBe(true);
    });
  });
});
