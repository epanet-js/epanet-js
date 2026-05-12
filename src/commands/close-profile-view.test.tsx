import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import {
  hasProfileViewAtom,
  profileViewAtom,
  profileViewOpenAtom,
} from "src/state/profile-view";
import { Mode, modeAtom } from "src/state/mode";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useCloseProfileView } from "./close-profile-view";
import { buildProfileView } from "src/panels/profile-view/build-profile-view";

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

const seedProfileView = (store: Store) => {
  const hydraulicModel = store.get(stagingModelDerivedAtom);
  const built = buildProfileView({
    startNodeId: IDS.J1,
    endNodeId: IDS.J3,
    hydraulicModel,
    results: createMockResultsReader(),
    isUnprojected: false,
  });
  if ("error" in built) throw new Error("expected profileView");
  store.set(profileViewAtom, built.profileView);
};

describe("useCloseProfileView", () => {
  it("clears the snapshot when a profile view is showing", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    seedProfileView(store);
    expect(store.get(hasProfileViewAtom)).toBe(true);

    renderTrigger({ store });
    await userEvent.click(screen.getByRole("button", { name: "close" }));

    expect(store.get(profileViewAtom)).toBeNull();
    expect(store.get(hasProfileViewAtom)).toBe(false);
  });

  it("closes from an empty open tab (no snapshot, no mode)", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
    });
    store.set(profileViewOpenAtom, true);
    expect(store.get(hasProfileViewAtom)).toBe(true);

    renderTrigger({ store });
    await userEvent.click(screen.getByRole("button", { name: "close" }));

    expect(store.get(profileViewOpenAtom)).toBe(false);
    expect(store.get(hasProfileViewAtom)).toBe(false);
  });

  it("exits PROFILE_VIEW mode when mid-selection", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
      mode: Mode.PROFILE_VIEW,
    });
    expect(store.get(hasProfileViewAtom)).toBe(true);

    renderTrigger({ store });
    await userEvent.click(screen.getByRole("button", { name: "close" }));

    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
    expect(store.get(hasProfileViewAtom)).toBe(false);
  });
});

const Trigger = () => {
  const close = useCloseProfileView();
  return (
    <button aria-label="close" onClick={() => close({ source: "tab" })}>
      Close
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
