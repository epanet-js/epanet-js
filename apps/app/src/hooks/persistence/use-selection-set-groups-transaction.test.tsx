import { act } from "react";
import { renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { writeQueue } from "src/lib/persistence/write-queue";
import type { SelectionSet, SelectionSetGroup } from "src/lib/collections";
import { USelection } from "src/selection";
import {
  selectionSetGroupsAtom,
  selectionSetsAtom,
} from "src/state/collections";
import { dialogAtom } from "src/state/dialog";
import { projectDataVersionAtom } from "src/state/project-revision";
import type { Store } from "src/state";
import { useSelectionSetGroupsTransaction } from "./use-selection-set-groups-transaction";

const aGroup = (
  overrides: Partial<SelectionSetGroup> = {},
): SelectionSetGroup => ({
  id: "group-1",
  label: "North",
  parentId: null,
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
  renderHook(() => useSelectionSetGroupsTransaction(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storedLabels = async () => {
  const { selectionSetGroups } = await fetchProject();
  return selectionSetGroups.map((group) => group.label);
};

describe("useSelectionSetGroupsTransaction", () => {
  useInProcessDb();

  it("stores a new group in the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aGroup());
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetGroupsAtom)).toEqual([aGroup()]);
    expect(await storedLabels()).toEqual(["North"]);
  });

  it("marks the project as having changes to save", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const versionBefore = store.get(projectDataVersionAtom);
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aGroup());
      await writeQueue.whenIdle();
    });

    expect(store.get(projectDataVersionAtom)).not.toEqual(versionBefore);
  });

  it("stores a renamed group under its new label", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aGroup());
      result.current.rename({ id: "group-1", label: "Uptown" });
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetGroupsAtom)[0].label).toBe("Uptown");
    expect(await storedLabels()).toEqual(["Uptown"]);
  });

  it("moves a group int a new parent", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aGroup());
      result.current.create(aGroup({ id: "group-2", label: "South" }));
      result.current.move({ id: "group-2", parentId: "group-1" });
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetGroupsAtom)[1].parentId).toBe("group-1");
    const { selectionSetGroups } = await fetchProject();
    expect(selectionSetGroups[1].parentId).toBe("group-1");
  });

  it("drops a deleted group from the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.create(aGroup());
      result.current.create(aGroup({ id: "group-2", label: "South" }));
      result.current.remove("group-1");
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetGroupsAtom).map((g) => g.id)).toEqual([
      "group-2",
    ]);
    expect(await storedLabels()).toEqual(["South"]);
  });

  it("drops the sets inside a deleted group with it, in memory and in the project", async () => {
    const groups = [aGroup(), aGroup({ id: "group-2", label: "South" })];
    const aSet = (id: string, groupId: string | null): SelectionSet => ({
      id,
      label: id.toUpperCase(),
      selection: USelection.fromIds([1], []),
      groupId,
    });
    const sets = [
      aSet("inside", "group-1"),
      aSet("elsewhere", "group-2"),
      aSet("root", null),
    ];
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
      selectionSetGroups: groups,
      selectionSets: sets,
    });
    const store = setInitialState({});
    store.set(selectionSetGroupsAtom, groups);
    store.set(selectionSetsAtom, sets);
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.remove("group-1");
      await writeQueue.whenIdle();
    });

    expect(store.get(selectionSetsAtom).map((s) => s.id)).toEqual([
      "elsewhere",
      "root",
    ]);
    const project = await fetchProject();
    expect(project.selectionSetGroups.map((g) => g.id)).toEqual(["group-2"]);
    expect(project.selectionSets.map((s) => s.id)).toEqual([
      "elsewhere",
      "root",
    ]);
  });

  it("refuses a group it could not store and tells the user", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let accepted = true;
    await act(async () => {
      accepted = result.current.create(aGroup({ label: "" }));
      await writeQueue.whenIdle();
    });

    expect(accepted).toBe(false);
    expect(store.get(selectionSetGroupsAtom)).toEqual([]);
    expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
    expect(await storedLabels()).toEqual([]);
  });
});
