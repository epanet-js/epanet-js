import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { addNode } from "src/hydraulic-model/model-operations/add-node";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useProjectSettingsTransaction } from "src/hooks/persistence/use-project-settings-transaction";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { useCustomerPointsImportReset } from "src/hooks/persistence/use-customer-points-import-reset";
import { addCustomerPoints } from "src/hydraulic-model/mutations/add-customer-points";
import { buildCustomerPoint } from "src/__helpers__/hydraulic-model-builder";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";
import { modelFactoriesAtom } from "src/state/model-factories";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
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
    void result.current.historyControl("undo");
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
    () => useScenarioOperations(),
    withStore(store),
  );

  act(() => {
    result.current.createNewScenario();
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

const hasUnsavedChanges = (store: Store): boolean => {
  const { result } = renderHook(() => useHasUnsavedChanges(), withStore(store));
  return result.current;
};

describe("unsaved changes with FLAG_DECOUPLE_UNSAVED enabled", () => {
  useInProcessDb();

  beforeEach(() => {
    stubFeatureOn("FLAG_DECOUPLE_UNSAVED");
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

  it("ignores edits made on a scenario", async () => {
    const store = await aSavedProject();

    createScenario(store);
    addJunction(store, [10, 20]);

    expect(hasUnsavedChanges(store)).toBe(false);
  });
});

describe("unsaved changes with FLAG_DECOUPLE_UNSAVED disabled", () => {
  useInProcessDb();

  beforeEach(() => {
    stubFeatureOff("FLAG_DECOUPLE_UNSAVED");
  });

  it("reports saved when nothing changed", async () => {
    const store = await aSavedProject();

    expect(hasUnsavedChanges(store)).toBe(false);
  });

  it("reports unsaved after a model edit", async () => {
    const store = await aSavedProject();

    addJunction(store, [10, 20]);

    expect(hasUnsavedChanges(store)).toBe(true);
  });

  it("reports unsaved for edits made on a scenario", async () => {
    const store = await aSavedProject();

    createScenario(store);
    addJunction(store, [10, 20]);

    expect(hasUnsavedChanges(store)).toBe(true);
  });
});
