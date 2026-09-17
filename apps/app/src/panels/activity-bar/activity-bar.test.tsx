/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import "src/__helpers__/locale";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { Store } from "src/state";
import { createCollectionsPanel } from "src/panels/collections/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { activePanelIn, panelsAtom, panelLayoutAtom } from "src/state/panels";
import { splitsAtom } from "src/state/layout";
import { ActivityBar } from "./activity-bar";

const aStore = ({ leftOpen = true }: { leftOpen?: boolean } = {}) => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createNetworkReviewPanel(), createCollectionsPanel()]);
  store.set(splitsAtom, (s) => ({ ...s, leftOpen }));
  return store;
};

const renderBar = (store: Store) =>
  render(
    <CommandContainer store={store}>
      <TooltipProvider>
        <ActivityBar />
      </TooltipProvider>
    </CommandContainer>,
  );

const selectedTabs = () =>
  screen
    .getAllByRole("tab")
    .filter((tab) => tab.getAttribute("aria-selected") === "true")
    .map((tab) => tab.getAttribute("aria-label"));

beforeEach(() => {
  stubUserTracking();
  stubFeatureOn("FLAG_ACTIVITY_BAR_SWITCHER");
});

describe("ActivityBar", () => {
  it("is hidden while the left dock holds a single panel", () => {
    const store = aStore();
    store.set(panelsAtom, [createNetworkReviewPanel()]);

    renderBar(store);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("names each tab after its panel, preferring a rename", () => {
    const store = aStore();
    store.set(panelLayoutAtom, {
      "network-review": { renamedTo: "My review" },
    });

    renderBar(store);

    expect(screen.getByRole("tab", { name: "My review" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Collections" }),
    ).toBeInTheDocument();
  });

  it("marks the active panel while the dock is open", () => {
    renderBar(aStore());

    expect(selectedTabs()).toEqual(["Network Review"]);
  });

  it("marks no panel while the dock is collapsed", () => {
    renderBar(aStore({ leftOpen: false }));

    expect(selectedTabs()).toEqual([]);
  });

  it("collapses the dock when the active tab is clicked", async () => {
    const store = aStore();

    renderBar(store);
    await userEvent.click(screen.getByRole("tab", { name: "Network Review" }));

    expect(store.get(splitsAtom).leftOpen).toBe(false);
    expect(selectedTabs()).toEqual([]);
  });

  it("switches to another clicked tab without collapsing", async () => {
    const store = aStore();

    renderBar(store);
    await userEvent.click(screen.getByRole("tab", { name: "Collections" }));

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("collections");
  });

  it("collapses the dock when Enter is pressed on the active tab", async () => {
    const store = aStore();

    renderBar(store);
    screen.getByRole("tab", { name: "Network Review" }).focus();
    await userEvent.keyboard("{Enter}");

    expect(store.get(splitsAtom).leftOpen).toBe(false);
  });

  it("expands the dock onto a tab clicked while collapsed", async () => {
    const store = aStore({ leftOpen: false });

    renderBar(store);
    await userEvent.click(screen.getByRole("tab", { name: "Collections" }));

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(selectedTabs()).toEqual(["Collections"]);
  });
});
