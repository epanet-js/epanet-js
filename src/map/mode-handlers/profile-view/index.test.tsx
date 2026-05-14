import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import type { Store } from "src/state";
import type { HandlerContext } from "src/types";
import type { Asset, AssetId, HydraulicModel } from "src/hydraulic-model";
import { useProfileViewHandlers } from "./index";

let nextClickedAsset: Asset | null = null;

vi.mock("src/map/mode-handlers/utils", async () => {
  const actual = await vi.importActual<
    typeof import("src/map/mode-handlers/utils")
  >("src/map/mode-handlers/utils");
  return {
    ...actual,
    useClickedAsset: () => ({
      getClickedAsset: () => nextClickedAsset,
    }),
  };
});

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 4,
  P2: 5,
} as const;

const ISOLATED = 100;

const buildLinearModel = () =>
  HydraulicModelBuilder.with()
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [1, 0], elevation: 11 })
    .aJunction(IDS.J3, { coordinates: [2, 0], elevation: 12 })
    .aJunction(ISOLATED, { coordinates: [10, 10], elevation: 5 })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, length: 100 })
    .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3, length: 100 })
    .build();

const clickNode = (
  handlers: ReturnType<typeof useProfileViewHandlers>,
  store: Store,
  nodeId: AssetId,
) => {
  const model = store.get(stagingModelDerivedAtom);
  nextClickedAsset = (model.assets.get(nodeId) as Asset) ?? null;
  act(() => {
    handlers.click({} as never);
  });
  nextClickedAsset = null;
};

describe("useProfileViewHandlers click (commit-on-click model)", () => {
  it("stages the first anchor without committing a profile view", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });

    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);

    expect(store.get(profileViewAtom)).toBeNull();
    const ephemeral = store.get(ephemeralStateAtom);
    expect(ephemeral.type).toBe("profileView");
    expect(
      ephemeral.type === "profileView" ? ephemeral.anchorIds : null,
    ).toEqual([IDS.J1]);
    expect(store.get(selectionAtom)).toEqual({ type: "none" });
  });

  it("commits the profile view on the second valid click", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });

    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J3);

    const committed = store.get(profileViewAtom);
    expect(committed).not.toBeNull();
    expect(committed!.anchors).toEqual([IDS.J1, IDS.J2, IDS.J3]);

    const ephemeral = store.get(ephemeralStateAtom);
    expect(ephemeral.type).toBe("profileView");
    expect(
      ephemeral.type === "profileView" ? ephemeral.anchorIds : null,
    ).toBeUndefined();

    expect(store.get(selectionAtom)).toEqual({
      type: "multi",
      ids: [IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2],
    });

    expect(store.get(modeAtom).mode).toBe(Mode.PROFILE_VIEW);
  });

  it("extends the committed profile view on a subsequent valid click", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J2);

    const before = store.get(profileViewAtom);
    expect(before!.anchors).toEqual([IDS.J1, IDS.J2]);

    clickNode(handlers, store, IDS.J3);

    const after = store.get(profileViewAtom);
    expect(after!.anchors).toEqual([IDS.J1, IDS.J2, IDS.J3]);
    expect(after!.id).not.toBe(before!.id);

    expect(store.get(selectionAtom)).toEqual({
      type: "multi",
      ids: [IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2],
    });
  });

  it("ignores a click on the same last anchor", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J3);
    const idBefore = store.get(profileViewAtom)!.id;

    clickNode(handlers, store, IDS.J3);

    expect(store.get(profileViewAtom)!.id).toBe(idBefore);
  });

  it("rejects an invalid extension click silently", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J3);
    const committedBefore = store.get(profileViewAtom);

    clickNode(handlers, store, ISOLATED);

    expect(store.get(profileViewAtom)).toBe(committedBefore);
  });
});

describe("useProfileViewHandlers.exit (non-destructive)", () => {
  it("leaves the committed profile view and selection intact on exit", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J3);
    const committedBefore = store.get(profileViewAtom);
    const selectionBefore = store.get(selectionAtom);

    act(() => {
      handlers.exit();
    });

    expect(store.get(profileViewAtom)).toBe(committedBefore);
    expect(store.get(selectionAtom)).toEqual(selectionBefore);
    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
    expect(store.get(ephemeralStateAtom).type).toBe("none");
  });

  it("clears the staged single-anchor ephemeral state on exit without touching profile view", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);

    act(() => {
      handlers.exit();
    });

    expect(store.get(profileViewAtom)).toBeNull();
    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
    expect(store.get(ephemeralStateAtom).type).toBe("none");
  });

  it("double-click just exits the mode (commit already happened on the second click)", () => {
    const store = setInitialState({
      hydraulicModel: buildLinearModel(),
      mode: Mode.PROFILE_VIEW,
    });
    const handlers = renderHandlers({
      store,
      hydraulicModel: store.get(stagingModelDerivedAtom),
    });

    clickNode(handlers, store, IDS.J1);
    clickNode(handlers, store, IDS.J3);
    const committedBefore = store.get(profileViewAtom);

    act(() => {
      handlers.double({ preventDefault: () => {} } as never);
    });

    expect(store.get(profileViewAtom)).toBe(committedBefore);
    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });
});

const renderHandlers = ({
  store,
  hydraulicModel,
}: {
  store: Store;
  hydraulicModel: HydraulicModel;
}) => {
  const handlerContext = {
    hydraulicModel,
    map: {} as unknown,
  } as unknown as HandlerContext;

  const { result } = renderHook(() => useProfileViewHandlers(handlerContext), {
    wrapper: ({ children }) => (
      <CommandContainer store={store}>{children}</CommandContainer>
    ),
  });

  return result.current;
};
