/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { Store } from "src/state";
import type { Panel } from "src/panels/panel";
import { createAssetPanel } from "src/panels/asset-panel/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { isNarrowViewportAtom } from "src/state/layout";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { VerticalDock } from "./vertical-dock";

vi.mock("../panel-template", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../panel-template")>()),
  PanelContent: ({ panel }: { panel: Panel }) => (
    <div>content for {panel.id}</div>
  ),
}));

const aNarrowStore = (panels: Panel[]) => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, panels);
  store.set(isNarrowViewportAtom, true);
  return store;
};

const renderDock = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <VerticalDock />
    </CommandContainer>,
  );

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);

beforeEach(() => {
  stubUserTracking();
});

describe("VerticalDock", () => {
  it("shows the empty state when nothing is available", () => {
    const store = aNarrowStore([]);

    renderDock(store);

    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("gathers the available panels into one tab strip, right side first", () => {
    const store = aNarrowStore([
      createNetworkReviewPanel(),
      createAssetTablePanel("junction", { id: "a-table" }),
      createAssetPanel(),
    ]);

    renderDock(store);

    expect(tabNames()).toEqual(["Asset", "Network Review", "Junctions"]);
    expect(screen.getByText("content for asset")).toBeInTheDocument();
  });

  it("shows only the active panel's content", async () => {
    const store = aNarrowStore([
      createAssetPanel(),
      createAssetTablePanel("junction", { id: "a-table" }),
    ]);

    renderDock(store);
    expect(screen.getByText("content for asset")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("tab")[1]);

    expect(screen.getByText("content for a-table")).toBeInTheDocument();
    expect(screen.queryByText("content for asset")).not.toBeInTheDocument();
    expect(store.get(activePanelIn("vertical"))?.id).toEqual("a-table");
  });
});
