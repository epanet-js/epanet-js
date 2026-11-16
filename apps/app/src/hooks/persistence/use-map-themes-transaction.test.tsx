import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { toMapThemeSpec } from "src/lib/db/mappers/map-themes/to-rows";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { writeQueue } from "src/lib/persistence/write-queue";
import { dialogAtom } from "src/state/dialog";
import {
  activeMapThemeIdAtom,
  defaultMapThemeSymbology,
  mapThemesAtom,
  type MapTheme,
} from "src/state/map-themes";
import { projectDataVersionAtom } from "src/state/project-revision";
import type { Store } from "src/state";
import { useMapThemesTransaction } from "./use-map-themes-transaction";

const aTheme = (overrides: Partial<MapTheme> = {}): MapTheme => ({
  id: "theme-1",
  name: "Pressure",
  spec: toMapThemeSpec(defaultMapThemeSymbology),
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
  renderHook(() => useMapThemesTransaction(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const storedNames = async () => {
  const { mapThemes } = await fetchProject();
  return mapThemes.map((theme) => theme.name);
};

describe("useMapThemesTransaction", () => {
  useInProcessDb();

  it("stores a new theme in the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      await writeQueue.whenIdle();
    });

    expect(store.get(mapThemesAtom)).toEqual([aTheme()]);
    expect((await fetchProject()).mapThemes).toEqual([aTheme()]);
  });

  it("marks the project as having changes to save", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const versionBefore = store.get(projectDataVersionAtom);
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      await writeQueue.whenIdle();
    });

    expect(store.get(projectDataVersionAtom)).not.toEqual(versionBefore);
  });

  it("stores a saved theme in its place", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      result.current.save(aTheme({ id: "theme-2", name: "Zones" }));
      result.current.save(aTheme({ name: "Heads" }));
      await writeQueue.whenIdle();
    });

    expect(await storedNames()).toEqual(["Heads", "Zones"]);
  });

  it("stores a renamed theme under its new name", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      result.current.rename({ id: "theme-1", name: "Heads" });
      await writeQueue.whenIdle();
    });

    expect(await storedNames()).toEqual(["Heads"]);
  });

  it("drops a deleted theme from the project", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      result.current.remove("theme-1");
      await writeQueue.whenIdle();
    });

    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(await storedNames()).toEqual([]);
  });

  it("stores the active theme", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    await act(async () => {
      result.current.save(aTheme());
      result.current.setActive("theme-1");
      await writeQueue.whenIdle();
    });

    expect(store.get(activeMapThemeIdAtom)).toEqual("theme-1");
    expect((await fetchProject()).activeMapThemeId).toEqual("theme-1");
  });

  it("leaves the project untouched when the active theme doesn't change", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const versionBefore = store.get(projectDataVersionAtom);
    const { result } = renderTransaction(store);

    act(() => {
      result.current.setActive(null);
    });

    expect(store.get(projectDataVersionAtom)).toEqual(versionBefore);
  });

  it("refuses a theme it could not store and tells the user", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let accepted = true;
    await act(async () => {
      accepted = result.current.save(aTheme({ name: "" }));
      await writeQueue.whenIdle();
    });

    expect(accepted).toBe(false);
    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(store.get(dialogAtom)).toEqual({ type: "changeNotApplied" });
    expect(await storedNames()).toEqual([]);
  });

  it("refuses a rename it could not store and keeps the stored name", async () => {
    await anEmptyProject();
    const store = setInitialState({});
    const { result } = renderTransaction(store);

    let accepted = true;
    await act(async () => {
      result.current.save(aTheme());
      accepted = result.current.rename({ id: "theme-1", name: "" });
      await writeQueue.whenIdle();
    });

    expect(accepted).toBe(false);
    expect(store.get(mapThemesAtom)).toEqual([aTheme()]);
    expect(await storedNames()).toEqual(["Pressure"]);
  });
});
