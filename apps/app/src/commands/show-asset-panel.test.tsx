import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { TabOption, tabAtom } from "src/state/layout";
import { createAssetPanel } from "src/panels/asset-panel/create-panel";
import { createMapStylingPanel } from "src/panels/map-styling-editor/create-panel";
import { activatePanelAtom, activePanelIn, panelsAtom } from "src/state/panels";
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
  it("brings the asset panel forward over the map styling", async () => {
    const store = aStore();
    store.set(panelsAtom, [createAssetPanel(), createMapStylingPanel()]);
    store.set(activatePanelAtom, "map-styling");

    await show(store);

    expect(store.get(activePanelIn("right"))?.id).toEqual("asset");
  });

  it("switches the legacy tab when the asset panel is not registered", async () => {
    const store = aStore();
    store.set(panelsAtom, []);
    store.set(tabAtom, TabOption.Map);

    await show(store);

    expect(store.get(tabAtom)).toEqual(TabOption.Asset);
  });
});

const Trigger = () => {
  const showAssetPanel = useShowAssetPanel();
  return (
    <button aria-label="show" onClick={showAssetPanel}>
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
