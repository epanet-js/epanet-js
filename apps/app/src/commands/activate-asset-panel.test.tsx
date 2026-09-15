import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { splitsAtom } from "src/state/layout";
import { createAssetPanel } from "src/panels/asset-panel/create-panel";
import { createMapStylingPanel } from "src/panels/map-styling-editor/create-panel";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
import { Store } from "src/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useActivateAssetPanel } from "./activate-asset-panel";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

beforeEach(() => {
  stubUserTracking();
});

describe("useActivateAssetPanel", () => {
  it("brings the asset panel forward over the map styling", async () => {
    const store = aStore();
    store.set(panelsAtom, [createAssetPanel(), createMapStylingPanel()]);
    store.set(activatePanelAtom, "map-styling");

    await activate(store);

    expect(store.get(activePanelIn("right"))?.id).toEqual("asset");
  });

  it("leaves a closed side bar closed", async () => {
    const store = aStore();
    store.set(panelsAtom, [createAssetPanel(), createMapStylingPanel()]);
    store.set(splitsAtom, { ...store.get(splitsAtom), rightOpen: false });

    await activate(store);

    expect(store.get(splitsAtom).rightOpen).toBe(false);
  });
});

const Trigger = () => {
  const activateAssetPanel = useActivateAssetPanel();
  return (
    <button aria-label="activate" onClick={activateAssetPanel}>
      Activate
    </button>
  );
};

const activate = async (store: Store) => {
  render(
    <CommandContainer store={store}>
      <Trigger />
    </CommandContainer>,
  );
  await userEvent.click(screen.getByRole("button", { name: "activate" }));
};
