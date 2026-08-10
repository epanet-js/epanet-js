import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { fetchProject } from "src/lib/db";
import {
  stagingModelDerivedAtom,
  baseModelDerivedAtom,
} from "src/state/derived-branch-state";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { projectSettingsAtom } from "src/state/project-settings";
import { Store } from "src/state";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  useSeedDefaultProjectDb,
  useStartBlankProject,
} from "./use-start-new-project";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const IDS = { J1: 1 } as const;

const renderStartEmptyProject = (store: Store) =>
  renderHook(() => useStartBlankProject(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

const renderSeedDefaultProjectDb = (store: Store) =>
  renderHook(() => useSeedDefaultProjectDb(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

describe("useStartBlankProject", () => {
  useInProcessDb();

  it("resets the project to an empty model and clears file info", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .build();
    const store = setInitialState({ hydraulicModel });
    store.set(projectFileInfoAtom, {
      name: "my-project.ejsdb",
      modelVersion: "1",
    });

    expect(store.get(stagingModelDerivedAtom).assets.size).toBeGreaterThan(0);

    const { result } = renderStartEmptyProject(store);
    await act(async () => {
      await result.current();
    });

    expect(store.get(stagingModelDerivedAtom).assets.size).toBe(0);
    expect(store.get(baseModelDerivedAtom).assets.size).toBe(0);
    expect(store.get(inpFileInfoAtom)).toBeNull();
    expect(store.get(projectFileInfoAtom)).toBeNull();
  });

  it("stamps a uniqueId in project settings", async () => {
    const store = setInitialState();

    const { result } = renderStartEmptyProject(store);
    await act(async () => {
      await result.current();
    });

    const uniqueId = store.get(projectSettingsAtom).uniqueId;
    expect(uniqueId).toMatch(UUID_REGEX);
    expect((await fetchProject()).projectSettings.uniqueId).toBe(uniqueId);
  });

  describe("status report default", () => {
    it("defaults to FULL when FLAG_REPORT_YES is disabled", async () => {
      stubFeatureOff("FLAG_REPORT_YES");
      const store = setInitialState();

      const { result } = renderStartEmptyProject(store);
      await act(async () => {
        await result.current();
      });

      expect((await fetchProject()).simulationSettings.statusReport).toBe(
        "FULL",
      );
    });

    it("defaults to YES when FLAG_REPORT_YES is enabled", async () => {
      stubFeatureOn("FLAG_REPORT_YES");
      const store = setInitialState();

      const { result } = renderStartEmptyProject(store);
      await act(async () => {
        await result.current();
      });

      expect((await fetchProject()).simulationSettings.statusReport).toBe(
        "YES",
      );
    });
  });
});

describe("useSeedDefaultProjectDb", () => {
  useInProcessDb();

  it("seeds a FULL status report when FLAG_REPORT_YES is disabled", async () => {
    stubFeatureOff("FLAG_REPORT_YES");
    const store = setInitialState();

    const { result } = renderSeedDefaultProjectDb(store);
    await act(async () => {
      await result.current();
    });

    expect((await fetchProject()).simulationSettings.statusReport).toBe("FULL");
  });

  it("seeds a YES status report when FLAG_REPORT_YES is enabled", async () => {
    stubFeatureOn("FLAG_REPORT_YES");
    const store = setInitialState();

    const { result } = renderSeedDefaultProjectDb(store);
    await act(async () => {
      await result.current();
    });

    expect((await fetchProject()).simulationSettings.statusReport).toBe("YES");
  });
});
