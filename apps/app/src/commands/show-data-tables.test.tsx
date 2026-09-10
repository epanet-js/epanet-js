import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOff, stubFeatureOn } from "src/__helpers__/feature-flags";
import { setInitialState } from "src/__helpers__/state";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { Store } from "src/state";
import { dialogAtom } from "src/state/dialog";
import { splitsAtom } from "src/state/layout";
import { defaultDataTables } from "src/panels/use-default-panels";
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
  it("opens the bottom dock while the flag is off", async () => {
    const store = aStore();

    await show(store);

    expect(store.get(splitsAtom).bottomOpen).toBe(true);
  });

  it("focuses the junctions table while the flag is off", async () => {
    const store = aStore();
    // The dock is seeded by the model-load path, not by the atom itself.
    store.set(panelsAtom, defaultDataTables());

    await show(store);

    expect(store.get(activePanelIn("bottom"))?.id).toEqual("junction");
  });

  it("asks which tables to open once the flag is on", async () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");
    const store = aStore();

    await show(store);

    expect(store.get(dialogAtom)).toEqual({ type: "openDataTables" });
  });

  it("leaves the dock alone until tables are picked", async () => {
    stubFeatureOn("FLAG_PARTIAL_DATA_TABLES");
    const store = aStore();
    store.set(splitsAtom, { ...store.get(splitsAtom), bottomOpen: false });

    await show(store);

    expect(store.get(splitsAtom).bottomOpen).toBe(false);
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
