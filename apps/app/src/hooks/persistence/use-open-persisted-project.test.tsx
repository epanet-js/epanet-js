import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { aNodeSymbology, setInitialState } from "src/__helpers__/state";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import * as db from "src/lib/db";
import { toMapThemeSpec } from "src/lib/db/mappers/map-themes/to-rows";
import { nodeSymbologyAtom } from "src/state/map-symbology";
import {
  activeMapThemeIdAtom,
  defaultMapThemeSymbology,
  isMapThemeModifiedAtom,
  mapThemesAtom,
  type MapTheme,
} from "src/state/map-themes";
import type { Store } from "src/state";
import { useOpenPersistedProject } from "./use-open-persisted-project";

const anElevationTheme = (): MapTheme => ({
  id: "elevations",
  name: "Elevations",
  spec: toMapThemeSpec({
    ...defaultMapThemeSymbology,
    node: aNodeSymbology({
      colorRule: {
        property: "elevation",
        mode: "manual",
        breaks: [10, 20],
        colors: ["#000001", "#000002", "#000003"],
      },
    }),
  }),
});

const aSavedFileWithActiveTheme = async () => {
  await db.importProject({
    newDb: true,
    hydraulicModel: HydraulicModelBuilder.with()
      .aJunction(1, { elevation: 5 })
      .aJunction(2, { elevation: 25 })
      .build(),
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
    mapThemes: [anElevationTheme()],
    activeMapThemeId: "elevations",
  });
  return new File([await db.exportDb()], "project.ejs");
};

const open = async (store: Store, file: File) => {
  const { result } = renderHook(() => useOpenPersistedProject(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });
  await act(async () => {
    await result.current.openPersistedProject({ file });
  });
};

describe("opening a project with map themes", () => {
  useInProcessDb();

  it("applies the theme that was active when it was saved", async () => {
    stubFeatureOn("FLAG_MAP_THEMES");
    const file = await aSavedFileWithActiveTheme();
    const store = setInitialState({});

    await open(store, file);

    expect(store.get(mapThemesAtom)).toEqual([anElevationTheme()]);
    expect(store.get(activeMapThemeIdAtom)).toEqual("elevations");
    expect(store.get(nodeSymbologyAtom).colorRule).toMatchObject({
      property: "elevation",
      breaks: [10, 20],
      colors: ["#000001", "#000002", "#000003"],
    });
    expect(store.get(isMapThemeModifiedAtom)).toBe(false);
  });

  it("loads no themes without map themes", async () => {
    stubFeatureOff("FLAG_MAP_THEMES");
    const file = await aSavedFileWithActiveTheme();
    const store = setInitialState({});

    await open(store, file);

    expect(store.get(mapThemesAtom)).toEqual([]);
    expect(store.get(activeMapThemeIdAtom)).toBeNull();
    expect(store.get(nodeSymbologyAtom).colorRule).toBeNull();
  });
});
