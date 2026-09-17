import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { splitsAtom } from "src/state/layout";
import { createCollectionsPanel } from "src/panels/collections/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useToggleLeftPanelTab } from "./toggle-left-panel-tab";

const aStore = ({ leftOpen }: { leftOpen: boolean }) => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createNetworkReviewPanel(), createCollectionsPanel()]);
  store.set(splitsAtom, (s) => ({ ...s, leftOpen }));
  return store;
};

beforeEach(() => {
  stubUserTracking();
});

describe("useToggleLeftPanelTab", () => {
  it("collapses the dock when its active tab is pressed", async () => {
    const store = aStore({ leftOpen: true });
    store.set(activatePanelAtom, "network-review");

    await press(store, "network-review");

    expect(store.get(splitsAtom).leftOpen).toBe(false);
  });

  it("switches panels without collapsing when another tab is pressed", async () => {
    const store = aStore({ leftOpen: true });
    store.set(activatePanelAtom, "network-review");

    await press(store, "collections");

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("collections");
  });

  it("expands the dock onto the pressed tab when collapsed", async () => {
    const store = aStore({ leftOpen: false });
    store.set(activatePanelAtom, "network-review");

    await press(store, "collections");

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("collections");
  });

  it("expands the dock when the collapsed active tab is pressed", async () => {
    const store = aStore({ leftOpen: false });
    store.set(activatePanelAtom, "network-review");

    await press(store, "network-review");

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("network-review");
  });
});

const Trigger = ({ panelId }: { panelId: string }) => {
  const toggleTab = useToggleLeftPanelTab();
  return (
    <button aria-label="press" onClick={() => toggleTab(panelId)}>
      Press
    </button>
  );
};

const press = async (store: Store, panelId: string) => {
  render(
    <CommandContainer store={store}>
      <Trigger panelId={panelId} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "press" }));
};
