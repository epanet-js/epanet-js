import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { writeQueue } from "src/lib/persistence/write-queue";
import type { SelectionSet } from "src/lib/collections";
import { USelection } from "src/selection";
import { selectionSetsAtom } from "src/state/collections";
import { dialogAtom } from "src/state/dialog";
import { projectDataVersionAtom } from "src/state/project-revision";
import type { Store } from "src/state";
import { useSelectionSetsTransaction } from "./use-selection-sets-transaction";

const aSelectionSet = (
  overrides: Partial<SelectionSet> = {},
): SelectionSet => ({
  id: "set-1",
  label: "Downtown loop",
  selection: USelection.fromIds([1], []),
  groupId: null,
  ...overrides,
});

const anEmptyProject = () =>
  importProject({
    newDb: true,
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

const renderTransaction = (store: Store) =>
  renderHook(() => useSelectionSetsTransaction(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storedLabels = async () => {
  const { selectionSets } = await fetchProject();
  return selectionSets.map((selectionSet) => selectionSet.label);
};

describe("useSelectionSetsTransaction", () => {
  useInProcessDb();

  it("stores a new set in the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aSelectionSet());
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetsAtom)).toEqual([aSelectionSet()]);
    expect(await storedLabels()).toEqual(["Downtown loop"]);
  });

  it("marks the project as having changes to save", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const versionBefore = store.get(projectDataVersionAtom);
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aSelectionSet());
      await writeQueue.whenIdle();
    });

    expect(store.get(projectDataVersionAtom)).not.toEqual(versionBefore);
  });

  it("stores a renamed set under its new label", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aSelectionSet());
      result.current.rename({ id: "set-1", label: "Uptown loop" });
      await writeQueue.whenIdle();
    });

    expect(await storedLabels()).toEqual(["Uptown loop"]);
  });

  it("stores a moved set under its new group", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
      selectionSetGroups: [{ id: "group-1", label: "North", parentId: null }],
    });
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aSelectionSet());
      result.current.move({ id: "set-1", groupId: "group-1" });
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetsAtom)[0].groupId).toBe("group-1");
    const { selectionSets } = await fetchProject();
    expect(selectionSets[0].groupId).toBe("group-1");
  });

  it("drops a deleted set from the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aSelectionSet());
      result.current.remove("set-1");
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetsAtom)).toEqual([]);
    expect(await storedLabels()).toEqual([]);
  });

  it("refuses a set it could not store and tells the user", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let accepted = true;
    await act(async () => {
      accepted = result.current.create(aSelectionSet({ label: "" }));
      await writeQueue.whenIdle();
    });

    expect(accepted).toBe(false);
    expect(store.get(selectionSetsAtom)).toEqual([]);
    expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
    expect(await storedLabels()).toEqual([]);
  });

  it("refuses a rename it could not store and keeps the stored label", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let accepted = true;
    await act(async () => {
      result.current.create(aSelectionSet());
      accepted = result.current.rename({ id: "set-1", label: "" });
      await writeQueue.whenIdle();
    });

    expect(accepted).toBe(false);
    expect(store.get(selectionSetsAtom)).toEqual([aSelectionSet()]);
    expect(await storedLabels()).toEqual(["Downtown loop"]);
  });
});
