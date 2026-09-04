import { createStore } from "jotai";
import type { AssetType } from "@epanet-js/hydraulic-model";
import { splitsAtom } from "src/state/layout";
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

    expect(store.get(placedPanelsAtom)[0].dock).toEqual("bottom");
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

    expect(store.get(panelsByDockAtom).bottom).toEqual([]);
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

    expect(currentDock(panel, "right", "vertical")).toEqual("bottom");
  });

  it("has no dock when unavailable in vertical layout", () => {
    const panel = { ...aPanel("a"), availableInVerticalLayout: false };

    expect(currentDock(panel, undefined, "vertical")).toBeUndefined();
  });
});
