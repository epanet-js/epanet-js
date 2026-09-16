import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import type { CollectionDraft } from "src/lib/collections";
import { createCollectionsPanel } from "src/panels/collections/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import { Store } from "src/state";
import { pendingCollectionDraftAtom } from "src/state/collections";
import { splitsAtom } from "src/state/layout";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
import { useStartCollectionDraft } from "./collection-draft";

const aStore = () => {
  const store = setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });
  store.set(panelsAtom, [createNetworkReviewPanel(), createCollectionsPanel()]);
  return store;
};

const Trigger = ({ draft }: { draft: CollectionDraft }) => {
  const startCollectionDraft = useStartCollectionDraft();
  return (
    <button aria-label="start" onClick={() => startCollectionDraft(draft)}>
      Start
    </button>
  );
};

const start = async (store: Store, draft: CollectionDraft) => {
  render(
    <CommandContainer store={store}>
      <Trigger draft={draft} />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "start" }));
};

beforeEach(() => {
  stubUserTracking();
});

describe("useStartCollectionDraft", () => {
  it("opens the left panel on the collections tab", async () => {
    const store = aStore();
    store.set(splitsAtom, (splits) => ({ ...splits, leftOpen: false }));
    store.set(activatePanelAtom, "network-review");

    await start(store, { kind: "selectionSets", source: "context-menu" });

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("collections");
  });

  it("keeps the panel width when the left panel is already open", async () => {
    const store = aStore();
    store.set(splitsAtom, (splits) => ({
      ...splits,
      leftOpen: true,
      left: 555,
    }));

    await start(store, { kind: "bookmarks", source: "collections-heading" });

    expect(store.get(splitsAtom).left).toEqual(555);
  });

  it("hands the panel the kind and source of the draft", async () => {
    const store = aStore();

    await start(store, { kind: "bookmarks", source: "collections-add-row" });

    expect(store.get(pendingCollectionDraftAtom)).toEqual({
      kind: "bookmarks",
      source: "collections-add-row",
    });
  });
});
