import { render, screen } from "@testing-library/react";
import { Store, dataAtom, nullData } from "src/state/jotai";
import { Provider as JotaiProvider, createStore } from "jotai";
import { HydraulicModel, Pipe } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { UIDMap } from "src/lib/id_mapper";
import userEvent from "@testing-library/user-event";
import { AssetId, getPipe } from "src/hydraulic-model/assets-map";
import FeatureEditor from "./feature_editor";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("AssetEditor", () => {
  describe("with a pipe", () => {
    it("can show its properties", () => {
      const pipeId = "P1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, {
          status: "open",
          length: 10,
          diameter: 100.1,
          roughness: 1,
          minorLoss: 0.1,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });

      renderComponent(store);

      expect(screen.getByText(/pipe/i)).toBeInTheDocument();

      expectStatusDisplayed("Open");
      expectPropertyDisplayed("diameter (mm)", "100");
      expectPropertyDisplayed("roughness", "1.00");
      expectPropertyDisplayed("length", "10.00");
      expectPropertyDisplayed("loss coeff", "0.100");
      expectPropertyDisplayed("flow", "Not available");
    });

    it("can show simulation results", () => {
      const pipeId = "P1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { simulation: { flow: 20 } })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });

      renderComponent(store);

      expectPropertyDisplayed("flow (l/s)", "20.0");
    });
  });

  describe("with a junction", () => {
    it("shows its properties", () => {
      const junctionId = "J1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(junctionId, {
          elevation: 10,
          demand: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: junctionId,
      });

      renderComponent(store);

      expect(screen.getByText(/junction/i)).toBeInTheDocument();

      expectPropertyDisplayed("elevation (m)", "10.0");
      expectPropertyDisplayed("demand (l/s)", "100");
      expectPropertyDisplayed("pressure (m)", "Not available");
    });

    it("can show simulation results", () => {
      const junctionId = "J1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(junctionId, {
          elevation: 10,
          demand: 100,
          simulation: { pressure: 20 },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: junctionId,
      });

      renderComponent(store);

      expectPropertyDisplayed("pressure (m)", "20.0");
    });
  });

  describe("with a reservoir", () => {
    it("shows its properties", () => {
      const reservoirId = "R1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(reservoirId, {
          elevation: 10,
          head: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: reservoirId,
      });

      renderComponent(store);

      expect(screen.getByText(/reservoir/i)).toBeInTheDocument();

      expectPropertyDisplayed("elevation (m)", "10.0");
      expectPropertyDisplayed("head (m)", "100");
    });
  });

  it("can change its status", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "open" })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const selector = screen.getByRole("combobox", {
      name: /value for: status/i,
    });

    await user.click(selector);

    await user.click(screen.getByText(/closed/i));

    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(
      (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).status,
    ).toEqual("closed");

    expect(selector).not.toHaveFocus();
    expect(selector).toHaveTextContent("Closed");
  });

  it("can change a property", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { diameter: 10.4 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: diameter/i,
    });
    await user.click(field);
    expect(field).toHaveValue("10.4");
    await user.clear(field);
    await user.type(field, "20.5");
    await user.keyboard("{Enter}");

    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(
      (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).diameter,
    ).toEqual(20.5);

    expect(field).toHaveValue("20.5");
    expect(field).not.toHaveFocus();
  });

  it("cannot change simulation results", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { simulation: { flow: 10 } })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: flow/i,
    });
    await user.click(field);
    expect(field).toHaveValue("10.0");
    expect(field).toHaveAttribute("readonly");
  });

  it("clears group formatting when focusing input", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { length: 10000 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: length/i,
    });
    expect(field).toHaveValue("10,000.00");
    await user.click(field);
    expect(field).toHaveValue("10000.00");
    await user.clear(field);
    await user.type(field, "1000");
    await user.keyboard("{Enter}");

    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(
      (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).length,
    ).toEqual(1000);

    const updatedField = screen.getByRole("textbox", {
      name: /value for: length/i,
    });
    expect(updatedField).not.toHaveFocus();
    expect(updatedField).toHaveValue("1,000.00");
  });

  it("can edit from the keyboard", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { status: "closed" })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    await user.tab();
    expect(
      screen.getByRole("combobox", {
        name: /value for: status/i,
      }),
    ).toHaveFocus();
    await user.keyboard("[ArrowDown]");
    expect(screen.getByText(/open/i)).toBeInTheDocument();
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Enter]");

    const updatedSelector = screen.getByRole("combobox", {
      name: /value for: status/i,
    });
    expect(updatedSelector).toHaveTextContent("Open");
    expect(updatedSelector).not.toHaveFocus();

    await user.tab();
    expect(updatedSelector).toHaveFocus();
    await user.tab();

    expect(
      screen.getByRole("textbox", { name: /value for: diameter/i }),
    ).toHaveFocus();

    await user.tab({ shift: true });
    expect(updatedSelector).toHaveFocus();
  });

  it("ignores sign in positive only numeric fields", async () => {
    stubFeatureOn("FLAG_VALIDATIONS");
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { diameter: 10 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: diameter/i,
    });
    await user.clear(field);
    await user.type(field, "-10");
    await user.keyboard("{Enter}");

    const updatedField = screen.getByRole("textbox", {
      name: /value for: diameter/i,
    });
    expect(updatedField).toHaveValue("10.0");
    expect(updatedField).not.toHaveFocus();
  });

  it("ignores changes when not a valid number", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { diameter: 10 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: diameter/i,
    });
    await user.clear(field);
    await user.type(field, "NOTNUMBER");
    expect(
      screen.getByRole("textbox", { name: /value for: diameter/i }),
    ).toHaveClass(/orange/i);
    await user.keyboard("{Enter}");

    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(
      (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).diameter,
    ).toEqual(10);

    expect(field).toHaveValue("10.0");
    expect(field).not.toHaveFocus();
  });

  const setInitialState = ({
    store = createStore(),
    hydraulicModel = HydraulicModelBuilder.with().build(),
    selectedAssetId,
  }: {
    store?: Store;
    hydraulicModel?: HydraulicModel;
    selectedAssetId: AssetId;
  }): Store => {
    store.set(dataAtom, {
      ...nullData,
      hydraulicModel: hydraulicModel,
      featureMapDeprecated: hydraulicModel.assets,
      selection: { type: "single", id: selectedAssetId, parts: [] },
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

  const expectStatusDisplayed = (value: string) => {
    const escapedName = "status";
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`key: ${escapedName}`, "i"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: new RegExp(`value for: ${escapedName}`, "i"),
      }),
    ).toHaveTextContent(value);
  };
});
