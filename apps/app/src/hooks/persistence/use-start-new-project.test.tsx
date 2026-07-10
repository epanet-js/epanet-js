import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubFeatureOff } from "src/__helpers__/feature-flags";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import {
  stagingModelDerivedAtom,
  baseModelDerivedAtom,
} from "src/state/derived-branch-state";
import { inpFileInfoAtom, projectFileInfoAtom } from "src/state/file-system";
import { Store } from "src/state";
import { useStartBlankProject } from "./use-start-new-project";

const IDS = { J1: 1 } as const;

const renderStartEmptyProject = (store: Store) =>
  renderHook(() => useStartBlankProject(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

describe("useStartBlankProject", () => {
  useInProcessDb();

  beforeEach(() => {
    stubFeatureOff("FLAG_NULL_VALUES");
  });

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
});
