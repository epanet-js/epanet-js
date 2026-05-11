import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { profileViewAtom, ProfileViewSnapshot } from "src/state/profile-view";
import { AssetId } from "src/hydraulic-model";
import { Mode, modeAtom } from "src/state/mode";
import { Store } from "src/state";
import { Unit } from "src/quantity";
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

const aSnapshot = ({
  nodeIds,
  linkIds,
}: {
  nodeIds: AssetId[];
  linkIds: AssetId[];
}): ProfileViewSnapshot => ({
  id: "test-snapshot",
  startNodeId: nodeIds[0],
  endNodeId: nodeIds[nodeIds.length - 1],
  nodeIds,
  linkIds,
  data: {
    points: [],
    links: [],
    pathSegments: [],
    pathHighlights: [],
    terrainSamples: [],
    elevationData: [],
    hglData: [],
    nodePositions: [],
    totalLength: 0,
    hasSimulation: false,
    pressureFactor: null,
    hglDropsData: [],
  },
  terrain: null,
  hglRanges: null,
  units: {
    elevation: "m" as Unit,
    length: "m" as Unit,
    pressure: "m" as Unit,
  },
  decimals: { elevation: 2, length: 0, pressure: 2 },
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
      aSnapshot({
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
      aSnapshot({
        nodeIds: [IDS.J1, IDS.J2, IDS.J3],
        linkIds: [IDS.P1, 999],
      }),
    );

    renderPanel({ store });

    expect(screen.getByText(/no longer exist/i)).toBeInTheDocument();
  });

  it("clicking 'Create new profile' from the broken state enters selection mode", async () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    store.set(
      profileViewAtom,
      aSnapshot({
        nodeIds: [IDS.J1, 999],
        linkIds: [IDS.P1],
      }),
    );

    renderPanel({ store });

    await userEvent.click(
      screen.getByRole("button", { name: /create profile/i }),
    );

    expect(store.get(modeAtom).mode).toBe(Mode.PROFILE_VIEW);
  });

  it("idle state still shows the create-profile CTA (no broken message)", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });

    renderPanel({ store });

    expect(
      screen.getByRole("button", { name: /create profile/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/no longer exist/i)).not.toBeInTheDocument();
  });
});

const renderPanel = ({ store }: { store: Store }) => {
  render(
    <CommandContainer store={store}>
      <ProfileViewPanel />
    </CommandContainer>,
  );
};
