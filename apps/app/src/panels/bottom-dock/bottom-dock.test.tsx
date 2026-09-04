/** @vitest-environment jsdom */
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { Store } from "src/state";
import type { AssetType } from "@epanet-js/hydraulic-model";
import type { Panel } from "src/panels/panel";
import { createHglProfilePanel } from "src/panels/hgl-profile/create-panel";
import { Mode, modeAtom } from "src/state/mode";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import {
  activatePanelAtom,
  activePanelIn,
  panelsAtom,
  panelLayoutAtom,
} from "src/state/panels";
import { BottomDock } from "./bottom-dock";

const mounts: string[] = [];

vi.mock("../panel-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../panel-template")>()),
  PanelContent: ({ panel }: { panel: Panel }) => {
    useEffect(() => {
      mounts.push(panel.id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div>content for {panel.id}</div>;
  },
}));

const anInstance = (
  id: string,
  overrides: { assetType?: AssetType; closable?: boolean } = {},
): Panel => {
  const { assetType = "junction", closable } = overrides;
  return createAssetTablePanel(assetType, { id, closable });
};

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const renderTabs = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <BottomDock />
    </CommandContainer>,
  );

beforeEach(() => {
  stubUserTracking();
  mounts.length = 0;
});

describe("BottomDock", () => {
  it("shows the empty state when no panels are open", () => {
    const store = aStore();
    store.set(panelsAtom, []);

    renderTabs(store);

    expect(screen.getByText("Nothing open")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("labels panels from their type", () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe" }),
    ]);

    renderTabs(store);

    expect(screen.getByRole("tab", { name: "Junctions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pipes" })).toBeInTheDocument();
  });

  it("prefers a label override when one is set", () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a")]);
    store.set(panelLayoutAtom, { a: { renamedTo: "My working set" } });

    renderTabs(store);

    expect(
      screen.getByRole("tab", { name: "My working set" }),
    ).toBeInTheDocument();
  });

  it("allows the same asset type to be open more than once", () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);

    renderTabs(store);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("only offers a close button on closable panels", () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe", closable: false }),
    ]);

    renderTabs(store);

    expect(
      screen.getByRole("button", { name: "Close Junctions" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Close Pipes" }),
    ).not.toBeInTheDocument();
  });

  it("closes a panel from its close button", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe" }),
    ]);

    renderTabs(store);
    await userEvent.click(
      screen.getByRole("button", { name: "Close Junctions" }),
    );

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["b"]);
  });

  it("renders the active panel's content", () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);
    store.set(activatePanelAtom, "b");

    renderTabs(store);

    expect(screen.getByText("content for b")).toBeInTheDocument();
  });

  it("remounts the content when switching panels", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe" }),
    ]);

    renderTabs(store);
    await userEvent.click(screen.getByRole("tab", { name: "Pipes" }));

    expect(mounts).toEqual(["a", "b"]);
  });

  it("gives each panel of the same asset type its own content", async () => {
    const store = aStore();
    store.set(panelsAtom, [anInstance("a"), anInstance("b")]);

    renderTabs(store);
    await userEvent.click(screen.getAllByRole("tab", { name: "Junctions" })[1]);

    expect(mounts).toEqual(["a", "b"]);
  });

  it("exits HGL mode when switching away from the HGL panel", async () => {
    const store = aStore();
    store.set(panelsAtom, [createHglProfilePanel(), anInstance("a")]);
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    renderTabs(store);
    await userEvent.click(screen.getByRole("tab", { name: "Junctions" }));

    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });

  it("keeps the active panel when closing a different tab", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe" }),
      anInstance("c", { assetType: "pump" }),
    ]);
    store.set(activatePanelAtom, "a");

    renderTabs(store);
    await userEvent.click(screen.getByRole("button", { name: "Close Pumps" }));

    expect(store.get(panelsAtom).map((p) => p.id)).toEqual(["a", "b"]);
    expect(store.get(activePanelIn("bottom"))?.id).toEqual("a");
  });

  it("activates the panel whose tab was clicked", async () => {
    const store = aStore();
    store.set(panelsAtom, [
      anInstance("a"),
      anInstance("b", { assetType: "pipe" }),
    ]);

    renderTabs(store);
    await userEvent.click(screen.getByRole("tab", { name: "Pipes" }));

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("b");
  });
});
