import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { Store } from "src/state";
import { splitsAtom } from "src/state/layout";
import { activePanelIn, panelsAtom } from "src/state/panels";
import { CommandContainer } from "./__helpers__/command-container";
import { useShowDataTables } from "./show-data-tables";

const aStore = () =>
  setInitialState({
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  });

beforeEach(() => {
  stubUserTracking();
  stubFeatureOff("FLAG_PARTIAL_DATA_TABLES");
});

describe("useShowDataTables", () => {
  it("opens the bottom dock", async () => {
    const store = aStore();

    await show(store);

    expect(store.get(splitsAtom).bottomOpen).toBe(true);
  });

  it("focuses the junctions table while the flag is off", async () => {
    const store = aStore();

    await show(store);

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("junction");
  });

  it("opens the picker instead once the flag is on", async () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");
    const store = aStore();

    await show(store);

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("table-picker");
  });

  it("focuses the picker it already opened rather than adding another", async () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");
    const store = aStore();

    await show(store);
    await show(store);

    const pickers = store
      .get(panelsAtom)
      .filter((panel) => panel.type === "table-picker");
    expect(pickers).toHaveLength(1);
  });
});

const Trigger = () => {
  const showDataTables = useShowDataTables();
  return (
    <button
      aria-label="show"
      onClick={() => showDataTables({ source: "toolbar" })}
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
  await userEvent.click(screen.getAllByRole("button", { name: "show" })[0]);
};
