import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { setInitialState } from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { importProject } from "src/lib/db/commands/import-project";
import { fetchProject } from "src/lib/db/commands/fetch-project";
import { writeQueue } from "src/lib/persistence/write-queue";
import { nullSymbologySpec } from "src/map/symbology/symbology-types";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { linkSymbologyAtom } from "src/state/map-symbology";
import {
  activeMapThemeIdAtom,
  isMapThemeModifiedAtom,
  mapThemesAtom,
} from "src/state/map-themes";
import type { Store } from "src/state";
import {
  useApplyMapTheme,
  useDeleteMapTheme,
  useDuplicateMapTheme,
  useSaveMapThemeAsNew,
  useSaveMapThemeChanges,
} from "./map-themes";

const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();

const anEmptyProject = () =>
  importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

const renderCommands = (store: Store) =>
  renderHook(
    () => ({
      apply: useApplyMapTheme(),
      saveAsNew: useSaveMapThemeAsNew(),
      saveChanges: useSaveMapThemeChanges(),
      duplicate: useDuplicateMapTheme(),
      remove: useDeleteMapTheme(),
    }),
    {
      wrapper: ({ children }) => (
        <JotaiProvider store={store}>{children}</JotaiProvider>
      ),
    },
  ).result;

const labelLinks = (store: Store) =>
  store.set(linkSymbologyAtom, {
    ...nullSymbologySpec.link,
    labelRule: "label",
  });

describe("map theme commands", () => {
  useInProcessDb();

  it("save the current settings as a new active theme", async () => {
    await anEmptyProject();
    const store = setInitialState({ hydraulicModel });
    const commands = renderCommands(store);
    labelLinks(store);

    await act(async () => {
      commands.current.saveAsNew("My theme");
      await writeQueue.whenIdle();
    });

    const [theme] = store.get(mapThemesAtom);
    expect(theme.name).toEqual("My theme");
    expect(store.get(activeMapThemeIdAtom)).toEqual(theme.id);
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
    expect((await fetchProject()).activeMapThemeId).toEqual(theme.id);
  });

  it("save changes into the active theme", async () => {
    await anEmptyProject();
    const store = setInitialState({ hydraulicModel });
    const commands = renderCommands(store);
    act(() => {
      commands.current.saveAsNew("My theme");
    });
    labelLinks(store);

    act(() => {
      commands.current.saveChanges();
    });
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);

    const [theme] = store.get(mapThemesAtom);
    act(() => {
      commands.current.apply(null);
      commands.current.apply(theme.id);
    });
    expect(store.get(linkSymbologyAtom).labelRule).toEqual("label");
  });

  it("don't save changes over the default theme", async () => {
    await anEmptyProject();
    const store = setInitialState({ hydraulicModel });
    const commands = renderCommands(store);
    labelLinks(store);

    act(() => {
      commands.current.saveChanges();
    });

    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(store.get(isMapThemeModifiedAtom)).toBe(true);
  });

  it("apply a duplicated theme", async () => {
    await anEmptyProject();
    const store = setInitialState({ hydraulicModel });
    const commands = renderCommands(store);
    act(() => {
      commands.current.saveAsNew("My theme");
    });
    const [source] = store.get(mapThemesAtom);

    act(() => {
      commands.current.duplicate({ id: source.id, name: "My theme copy" });
    });

    const [, copy] = store.get(mapThemesAtom);
    expect(copy).toMatchObject({ name: "My theme copy", spec: source.spec });
    expect(store.get(activeMapThemeIdAtom)).toEqual(copy.id);
  });

  it("fall back to the default theme when the active one is deleted", async () => {
    await anEmptyProject();
    const store = setInitialState({ hydraulicModel });
    const commands = renderCommands(store);
    labelLinks(store);
    act(() => {
      commands.current.saveAsNew("My theme");
    });
    const [theme] = store.get(mapThemesAtom);

    await act(async () => {
      commands.current.remove(theme.id);
      await writeQueue.whenIdle();
    });

    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(store.get(activeMapThemeIdAtom)).toBeNull();
    expect(store.get(linkSymbologyAtom)).toEqual(nullSymbologySpec.link);
    const project = await fetchProject();
    expect(project.mapThemes).toEqual([]);
    expect(project.activeMapThemeId).toBeNull();
  });
});
