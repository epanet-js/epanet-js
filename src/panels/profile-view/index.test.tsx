import { render, screen } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { profileViewAtom, ProfileView } from "src/state/profile-view";
import { AssetId } from "src/hydraulic-model";
import { Store } from "src/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { ProfileViewPanel } from "./index";

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

const aProfileView = ({
  nodeIds,
  linkIds,
}: {
  nodeIds: AssetId[];
  linkIds: AssetId[];
}): ProfileView => ({
  id: "test-profile-view",
  startNodeId: nodeIds[0],
  endNodeId: nodeIds[nodeIds.length - 1],
  nodeIds,
  linkIds,
  terrain: null,
  hglRanges: null,
  isUnprojected: false,
});

describe("ProfileViewPanel pathBroken state", () => {
  it("shows the broken-path empty state when a frozen node id is missing", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    store.set(
      profileViewAtom,
      aProfileView({
        nodeIds: [IDS.J1, IDS.J2, 999],
        linkIds: [IDS.P1, IDS.P2],
      }),
    );

    renderPanel({ store });

    expect(screen.getByText(/no longer exist/i)).toBeInTheDocument();
  });

  it("shows the broken-path empty state when a frozen link id is missing", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    store.set(
      profileViewAtom,
      aProfileView({
        nodeIds: [IDS.J1, IDS.J2, IDS.J3],
        linkIds: [IDS.P1, 999],
      }),
    );

    renderPanel({ store });

    expect(screen.getByText(/no longer exist/i)).toBeInTheDocument();
  });

  it("idle state shows no broken-path message", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });

    renderPanel({ store });

    expect(screen.queryByText(/no longer exist/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

const renderPanel = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <ProfileViewPanel />
    </CommandContainer>,
  );
};
