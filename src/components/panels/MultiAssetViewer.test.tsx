import { Provider as JotaiProvider, createStore } from "jotai";
import { render, screen, within } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { AssetId, HydraulicModel } from "src/hydraulic-model";
import { UIDMap } from "src/lib/id_mapper";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { Store, dataAtom, nullData } from "src/state/jotai";
import FeatureEditor from "./feature_editor";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import userEvent from "@testing-library/user-event";

describe("Multi asset viewer", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_STATS");
  });
  it("shows properties of multiple selected assets", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1", {
        status: "open",
        length: 10,
      })
      .aJunction("J1", { demand: 20 })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetIds: ["P1", "J1"],
    });

    renderComponent(store);

    expect(screen.getByText(/Selection \(2 assets\)/)).toBeInTheDocument();
    expectPropertyDisplayed("Status", "Open");
    expectPropertyDisplayed("Length (m)", "10");
    expectPropertyDisplayed("Demand (l/s)", "20");
  });

  it("shows stats when multiple values for the same property", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("P1", {
        length: 10,
      })
      .aPipe("P2", { length: 20 })
      .aPipe("P3", { length: 30 })
      .aPipe("P4", { length: 30 })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetIds: ["P1", "P2", "P3", "P4"],
    });
    const user = userEvent.setup();

    renderComponent(store);

    expectMultiValueDisplayed("Length (m)", "3 values");

    await user.click(screen.getByText(/3 values/i));

    expectMetricDisplayed("Min", "10");
    expectMetricDisplayed("Max", "30");
    expectMetricDisplayed("Mean", "22.5");
    expectMetricDisplayed("Sum", "90");

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/Values/)).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "Value row: 30" }),
    ).toHaveTextContent(/\(2\)/);

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  const setInitialState = ({
    store = createStore(),
    hydraulicModel = HydraulicModelBuilder.with().build(),
    selectedAssetIds,
  }: {
    store?: Store;
    hydraulicModel?: HydraulicModel;
    selectedAssetIds: AssetId[];
  }): Store => {
    store.set(dataAtom, {
      ...nullData,
      hydraulicModel: hydraulicModel,
      featureMapDeprecated: hydraulicModel.assets,
      selection: { type: "multi", ids: selectedAssetIds },
    });
    return store;
  };

  const renderComponent = (store: Store) => {
    const idMap = UIDMap.empty();
    render(
      <JotaiProvider store={store}>
        <PersistenceContext.Provider value={new MemPersistence(idMap, store)}>
          <FeatureEditor />
        </PersistenceContext.Provider>
      </JotaiProvider>,
    );
  };

  const expectPropertyDisplayed = (name: string, value: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`key: ${escapedName}`, "i"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`value for: ${escapedName}`, "i"),
      }),
    ).toHaveValue(value);
  };

  const expectMultiValueDisplayed = (name: string, value: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`key: ${escapedName}`, "i"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: new RegExp(`values for: ${escapedName}`, "i"),
      }),
    ).toHaveTextContent(value);
  };

  const expectMetricDisplayed = (name: string, value: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`key: ${escapedName}`, "i"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`value for\: ${escapedName}`, "i"),
      }),
    ).toHaveValue(value);
  };
});
