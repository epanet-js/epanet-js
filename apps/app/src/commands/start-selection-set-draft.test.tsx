import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { createCollectionsPanel } from "src/panels/collections/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { Store } from "src/state";
import { pendingCollectionDraftAtom } from "src/state/collections";
import { splitsAtom } from "src/state/layout";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
import { useStartSelectionSetDraft } from "./selection-sets";

const aStore = () => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createNetworkReviewPanel(), createCollectionsPanel()]);
  return store;
};

const Trigger = () => {
  const startSelectionSetDraft = useStartSelectionSetDraft();
  return (
    <button
      aria-label="start"
      onClick={() => startSelectionSetDraft({ source: "context-menu" })}
    >
      Start
    </button>
  );
};

const start = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "start" }));
};

beforeEach(() => {
  stubUserTracking();
});

describe("useStartSelectionSetDraft", () => {
  it("opens the left panel on the collections tab", async () => {
    const store = aStore();
    store.set(splitsAtom, (splits) => ({ ...splits, leftOpen: false }));
    store.set(activatePanelAtom, "network-review");

    await start(store);

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("collections");
  });

  it("asks the panel for a selection set draft", async () => {
    const store = aStore();

    await start(store);

    expect(store.get(pendingCollectionDraftAtom)).toEqual("selectionSets");
  });
});
