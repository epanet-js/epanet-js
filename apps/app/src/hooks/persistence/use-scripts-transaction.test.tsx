import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { SCRIPT_API_VERSION } from "@epanet-js/scripting-docs";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { exportDb } from "src/lib/db/commands/export-db";
import { openProject } from "src/lib/db/commands/open-project";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import { projectDataVersionAtom } from "src/state/project-revision";
import { userScriptsAtom } from "src/state/scripts";
import type { Store } from "src/state";
import { useScriptsTransaction } from "./use-scripts-transaction";

const anEmptyProject = () =>
  importProject({
    newDb: true,
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

const renderTransaction = (store: Store) =>
  renderHook(() => useScriptsTransaction(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storedScripts = async () => (await fetchProject()).scripts;

describe("useScriptsTransaction", () => {
  useInProcessDb();

  it("stores a new script in the project, stamped with the script API version", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save({
        id: null,
        name: "Pipe audit",
        source: "console.log(1);",
      });
      await writeQueue.whenIdle();
    });

    const expected = expect.objectContaining({
      name: "Pipe audit",
      source: "console.log(1);",
      apiVersion: SCRIPT_API_VERSION,
    });
    expect(store.get(userScriptsAtom)).toEqual([expected]);
    expect(await storedScripts()).toEqual(store.get(userScriptsAtom));
  });

  it("keeps the scripts in a saved file", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);
    await act(async () => {
      result.current.save({ id: null, name: "Pipe audit", source: "" });
      await writeQueue.whenIdle();
    });

    const blob = await exportDb();
    await openProject(new File([blob], "saved.epnt"));

    expect(await storedScripts()).toEqual(store.get(userScriptsAtom));
  });

  it("marks the project as having changes to save", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const versionBefore = store.get(projectDataVersionAtom);
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save({ id: null, name: "Pipe audit", source: "" });
      await writeQueue.whenIdle();
    });

    expect(store.get(projectDataVersionAtom)).not.toEqual(versionBefore);
  });

  it("replaces a script saved again and lists it first", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      const first = result.current.save({
        id: null,
        name: "First",
        source: "",
      });
      result.current.save({ id: null, name: "Second", source: "" });
      result.current.save({ id: first!.id, name: "Renamed", source: "x" });
      await writeQueue.whenIdle();
    });

    expect((await storedScripts()).map(({ name }) => name)).toEqual([
      "Renamed",
      "Second",
    ]);
  });

  it("drops a deleted script from the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      const saved = result.current.save({
        id: null,
        name: "Pipe audit",
        source: "",
      });
      result.current.remove(saved!.id);
      await writeQueue.whenIdle();
    });

    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(await storedScripts()).toEqual([]);
  });

  it("refuses a script it could not store and tells the user", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let saved: unknown = undefined;
    await act(async () => {
      saved = result.current.save({ id: null, name: "", source: "" });
      await writeQueue.whenIdle();
    });

    expect(saved).toBeNull();
    expect(store.get(userScriptsAtom)).toEqual([]);
    expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
    expect(await storedScripts()).toEqual([]);
  });
});
