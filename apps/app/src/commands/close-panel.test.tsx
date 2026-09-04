import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { hglProfileAtom } from "src/state/hgl-profile";
import { ephemeralStateAtom } from "src/state/drawing";
import { Mode, modeAtom } from "src/state/mode";
import { splitsAtom } from "src/state/layout";
import type { Panel } from "src/panels/panel";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import {
  activatePanelAtom,
  activePanelIn,
  panelsAtom,
  panelLayoutAtom,
} from "src/state/panels";
import { panelContentStateAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useClosePanel } from "./close-panel";

const anInstance = (id: string): Panel =>
  createAssetTablePanel("junction", { id });

const hglPanel = (): Panel => createHglProfilePanel();

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

beforeEach(() => {
  stubUserTracking();
});

describe("useClosePanel", () => {
  it("removes the instance from the registry", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);

    await close(store, "a");

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["b"]);
  });

  it("activates the right neighbour when closing the active panel", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b"), anInstance("c")]);
    store.set(activatePanelAtom, "b");

    await close(store, "b");

    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual("c");
  });

  it("falls back to the left neighbour when closing the last panel", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);
    store.set(activatePanelAtom, "b");

    await close(store, "b");

    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual("a");
  });

  it("keeps the active panel when closing a different one", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);
    store.set(activatePanelAtom, "a");

    await close(store, "b");

    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual("a");
  });

  it("keeps the bottom zone open when the last panel closes", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a")]);
    store.set(splitsAtom, (s) => ({ ...s, bottomOpen: true }));

    await close(store, "a");

    expect(store.get(panelsAtom)).toEqual([]);
    expect(store.get(splitsAtom).bottomOpen).toBe(true);
    expect(store.get(activePanelIn("bottom"))?.id ?? null).toBeNull();
  });

  it("refuses to close a panel that is not closable", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      createAssetTablePanel("junction", { id: "junction", closable: false }),
    ]);

    await close(store, "junction");

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["junction"]);
  });

  it("forgets everything stored against the panel id", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);
    store.set(panelLayoutAtom, {
      a: { movedToDock: "bottom", renamedTo: "Mine" },
      b: { renamedTo: "Theirs" },
    });
    store.set(panelContentStateAtom, {
      a: { scrollTop: 120 },
      b: { scrollTop: 40 },
    });

    await close(store, "a");

    expect(store.get(panelLayoutAtom)).toEqual({ b: { renamedTo: "Theirs" } });
    expect(store.get(panelContentStateAtom)).toEqual({ b: { scrollTop: 40 } });
  });

  it("can close a panel that is not in the bottom dock", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);
    store.set(panelLayoutAtom, { a: { movedToDock: "right" } });

    await close(store, "a");

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["b"]);
  });

  it("leaves an unrelated in-progress draft alone", async () => {
    const store = aStore();
    store.set(panelsAtom, [hglPanel()]);
    store.set(ephemeralStateAtom, {
      type: "drawLink",
      startNodeId: 1,
    } as never);

    await close(store, "hgl-profile");

    expect(store.get(ephemeralStateAtom)).toMatchObject({ type: "drawLink" });
  });

  it("removes the HGL panel like any other", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), hglPanel()]);

    await close(store, "hgl-profile");

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["a"]);
  });

  it("deactivates and discards the panel's content when closed", async () => {
    const store = aStore();
    store.set(panelsAtom, [hglPanel()]);
    store.set(hglProfileAtom, {
      id: "p1",
      anchors: [1, 2],
      terrain: null,
      isUnprojected: false,
    });
    store.set(ephemeralStateAtom, { type: "hglProfile" });
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    await close(store, "hgl-profile");

    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
    expect(store.get(hglProfileAtom)).toBeNull();
    expect(store.get(ephemeralStateAtom)).toEqual({ type: "none" });
  });

  it("leaves other panels' content alone", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), hglPanel()]);
    store.set(hglProfileAtom, {
      id: "p1",
      anchors: [1, 2],
      terrain: null,
      isUnprojected: false,
    });

    await close(store, "a");

    expect(store.get(hglProfileAtom)).not.toBeNull();
  });
});

const Trigger = ({ panelId }: { panelId: string }) => {
  const closePanel = useClosePanel();
  return (
    <button aria-label="close" onClick={() => closePanel(panelId)}>
      Close
    </button>
  );
};

const close = async (store: Store, panelId: string) => {
  render(
    <CommandContainer store={store}>
      <Trigger panelId={panelId} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "close" }));
};
