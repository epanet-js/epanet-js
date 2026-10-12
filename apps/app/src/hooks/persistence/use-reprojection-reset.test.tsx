import { renderHook, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  hasUnsavedChangesRevisionAtom,
  markProjectSavedAtom,
} from "src/state/project-revision";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import { useReprojectionReset } from "./use-reprojection-reset";

const reproject = async (store: Store) => {
  const { result } = renderHook(() => useReprojectionReset(), {
    wrapper: ({ children }) => (
      <JotaiProvider store={store}>{children}</JotaiProvider>
    ),
  });

  await act(async () => {
    await result.current.reprojectionReset({
      hydraulicModel: { ...store.get(stagingModelDerivedAtom) },
      projectSettings: {
        ...store.get(projectSettingsAtom),
        projection: {
          type: "proj4",
          id: "EPSG:3857",
          name: "WGS 84 / Pseudo-Mercator",
          code: "EPSG:3857",
        },
      },
      autoElevations: true,
    });
  });
};

describe("useReprojectionReset", () => {
  useInProcessDb();

  it("flags the saved project as having unsaved changes", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    });
    store.set(markProjectSavedAtom);
    expect(store.get(hasUnsavedChangesRevisionAtom)).toBe(false);

    await reproject(store);

    expect(store.get(hasUnsavedChangesRevisionAtom)).toBe(true);
  });
});
