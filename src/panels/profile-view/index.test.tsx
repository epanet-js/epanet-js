import { render, screen } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import {
  profilePathAtom,
  profileViewAtom,
  ProfileView,
} from "src/state/profile-view";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { simulationStepAtom } from "src/state/simulation";
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

const aProfileView = ({ anchors }: { anchors: AssetId[] }): ProfileView => ({
  id: "test-profile-view",
  anchors,
  terrain: null,
  isUnprojected: false,
});

describe("ProfileViewPanel pathBroken state", () => {
  it("shows the broken-path empty state when an anchor is missing", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, 999] }));

    renderPanel({ store });

    expect(screen.getByText(/no longer exist/i)).toBeInTheDocument();
  });

  it("shows the broken-path empty state when no route exists between anchors", () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
        .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
        .build(),
      simulationResults: createMockResultsReader(),
    });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, IDS.J3] }));

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

describe("ProfileViewPanel reactive path", () => {
  const N = 6;
  const P2a = 7;
  const P2b = 8;

  const buildSplitModel = () =>
    HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
      .aJunction(IDS.J2, { coordinates: [1, 0], elevation: 11 })
      .aJunction(N, { coordinates: [1.5, 0], elevation: 11.5 })
      .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        length: 100,
      })
      .aPipe(P2a, {
        startNodeId: IDS.J2,
        endNodeId: N,
        length: 50,
      })
      .aPipe(P2b, {
        startNodeId: N,
        endNodeId: IDS.J3,
        length: 50,
      })
      .build();

  it("re-derives the path through a new junction after splitting a pipe", () => {
    const store = setInitialState({ hydraulicModel: buildLinearModel() });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, IDS.J3] }));
    renderPanel({ store });

    store.set(stagingModelDerivedAtom, buildSplitModel());

    const path = store.get(profilePathAtom);
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.J1, IDS.J2, N, IDS.J3]);
    expect(path!.linkIds).toEqual([IDS.P1, P2a, P2b]);
    expect(screen.queryByText(/no longer exist/i)).not.toBeInTheDocument();
  });

  it("re-derives the collapsed path after removing an intermediate node", () => {
    const store = setInitialState({ hydraulicModel: buildSplitModel() });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, IDS.J3] }));
    renderPanel({ store });

    store.set(stagingModelDerivedAtom, buildLinearModel());

    const path = store.get(profilePathAtom);
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.J1, IDS.J2, IDS.J3]);
    expect(path!.linkIds).toEqual([IDS.P1, IDS.P2]);
    expect(screen.queryByText(/no longer exist/i)).not.toBeInTheDocument();
  });

  it("keeps the path rendered when a path link has initialStatus=closed", () => {
    const V = 6;
    const buildLinearWithClosedValve = () =>
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
        .aJunction(V, { coordinates: [0.5, 0], elevation: 10.5 })
        .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
        .aValve(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: V,
          initialStatus: "closed",
        })
        .aPipe(IDS.P2, {
          startNodeId: V,
          endNodeId: IDS.J3,
          length: 100,
        })
        .build();

    const store = setInitialState({
      hydraulicModel: buildLinearWithClosedValve(),
    });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, V, IDS.J3] }));
    renderPanel({ store });

    const path = store.get(profilePathAtom);
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.J1, V, IDS.J3]);
    expect(path!.linkIds).toEqual([IDS.P1, IDS.P2]);
    expect(screen.queryByText(/no longer exist/i)).not.toBeInTheDocument();
  });

  it("keeps the path identical when the simulation step changes", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      simulationResults: createMockResultsReader(),
    });
    store.set(profileViewAtom, aProfileView({ anchors: [IDS.J1, IDS.J3] }));
    renderPanel({ store });

    const pathBefore = store.get(profilePathAtom);
    expect(pathBefore).not.toBeNull();

    store.set(simulationStepAtom, 5);

    const pathAfter = store.get(profilePathAtom);
    expect(pathAfter).not.toBeNull();
    expect(pathAfter!.nodeIds).toEqual(pathBefore!.nodeIds);
    expect(pathAfter!.linkIds).toEqual(pathBefore!.linkIds);
    expect(pathAfter!.totalLength).toBe(pathBefore!.totalLength);
  });

  it("honors a waypoint anchor in the middle", () => {
    const store = setInitialState({ hydraulicModel: buildLinearModel() });
    store.set(
      profileViewAtom,
      aProfileView({ anchors: [IDS.J1, IDS.J2, IDS.J3] }),
    );
    renderPanel({ store });

    const path = store.get(profilePathAtom);
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([IDS.J1, IDS.J2, IDS.J3]);
    expect(path!.linkIds).toEqual([IDS.P1, IDS.P2]);
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
