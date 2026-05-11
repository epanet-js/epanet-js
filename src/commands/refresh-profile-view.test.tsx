import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { profileViewAtom } from "src/state/profile-view";
import { dialogAtom } from "src/state/dialog";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useRefreshProfileView } from "./refresh-profile-view";
import { buildProfileViewSnapshot } from "src/panels/profile-view/snapshot";
import { defaultProjectSettings } from "src/lib/project-settings";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 4,
  P2: 5,
} as const;

const buildLinearModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [1, 0], elevation: 11 })
    .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      length: 100,
    })
    .aPipe(IDS.P2, {
      startNodeId: IDS.J2,
      endNodeId: IDS.J3,
      length: 100,
    })
    .build();

const seedSnapshot = (store: Store) => {
  const hydraulicModel = store.get(stagingModelDerivedAtom);
  const built = buildProfileViewSnapshot({
    startNodeId: IDS.J1,
    endNodeId: IDS.J3,
    hydraulicModel,
    results: createMockResultsReader(),
    projectSettings: defaultProjectSettings,
    isUnprojected: false,
  });
  if ("error" in built) throw new Error("expected snapshot");
  store.set(profileViewAtom, built.snapshot);
  return built.snapshot;
};

describe("useRefreshProfileView", () => {
  it("replaces the snapshot with a fresh one (new id) using current model + results", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    const original = seedSnapshot(store);

    renderTrigger({ store });

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    const next = store.get(profileViewAtom);
    expect(next).not.toBeNull();
    expect(next?.id).not.toBe(original.id);
    expect(next?.startNodeId).toBe(IDS.J1);
    expect(next?.endNodeId).toBe(IDS.J3);
    expect(next?.nodeIds).toEqual([IDS.J1, IDS.J2, IDS.J3]);
  });

  it("opens the profile-no-path dialog and leaves snapshot untouched when no path exists", async () => {
    const isolatedModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
      .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
      // No pipes — J1 and J3 are disconnected
      .build();

    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    const original = seedSnapshot(store);

    // Swap in the disconnected model BEFORE refresh fires
    store.set(stagingModelDerivedAtom, isolatedModel);

    renderTrigger({ store });

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    expect(store.get(dialogAtom)).toEqual({ type: "profileNoPath" });
    expect(store.get(profileViewAtom)?.id).toBe(original.id);
  });

  it("is a no-op when there is no active snapshot", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });

    renderTrigger({ store });

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    expect(store.get(profileViewAtom)).toBeNull();
  });
});

const Trigger = () => {
  const refresh = useRefreshProfileView();
  return (
    <button aria-label="refresh" onClick={() => refresh()}>
      Refresh
    </button>
  );
};

const renderTrigger = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
};
