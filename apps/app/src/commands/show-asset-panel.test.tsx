import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "@epanet-js/hydraulic-model-testing";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { splitsAtom } from "src/state/layout";
import { createAssetPanel } from "src/panels/asset-panel/create-panel";
import { createMapStylingPanel } from "src/panels/map-styling-editor/create-panel";
import { panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useShowAssetPanel } from "./show-asset-panel";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

beforeEach(() => {
  stubUserTracking();
});

describe("useShowAssetPanel", () => {
  it("opens the side bar holding the asset panel", async () => {
    const store = aStore();
    store.set(panelsAtom, [createAssetPanel(), createMapStylingPanel()]);
    store.set(splitsAtom, { ...store.get(splitsAtom), rightOpen: false });

    await show(store);

    expect(store.get(splitsAtom).rightOpen).toBe(true);
  });
});

const Trigger = () => {
  const showAssetPanel = useShowAssetPanel();
  return (
    <button
      aria-label="show"
      onClick={() => showAssetPanel({ source: "draw" })}
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
