import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import {
  LabelManager,
  emptyCustomAttributesDefinition,
  getAttributes,
  getCustomerPointDemands,
  initializeModelFactories,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import {
  buildCustomerPoint,
  HydraulicModelBuilder,
} from "@epanet-js/hydraulic-model-testing";
import { aSingleSelection, setInitialState } from "src/__helpers__/state";
import { buildIdPools } from "src/lib/id-pools";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import * as db from "src/lib/db";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useUndoableTransactions } from "src/hooks/persistence/use-undoable-transactions";
import { useHasUnsavedChanges } from "src/hooks/use-has-unsaved-changes";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import type { Store } from "src/state";
import { useImportCustomerPoints } from "./import-customer-points";

const IDS = { J1: 1, OLD: 10, NEW: 121 } as const;

const withStore = (store: Store) => ({
  wrapper: ({ children }: { children: React.ReactNode }) => (
    <JotaiProvider store={store}>{children}</JotaiProvider>
  ),
});

const aSavedProject = async (): Promise<Store> => {
  const hydraulicModel = HydraulicModelBuilder.with()
    .aJunction(IDS.J1)
    .aCustomerPoint(IDS.OLD, { coordinates: [1, 1], label: "OLD" })
    .aCustomerPointDemand(IDS.OLD, [{ baseDemand: 5 }])
    .build();
  const store = setInitialState({
    hydraulicModel,
    isProjectSaved: true,
    selection: aSingleSelection({ id: IDS.J1 }),
  });
  store.set(
    modelFactoriesAtom,
    initializeModelFactories({
      idPools: buildIdPools({
        asset: 30,
        customerPoint: 20,
        pattern: 40,
        curve: 50,
        zone: 60,
      }),
      labelManager: new LabelManager(),
    }),
  );
  await db.importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
  return store;
};

const aCustomerPointWithArea = () => {
  const customerPoint = buildCustomerPoint(IDS.NEW, {
    coordinates: [2, 2],
    label: "NEW",
  });
  customerPoint.setProperty("custom-1", "North");
  return customerPoint;
};

const applyImport = (store: Store) => {
  const { result } = renderHook(
    () => useImportCustomerPoints(),
    withStore(store),
  );
  let applied = false;
  act(() => {
    applied = result.current({
      customerPoints: [aCustomerPointWithArea()],
      customerPointDemands: new Map([[IDS.NEW, [{ baseDemand: 7 }]]]),
      preserveJunctionDemands: true,
      customAttributes: setAttributes(
        emptyCustomAttributesDefinition(),
        "customerPoint",
        [{ id: "custom-1", label: "Area", type: "text" }],
      ),
    });
  });
  return applied;
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

describe("useImportCustomerPoints", () => {
  useInProcessDb();

  it("replaces the customer points in the model", async () => {
    const store = await aSavedProject();

    expect(applyImport(store)).toBe(true);

    const model = store.get(stagingModelDerivedAtom);
    expect([...model.customerPoints.keys()]).toEqual([IDS.NEW]);
    expect(getCustomerPointDemands(model.demands, IDS.NEW)).toEqual([
      { baseDemand: 7 },
    ]);
  });

  it("saves the imported points and attributes to the project", async () => {
    const store = await aSavedProject();

    applyImport(store);

    await waitFor(async () => {
      const { hydraulicModel: saved } = await fetchProject();
      expect([...saved.customerPoints.keys()]).toEqual([IDS.NEW]);
      expect(saved.customerPoints.get(IDS.NEW)?.getProperty("custom-1")).toBe(
        "North",
      );
      expect(getAttributes(saved.customAttributes, "customerPoint")).toEqual([
        { id: "custom-1", label: "Area", type: "text" },
      ]);
    });
  });

  it("registers the imported labels and releases the replaced ones", async () => {
    const store = await aSavedProject();
    const { labelManager } = store.get(modelFactoriesAtom);
    labelManager.register("OLD", "customerPoint", IDS.OLD);

    applyImport(store);

    expect(labelManager.isLabelAvailable("NEW", "customerPoint")).toBe(false);
    expect(labelManager.isLabelAvailable("OLD", "customerPoint")).toBe(true);
  });

  it("clears the selection", async () => {
    const store = await aSavedProject();

    applyImport(store);

    expect(store.get(selectionAtom)).toEqual(USelection.none());
  });

  it("restores the replaced customer points on undo", async () => {
    const store = await aSavedProject();

    applyImport(store);
    undo(store);

    const model = store.get(stagingModelDerivedAtom);
    expect([...model.customerPoints.keys()]).toEqual([IDS.OLD]);
    expect(getCustomerPointDemands(model.demands, IDS.OLD)).toEqual([
      { baseDemand: 5 },
    ]);
  });

  it("reports unsaved changes", async () => {
    const store = await aSavedProject();

    applyImport(store);

    const { result } = renderHook(
      () => useHasUnsavedChanges(),
      withStore(store),
    );
    expect(result.current).toBe(true);
  });
});
