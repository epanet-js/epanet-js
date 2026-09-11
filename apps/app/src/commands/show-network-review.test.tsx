import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { stubFeatureOff } from "src/__helpers__/feature-flags";
import { splitsAtom } from "src/state/layout";
import { createAssetTablePanel } from "src/panels/data-tables/create-panel";
import { createNetworkReviewPanel } from "src/panels/network-review/create-panel";
import {
  activatePanelAtom,
  activePanelIn,
  panelsAtom,
  panelLayoutAtom,
} from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useShowNetworkReview } from "./show-network-review";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

const withANeighbourPanel = (store: Store) => {
  store.set(panelsAtom, [
    createNetworkReviewPanel(),
    createAssetTablePanel("junction", { id: "neighbour" }),
  ]);
  store.set(panelLayoutAtom, { neighbour: { movedToDock: "left" } });
};

beforeEach(() => {
  stubUserTracking();
  stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");
});

describe("useShowNetworkReview", () => {
  it("opens the left panel when it is closed", async () => {
    const store = aStore();
    store.set(panelsAtom, [createNetworkReviewPanel()]);
    store.set(splitsAtom, (s) => ({ ...s, leftOpen: false }));

    await show(store);

    expect(store.get(splitsAtom).leftOpen).toBe(true);
  });

  it("brings the network review forward when another panel is active", async () => {
    const store = aStore();
    withANeighbourPanel(store);
    store.set(activatePanelAtom, "neighbour");

    await show(store);

    expect(store.get(activePanelIn("left"))?.id).toEqual("network-review");
  });

  it("leaves the left panel open when it already is", async () => {
    const store = aStore();
    withANeighbourPanel(store);
    store.set(splitsAtom, (s) => ({ ...s, leftOpen: true }));

    await show(store);

    expect(store.get(splitsAtom).leftOpen).toBe(true);
    expect(store.get(activePanelIn("left"))?.id).toEqual("network-review");
  });
});

const Trigger = () => {
  const showNetworkReview = useShowNetworkReview();
  return (
    <button
      aria-label="show"
      onClick={() => showNetworkReview({ source: "auto" })}
    >
      Show
    </button>
  );
};

const show = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "show" }));
};
