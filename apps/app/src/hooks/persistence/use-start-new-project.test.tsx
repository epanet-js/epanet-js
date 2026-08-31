import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { fetchProject } from "src/lib/db";
import { OPFSStorage } from "src/infra/storage";
import type { SimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  baseModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { projectSettingsAtom } from "src/state/project-settings";
import { Store } from "src/state";
import {
  useSeedDefaultProjectDb,
  useStartBlankProject,
  withDatabaseBusy,
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

  describe("overlapping swaps", () => {
    it("drops a swap that starts while another one is running", async () => {
      const store = setInitialState();
      const { result } = renderStartEmptyProject(store);

      let outcomes: boolean[] = [];
      await act(async () => {
        outcomes = await Promise.all([result.current(), result.current()]);
      });

      expect(outcomes).toEqual([true, false]);
    });

    it("accepts a swap once the previous one finished", async () => {
      const store = setInitialState();
      const { result } = renderStartEmptyProject(store);

      let started = false;
      await act(async () => {
        await result.current();
        started = await result.current();
      });

      expect(started).toBe(true);
    });
  });

  describe("simulation storage teardown", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("drops the results reader from state before deleting simulation storage", async () => {
      const store = setInitialState({
        simulationResults: createMockResultsReader(),
      });
      expect(store.get(simulationDerivedAtom)).toHaveProperty(
        "epsResultsReader",
      );

      const simulationWhenCleared: SimulationState[] = [];
      vi.spyOn(OPFSStorage.prototype, "clear").mockImplementation(() => {
        simulationWhenCleared.push(store.get(simulationDerivedAtom));
        return Promise.resolve();
      });

      const { result } = renderStartEmptyProject(store);
      await act(async () => {
        await result.current();
      });

      expect(simulationWhenCleared).toHaveLength(1);
      expect(simulationWhenCleared[0]).not.toHaveProperty("epsResultsReader");
    });
  });

  describe("status report default", () => {
    it("defaults to YES", async () => {
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

describe("withDatabaseBusy", () => {
  it("drops a run that starts while another one is in flight", async () => {
    let releaseFirst = () => {};
    const first = withDatabaseBusy(
      () =>
        new Promise<string>(
          (resolve) => (releaseFirst = () => resolve("first")),
        ),
    );

    const dropped = await withDatabaseBusy(() => Promise.resolve("second"));
    releaseFirst();

    expect(dropped).toBeNull();
    expect(await first).toBe("first");
  });

  it("releases the guard when the run fails", async () => {
    await expect(
      withDatabaseBusy(() => Promise.reject(new Error("boom"))),
    ).rejects.toThrow("boom");

    expect(await withDatabaseBusy(() => Promise.resolve("next"))).toBe("next");
  });
});

describe("useSeedDefaultProjectDb", () => {
  useInProcessDb();

  it("seeds a YES status report", async () => {
    const store = setInitialState();

    const { result } = renderSeedDefaultProjectDb(store);
    await act(async () => {
      await result.current();
    });

    expect((await fetchProject()).simulationSettings.statusReport).toBe("YES");
  });
});
