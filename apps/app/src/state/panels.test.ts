import { createStore } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
import { isNarrowViewportAtom, splitsAtom } from "src/state/layout";
import type { Panel } from "src/panels/panel";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import {
  activatePanelAtom,
  activePanelIn,
  activePanelsAtom,
  placedPanelsAtom,
  currentDock,
  panelLayoutAtom,
  panelsAtom,
  panelsByDockAtom,
  panelsIn,
  reorderPanelAtom,
} from "./panels";

const aPanel = (
  id: string,
  overrides: { assetType?: AssetType; closable?: boolean } = {},
): Panel => {
  const { assetType = "junction", closable } = overrides;
  return createAssetTablePanel(assetType, { id, closable });
};

describe("placedPanelsAtom", () => {
  it("keeps panels in open order", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);

    expect(store.get(placedPanelsAtom).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("resolves closable and the current dock from the panel itself", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b", { closable: false })]);

    const [first, second] = store.get(placedPanelsAtom);
    expect(first.closable).toBe(true);
    expect(second.closable).toBe(false);
    expect(first.panel.initialDock).toEqual("bottom");
  });

  it("reports the current dock, resolving preference and moves", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(panelLayoutAtom, {
      b: { movedToDock: "right", renamedTo: "Mine" },
    });

    const byId = new Map(store.get(placedPanelsAtom).map((p) => [p.id, p]));
    expect(byId.get("a")?.dock).toEqual("bottom");
    expect(byId.get("b")?.dock).toEqual("right");
    expect(byId.get("b")?.renamedTo).toEqual("Mine");
  });

  it("has no current dock when the panel is unavailable in vertical layout", () => {
    const store = createStore();
    store.set(panelsAtom, [
      { ...aPanel("a"), availableInVerticalLayout: false },
    ]);
    store.set(splitsAtom, (s) => ({ ...s, layout: "VERTICAL" }));

    expect(store.get(placedPanelsAtom)[0].dock).toBeUndefined();
  });

  it("ignores a horizontal move once the layout turns vertical", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a")]);
    store.set(panelLayoutAtom, { a: { movedToDock: "right" } });
    store.set(splitsAtom, (s) => ({ ...s, layout: "VERTICAL" }));

    expect(store.get(placedPanelsAtom)[0].dock).toEqual("vertical");
  });
});

describe("panelsByDockAtom", () => {
  it("groups panels by their effective dock", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(panelLayoutAtom, { b: { movedToDock: "right" } });

    const byDock = store.get(panelsByDockAtom);
    expect(byDock.bottom.map((p) => p.id)).toEqual(["a"]);
    expect(byDock.right.map((p) => p.id)).toEqual(["b"]);
    expect(byDock.left).toEqual([]);
  });

  it("drops panels that are unavailable in the current layout", () => {
    const store = createStore();
    store.set(panelsAtom, [
      { ...aPanel("a"), availableInVerticalLayout: false },
    ]);
    store.set(splitsAtom, (s) => ({ ...s, layout: "VERTICAL" }));

    expect(store.get(panelsByDockAtom).vertical).toEqual([]);
  });
});

describe("reorderPanelAtom", () => {
  const bottomIds = (store: ReturnType<typeof createStore>) =>
    store.get(panelsIn("bottom")).map((p) => p.id);

  const reorder = (
    store: ReturnType<typeof createStore>,
    activeId: string,
    overId: string,
  ) => store.set(reorderPanelAtom, { dock: "bottom", activeId, overId });

  it("moves a panel forward", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);

    reorder(store, "a", "c");

    expect(bottomIds(store)).toEqual(["b", "c", "a"]);
  });

  it("moves a panel backward", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);

    reorder(store, "c", "a");

    expect(bottomIds(store)).toEqual(["c", "a", "b"]);
  });

  it("leaves the open order alone", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);

    reorder(store, "c", "a");

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("appends a panel opened after a reorder", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);
    reorder(store, "c", "a");

    store.set(panelsAtom, (prev) => [...prev, aPanel("d")]);

    expect(bottomIds(store)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps panels that were never dragged in open order", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);
    store.set(panelsAtom, (prev) => [...prev, aPanel("d"), aPanel("e")]);

    reorder(store, "a", "b");

    expect(bottomIds(store)).toEqual(["b", "a", "c", "d", "e"]);
  });

  it("does not change which panel is active", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);
    store.set(activatePanelAtom, "b");

    reorder(store, "c", "a");

    expect(store.get(activePanelIn("bottom"))?.id ?? null).toEqual("b");
  });

  it("leaves panels in other docks untouched", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);
    store.set(panelLayoutAtom, { b: { movedToDock: "right" } });

    reorder(store, "a", "c");

    expect(bottomIds(store)).toEqual(["c", "a"]);
    expect(store.get(panelsIn("right")).map((p) => p.id)).toEqual(["b"]);
  });

  it("ignores an order left behind by a closed panel", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b"), aPanel("c")]);
    reorder(store, "c", "a");

    store.set(panelsAtom, (prev) => prev.filter((p) => p.id !== "a"));

    expect(bottomIds(store)).toEqual(["c", "b"]);
  });

  it("does nothing when a panel is dropped on itself", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);

    reorder(store, "a", "a");

    expect(bottomIds(store)).toEqual(["a", "b"]);
  });

  it("does nothing when either panel is not in the dock", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);

    reorder(store, "a", "missing");

    expect(bottomIds(store)).toEqual(["a", "b"]);
  });
});

describe("activePanelsAtom", () => {
  it("uses the selected panel when it is still in the dock", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(activatePanelAtom, "b");

    expect(store.get(activePanelsAtom).bottom?.id ?? null).toEqual("b");
  });

  it("falls back to the dock's first panel when the selection is gone", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a")]);
    store.set(activatePanelAtom, "removed");

    expect(store.get(activePanelsAtom).bottom?.id ?? null).toEqual("a");
  });

  it("is null only when the dock is empty", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a")]);

    const active = store.get(activePanelsAtom);
    expect(active.bottom?.id).toEqual("a");
    expect(active.right).toBeNull();
    expect(active.left).toBeNull();
  });

  it("ignores a panel that does not exist", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a")]);

    store.set(activatePanelAtom, "nope");

    expect(store.get(activePanelsAtom).bottom?.id).toEqual("a");
  });

  it("selects a panel into the dock it actually occupies", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(panelLayoutAtom, { b: { movedToDock: "right" } });

    store.set(activatePanelAtom, "b");

    const active = store.get(activePanelsAtom);
    expect(active.right?.id).toEqual("b");
    expect(active.bottom?.id).toEqual("a");
  });

  it("tracks each dock independently", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(panelLayoutAtom, { b: { movedToDock: "right" } });
    store.set(activatePanelAtom, "b");

    const active = store.get(activePanelsAtom);
    expect(active.bottom?.id).toEqual("a");
    expect(active.right?.id).toEqual("b");
  });
});

describe("per-dock selectors", () => {
  it("narrows panels and the active id to one dock", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanel("a"), aPanel("b")]);
    store.set(panelLayoutAtom, { b: { movedToDock: "right" } });

    expect(store.get(panelsIn("bottom")).map((p) => p.id)).toEqual(["a"]);
    expect(store.get(activePanelIn("bottom"))?.id).toEqual("a");
    expect(store.get(activePanelIn("right"))?.id).toEqual("b");
  });

  it("returns the same atom for a dock on every call", () => {
    expect(activePanelIn("bottom")).toBe(activePanelIn("bottom"));
    expect(panelsIn("bottom")).toBe(panelsIn("bottom"));
  });
});

describe("currentDock", () => {
  it("prefers where the user moved the panel in horizontal layout", () => {
    expect(currentDock(aPanel("a"), "right", "horizontal")).toEqual("right");
  });

  it("falls back to where the panel opens", () => {
    const panel = { ...aPanel("a"), initialDock: "left" as const };

    expect(currentDock(panel, undefined, "horizontal")).toEqual("left");
  });

  it("puts every available panel in the one vertical dock", () => {
    const panel = { ...aPanel("a"), initialDock: "left" as const };

    expect(currentDock(panel, "right", "vertical")).toEqual("vertical");
  });

  it("has no dock when unavailable in vertical layout", () => {
    const panel = { ...aPanel("a"), availableInVerticalLayout: false };

    expect(currentDock(panel, undefined, "vertical")).toBeUndefined();
  });
});

describe("the vertical dock", () => {
  const aPanelIn = (id: string, dock: "left" | "right" | "bottom"): Panel => ({
    ...aPanel(id),
    initialDock: dock,
  });

  const aNarrowStore = (panels: Panel[]) => {
    const store = createStore();
    store.set(panelsAtom, panels);
    store.set(isNarrowViewportAtom, true);
    return store;
  };

  const verticalIds = (store: ReturnType<typeof createStore>) =>
    store.get(panelsIn("vertical")).map((entry) => entry.id);

  it("collects the panels once the viewport turns narrow", () => {
    const store = aNarrowStore([aPanelIn("a", "right")]);

    expect(verticalIds(store)).toEqual(["a"]);
    expect(store.get(panelsIn("right"))).toEqual([]);
  });

  it("keeps the horizontal docks while the viewport is wide", () => {
    const store = createStore();
    store.set(panelsAtom, [aPanelIn("a", "right")]);

    expect(store.get(panelsIn("vertical"))).toEqual([]);
    expect(store.get(panelsIn("right")).map((entry) => entry.id)).toEqual([
      "a",
    ]);
  });

  it("orders panels by side: right, then left, then bottom", () => {
    const store = aNarrowStore([
      aPanelIn("from-bottom", "bottom"),
      aPanelIn("from-left", "left"),
      aPanelIn("from-right", "right"),
    ]);

    expect(verticalIds(store)).toEqual([
      "from-right",
      "from-left",
      "from-bottom",
    ]);
  });

  it("keeps open order within a side", () => {
    const store = aNarrowStore([
      aPanelIn("first-right", "right"),
      aPanelIn("from-left", "left"),
      aPanelIn("second-right", "right"),
    ]);

    expect(verticalIds(store)).toEqual([
      "first-right",
      "second-right",
      "from-left",
    ]);
  });

  it("orders by where the user moved a panel, not where it opened", () => {
    const store = aNarrowStore([
      aPanelIn("from-right", "right"),
      aPanelIn("moved-to-right", "bottom"),
    ]);
    store.set(panelLayoutAtom, { "moved-to-right": { movedToDock: "right" } });

    expect(verticalIds(store)).toEqual(["from-right", "moved-to-right"]);
  });

  it("activates the leading panel of the highest-priority side", () => {
    const store = aNarrowStore([
      aPanelIn("from-bottom", "bottom"),
      aPanelIn("from-right", "right"),
    ]);

    expect(store.get(activePanelIn("vertical"))?.id).toEqual("from-right");
  });

  it("holds a single active panel across the collected sides", () => {
    const store = aNarrowStore([
      aPanelIn("from-right", "right"),
      aPanelIn("from-left", "left"),
    ]);
    store.set(activatePanelAtom, "from-left");

    expect(store.get(activePanelIn("vertical"))?.id).toEqual("from-left");
    expect(store.get(activePanelsAtom).right).toBeNull();
    expect(store.get(activePanelsAtom).left).toBeNull();
  });

  it("lets a user reorder override the side order", () => {
    const store = aNarrowStore([
      aPanelIn("from-right", "right"),
      aPanelIn("from-bottom", "bottom"),
    ]);
    store.set(reorderPanelAtom, {
      dock: "vertical",
      activeId: "from-bottom",
      overId: "from-right",
    });

    expect(verticalIds(store)).toEqual(["from-bottom", "from-right"]);
  });

  it("leaves out panels that are unavailable in vertical layout", () => {
    const store = aNarrowStore([
      { ...aPanelIn("a", "right"), availableInVerticalLayout: false },
      aPanelIn("b", "bottom"),
    ]);

    expect(verticalIds(store)).toEqual(["b"]);
  });
});
