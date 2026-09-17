/** @vitest-environment jsdom */
import { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { Store } from "src/state";
import type { Panel } from "src/panels/panel";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import {
  activatePanelAtom,
  panelsAtom,
  panelLayoutAtom,
} from "src/state/panels";
import { splitsAtom } from "src/state/layout";
import { LeftDock } from "./left-dock";

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

// A second left panel without inventing a second type: `currentDock` reads
// `movedToDock` before `initialDock`.
const aTableMovedLeft = (id: string) =>
  createAssetTablePanel("junction", { id });
const movedLeft = (id: string) => ({ [id]: { movedToDock: "left" as const } });

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const renderDock = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <LeftDock />
    </CommandContainer>,
  );

beforeEach(() => {
  stubUserTracking();
  stubFeatureOn("FLAG_ACTIVITY_BAR_SWITCHER");
  mounts.length = 0;
});

describe("LeftDock", () => {
  it("shows only the active panel content", () => {
    const store = aStore();
    store.set(panelsAtom, [createNetworkReviewPanel(), aTableMovedLeft("a")]);
    store.set(panelLayoutAtom, movedLeft("a"));

    renderDock(store);

    expect(screen.getByText("content for network-review")).toBeInTheDocument();
    expect(screen.queryByText("content for a")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("remounts the content when the panel changes", () => {
    const store = aStore();
    store.set(panelsAtom, [createNetworkReviewPanel(), aTableMovedLeft("a")]);
    store.set(panelLayoutAtom, movedLeft("a"));

    renderDock(store);
    act(() => store.set(activatePanelAtom, "a"));

    expect(screen.getByText("content for a")).toBeInTheDocument();
    expect(mounts).toEqual(["network-review", "a"]);
  });

  it("renders nothing when the dock is empty", () => {
    const store = aStore();
    store.set(panelsAtom, []);

    renderDock(store);

    expect(screen.queryByText(/^content for/)).not.toBeInTheDocument();
  });

  it("leaves the dock empty in vertical layout", () => {
    const store = aStore();
    store.set(panelsAtom, [createNetworkReviewPanel()]);
    store.set(splitsAtom, { ...store.get(splitsAtom), layout: "VERTICAL" });

    renderDock(store);

    expect(screen.queryByText(/^content for/)).not.toBeInTheDocument();
  });
});
