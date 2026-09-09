import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOff } from "src/__helpers__/feature-flags";
import { Mode, modeAtom } from "src/state/mode";
import type { Panel } from "src/panels/panel";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import {
  activatePanelAtom,
  activePanelIn,
  panelsAtom,
  panelLayoutAtom,
  panelsIn,
} from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useReorderPanel } from "./reorder-panel";

const anInstance = (id: string): Panel =>
  createAssetTablePanel("junction", { id });

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const bottomIds = (store: Store) =>
  store.get(panelsIn("bottom")).map((p) => p.id);

beforeEach(() => {
  stubUserTracking();
  stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");
});

describe("useReorderPanel", () => {
  it("moves the panel to the position it was dropped on", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b"), anInstance("c")]);

    await reorder(store, "a", "c");

    expect(bottomIds(store)).toEqual(["b", "c", "a"]);
  });

  it("keeps the active panel active", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b"), anInstance("c")]);
    store.set(activatePanelAtom, "b");

    await reorder(store, "c", "a");

    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual("b");
  });

  it("does not deactivate the panel being moved", async () => {
    const store = aStore();
    store.set(panelsAtom, [createHglProfilePanel(), anInstance("a")]);
    store.set(activatePanelAtom, "hgl-profile");
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    await reorder(store, "hgl-profile", "a");

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  it("reports where the panel came from and went to", async () => {
    const userTracking = stubUserTracking();
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b"), anInstance("c")]);

    await reorder(store, "a", "c");

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "bottomPanel.tabReordered",
      panelType: "asset-table:junction:all",
      fromIndex: 0,
      toIndex: 2,
    });
  });

  it("reports indices within the dock the panel belongs to", async () => {
    const userTracking = stubUserTracking();
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b"), anInstance("c")]);
    store.set(panelLayoutAtom, { a: { movedToDock: "right" } });

    await reorder(store, "c", "b");

    expect(userTracking.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "bottomPanel.tabReordered",
        fromIndex: 1,
        toIndex: 0,
      }),
    );
  });

  it("does nothing when a panel is dropped on itself", async () => {
    const userTracking = stubUserTracking();
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);

    await reorder(store, "a", "a");

    expect(bottomIds(store)).toEqual(["a", "b"]);
    expect(userTracking.capture).not.toHaveBeenCalled();
  });

  it("does nothing when the panel it was dropped on is gone", async () => {
    const userTracking = stubUserTracking();
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);

    await reorder(store, "a", "missing");

    expect(bottomIds(store)).toEqual(["a", "b"]);
    expect(userTracking.capture).not.toHaveBeenCalled();
  });
});

const Trigger = ({
  activeId,
  overId,
}: {
  activeId: string;
  overId: string;
}) => {
  const reorderPanel = useReorderPanel();
  return (
    <button aria-label="reorder" onClick={() => reorderPanel(activeId, overId)}>
      Reorder
    </button>
  );
};

const reorder = async (store: Store, activeId: string, overId: string) => {
  render(
    <CommandContainer store={store}>
      <Trigger activeId={activeId} overId={overId} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "reorder" }));
};
