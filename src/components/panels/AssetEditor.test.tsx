import { render, screen, waitFor } from "@testing-library/react";
import { Store, dataAtom, nullData } from "src/state/jotai";
import { Provider as JotaiProvider, createStore } from "jotai";
import { HydraulicModel, Pipe, Pump } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import { UIDMap } from "src/lib/id_mapper";
import userEvent from "@testing-library/user-event";
import { AssetId, getLink, getPipe } from "src/hydraulic-model/assets-map";
import FeatureEditor from "./feature_editor";
import { QueryClient, QueryClientProvider } from "react-query";
import { Valve } from "src/hydraulic-model/asset-types";

describe("AssetEditor", () => {
  describe("with a pipe", () => {
    it("can show its properties", () => {
      const pipeId = "P1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .setHeadlossFormula("D-W")
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aPipe(pipeId, {
          label: "MY_PIPE",
          status: "open",
          length: 10,
          diameter: 100.1,
          roughness: 1,
          minorLoss: 0.1,
          startNodeId: "j1",
          endNodeId: "j2",
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });

      renderComponent(store);

      expect(screen.getByText(/pipe/i)).toBeInTheDocument();

      expectStatusDisplayed("Open");
      expectPropertyDisplayed("label", "MY_PIPE");
      expectPropertyDisplayed("start node", "J1");
      expectPropertyDisplayed("end node", "J2");
      expectPropertyDisplayed("diameter (mm)", "100.1");
      expectPropertyDisplayed("roughness", "1");
      expectPropertyDisplayed("length", "10");
      expectPropertyDisplayed("loss coeff. (m)", "0.1");
      expectPropertyDisplayed("flow", "Not Available");
    });

    it("can show simulation results", () => {
      const pipeId = "P1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, {
          simulation: { flow: 20.1234, velocity: 10.1234, headloss: 0.234 },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });

      renderComponent(store);

      expectPropertyDisplayed("flow (l/s)", "20.123");
      expectPropertyDisplayed("velocity (m/s)", "10.123");
      expectPropertyDisplayed("headloss (m)", "0.234");
    });
  });

  describe("with a valve", () => {
    it("can show its properties", () => {
      const valveId = "V1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aValve(valveId, {
          label: "MY_VALVE",
          connections: ["j1", "j2"],
          minorLoss: 14,
          diameter: 22,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: valveId,
      });

      renderComponent(store);

      expect(screen.getByText(/valve/i)).toBeInTheDocument();

      expectPropertyDisplayed("label", "MY_VALVE");
      expectPropertyDisplayed("start node", "J1");
      expectPropertyDisplayed("end node", "J2");
      expectPropertyDisplayed("diameter (mm)", "22");
      expectPropertyDisplayed("loss coeff.", "14");
    });

    it("can change its initial status", async () => {
      const valveId = "V1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(valveId, { initialStatus: "active" })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: valveId,
      });
      const user = userEvent.setup();

      const historyControl = renderComponent(store);

      const selector = screen.getByRole("combobox", {
        name: /initial status/i,
      });

      await user.click(selector);

      await user.click(screen.getByText(/closed/i));

      const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
      expect(
        (getLink(updatedHydraulicModel.assets, valveId) as Valve).initialStatus,
      ).toEqual("closed");

      expect(selector).not.toHaveFocus();
      expect(selector).toHaveTextContent("Closed");

      historyControl("undo");
      await waitFor(() => {
        const updatedSelector = screen.getByRole("combobox", {
          name: /initial status/i,
        });
        expect(updatedSelector).toHaveTextContent("Active");
      });
    });

    it("can change valve kind", async () => {
      const valveId = "V1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(valveId, {
          initialStatus: "active",
          kind: "fcv",
          setting: 10,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: valveId,
      });
      const user = userEvent.setup();

      const historyControl = renderComponent(store);

      expectPropertyDisplayed("setting (l/s)", "10");
      const selector = screen.getByRole("combobox", {
        name: /valve type/i,
      });

      await user.click(selector);

      await user.click(screen.getByText(/psv: pressure sustaining valve/i));

      const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
      expect(
        (getLink(updatedHydraulicModel.assets, valveId) as Valve).kind,
      ).toEqual("psv");

      expect(selector).not.toHaveFocus();
      expect(selector).toHaveTextContent("PSV");
      expectPropertyDisplayed("setting (m)", "10");

      historyControl("undo");
      await waitFor(() => {
        const updatedSelector = screen.getByRole("combobox", {
          name: /valve type/i,
        });
        expect(updatedSelector).toHaveTextContent("FCV");
      });
      expectPropertyDisplayed("setting (l/s)", "10");
    });

    it("can show simulation results", () => {
      const valve1 = "v1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(valve1, {
          simulation: {
            flow: 20.1234,
            velocity: 10.1234,
            headloss: 98,
            status: "open",
            statusWarning: "cannot-deliver-pressure",
          },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: valve1,
      });

      renderComponent(store);

      expectPropertyDisplayed("flow (l/s)", "20.123");
      expectPropertyDisplayed("velocity (m/s)", "10.123");
      expectPropertyDisplayed("headloss (m)", "98");
      expectPropertyDisplayed("status", "Open - Cannot deliver pressure");
    });
  });

  describe("with a pump", () => {
    it("can show its properties", () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .setHeadlossFormula("D-W")
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aPump(pumpId, {
          label: "MY_PUMP",
          connections: ["j1", "j2"],
          initialStatus: "on",
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });

      renderComponent(store);

      expect(screen.getByText(/pump/i)).toBeInTheDocument();

      expectPropertyDisplayed("label", "MY_PUMP");
      expectPropertyDisplayed("start node", "J1");
      expectPropertyDisplayed("end node", "J2");
      expectStatusDisplayed("On");
    });

    it("shows properties for flow-vs-head definition", () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .setHeadlossFormula("D-W")
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aPump(pumpId, {
          label: "MY_PUMP",
          connections: ["j1", "j2"],
          initialStatus: "on",
          definitionType: "flow-vs-head",
          designFlow: 20,
          designHead: 10,
          speed: 0.8,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });

      renderComponent(store);

      expect(screen.getByText(/pump/i)).toBeInTheDocument();

      expectPropertyDisplayed("design flow (l/s)", "20");
      expectPropertyDisplayed("design head (m)", "10");
      expectPropertyDisplayed("speed", "0.8");
    });

    it("shows properties for power defintion", () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .setHeadlossFormula("D-W")
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aPump(pumpId, {
          label: "MY_PUMP",
          connections: ["j1", "j2"],
          initialStatus: "on",
          definitionType: "power",
          power: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });

      renderComponent(store);

      expect(screen.getByText(/pump/i)).toBeInTheDocument();

      expectPropertyDisplayed("power (kW)", "100");
    });

    it("can change pump definition", async () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .setHeadlossFormula("D-W")
        .aJunction("j1", { label: "J1" })
        .aJunction("j2", { label: "J2" })
        .aPump(pumpId, {
          label: "MY_PUMP",
          connections: ["j1", "j2"],
          initialStatus: "on",
          definitionType: "flow-vs-head",
          designFlow: 20,
          designHead: 40,
          power: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });
      const user = userEvent.setup();

      renderComponent(store);

      expectPropertyDisplayed("design flow (l/s)", "20");

      const selector = screen.getByRole("combobox", {
        name: /pump type/i,
      });

      await user.click(selector);

      await user.click(screen.getByText(/constant power/i));

      expectPropertyDisplayed("power (kW)", "100");
    });

    it("can show simulation results", () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPump(pumpId, { simulation: { flow: 20.1234, headloss: -10.1234 } })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });

      renderComponent(store);

      expectPropertyDisplayed("flow (l/s)", "20.123");
      expectPropertyDisplayed("pump head (m)", "10.123");
      expectPropertyDisplayed("status", "On");
    });

    it("can change its status", async () => {
      const pumpId = "PU1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPump(pumpId, { initialStatus: "on" })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pumpId,
      });
      const user = userEvent.setup();

      const historyControl = renderComponent(store);

      const selector = screen.getByRole("combobox", {
        name: /value for: status/i,
      });

      await user.click(selector);

      await user.click(screen.getByText(/off/i));

      const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
      expect(
        (getLink(updatedHydraulicModel.assets, pumpId) as Pump).initialStatus,
      ).toEqual("off");

      expect(selector).not.toHaveFocus();
      expect(selector).toHaveTextContent("Of");

      historyControl("undo");
      await waitFor(() => {
        const updatedSelector = screen.getByRole("combobox", {
          name: /value for: status/i,
        });
        expect(updatedSelector).toHaveTextContent("On");
      });
    });
  });

  describe("with a junction", () => {
    it("shows its properties", () => {
      const junctionId = "J1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(junctionId, {
          label: "MY_JUNCTION",
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

      expectPropertyDisplayed("label", "MY_JUNCTION");
      expectPropertyDisplayed("elevation (m)", "10");
      expectPropertyDisplayed("demand (l/s)", "100");
      expectPropertyDisplayed("pressure (m)", "Not Available");
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

      expectPropertyDisplayed("pressure (m)", "20");
    });
  });

  describe("with a reservoir", () => {
    it("shows its properties", () => {
      const reservoirId = "R1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(reservoirId, {
          label: "MY_RESERVOIR",
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

      expectPropertyDisplayed("label", "MY_RESERVOIR");
      expectPropertyDisplayed("elevation (m)", "10");
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

    const historyControl = renderComponent(store);

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

    historyControl("undo");
    await waitFor(() => {
      const updatedSelector = screen.getByRole("combobox", {
        name: /value for: status/i,
      });
      expect(updatedSelector).toHaveTextContent("Open");
    });
  });

  it("can change a property", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { diameter: 10.4 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    const historyControl = renderComponent(store);

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

    let updatedField = screen.getByRole("textbox", {
      name: /value for: diameter/i,
    });
    expect(updatedField).toHaveValue("20.5");
    expect(updatedField).not.toHaveFocus();

    historyControl("undo");

    await waitFor(() => {
      updatedField = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      expect(updatedField).toHaveValue("10.4");
    });
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
    expect(field).toHaveValue("10");
    expect(field).toHaveAttribute("readonly");
  });

  it("clears group formatting when focusing input", async () => {
    const pipeId = "PIPE1";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(pipeId, { length: 10000.2 })
      .build();
    const store = setInitialState({ hydraulicModel, selectedAssetId: pipeId });
    const user = userEvent.setup();

    renderComponent(store);

    const field = screen.getByRole("textbox", {
      name: /value for: length/i,
    });
    expect(field).toHaveValue("10,000.2");
    await user.click(field);
    expect(field).toHaveValue("10000.2");
    await user.clear(field);
    await user.type(field, "1000.4");
    await user.keyboard("{Enter}");

    const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
    expect(
      (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).length,
    ).toEqual(1000.4);

    const updatedField = screen.getByRole("textbox", {
      name: /value for: length/i,
    });
    expect(updatedField).not.toHaveFocus();
    expect(updatedField).toHaveValue("1,000.4");
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
      screen.getByRole("textbox", {
        name: /value for: label/i,
      }),
    ).toHaveFocus();
    await user.tab();
    await user.tab();
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
    expect(
      screen.getByRole("textbox", {
        name: /value for: label/i,
      }),
    ).toHaveFocus();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    expect(
      screen.getByRole("textbox", { name: /value for: diameter/i }),
    ).toHaveFocus();

    await user.tab({ shift: true });
    expect(updatedSelector).toHaveFocus();
  });

  describe("validations", () => {
    it("ignores sign in positive only numeric fields", async () => {
      const pipeId = "PIPE1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });
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
      expect(updatedField).toHaveValue("10");
      expect(updatedField).not.toHaveFocus();
    });

    it("allows cientific notation in positive fields", async () => {
      const pipeId = "PIPE1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });
      const user = userEvent.setup();

      renderComponent(store);

      const field = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      await user.clear(field);
      await user.type(field, "1e-3");
      await user.keyboard("{Enter}");

      const updatedField = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      expect(updatedField).toHaveValue("0.001");
      expect(updatedField).not.toHaveFocus();
    });

    it("ignores text from numeric fields", async () => {
      const pipeId = "PIPE1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });
      const user = userEvent.setup();

      renderComponent(store);

      const field = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      await user.clear(field);
      await user.type(field, "SAM10SAM");
      await user.keyboard("{Enter}");

      const updatedField = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      expect(updatedField).toHaveValue("10");
      expect(updatedField).not.toHaveFocus();
    });

    it("doesn't accept 0 in non nullable properties", async () => {
      const pipeId = "PIPE1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { length: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });
      const user = userEvent.setup();

      renderComponent(store);

      const field = screen.getByRole("textbox", {
        name: /value for: length/i,
      });
      await user.clear(field);
      await user.type(field, "0");
      expect(
        screen.getByRole("textbox", { name: /value for: length/i }),
      ).toHaveClass(/orange/i);
      await user.type(field, "10");
      expect(
        screen.getByRole("textbox", { name: /value for: length/i }),
      ).not.toHaveClass(/orange/i);
      await user.keyboard("{Enter}");

      const updatedField = screen.getByRole("textbox", {
        name: /value for: length/i,
      });
      expect(updatedField).toHaveValue("10");
      expect(updatedField).not.toHaveFocus();
    });

    it("ignores changes when not a valid number", async () => {
      const pipeId = "PIPE1";
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(pipeId, { diameter: 10 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: pipeId,
      });
      const user = userEvent.setup();

      renderComponent(store);

      const field = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      await user.clear(field);
      await user.type(field, "0");
      expect(
        screen.getByRole("textbox", { name: /value for: diameter/i }),
      ).toHaveClass(/orange/i);
      await user.keyboard("{Enter}");

      const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
      expect(
        (getPipe(updatedHydraulicModel.assets, pipeId) as Pipe).diameter,
      ).toEqual(10);

      expect(field).toHaveValue("0");
      expect(field).toHaveFocus();

      await user.keyboard("{Escape}");
      const updatedField = screen.getByRole("textbox", {
        name: /value for: diameter/i,
      });
      expect(updatedField).toHaveValue("10");
      expect(updatedField).not.toHaveFocus();

      await user.clear(updatedField);
      await user.type(updatedField, "0");
      expect(updatedField).toHaveValue("0");
      await user.tab();

      expect(updatedField).not.toHaveFocus();
      expect(updatedField).toHaveValue("10");
    });
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
      selection: { type: "single", id: selectedAssetId, parts: [] },
    });
    return store;
  };

  const renderComponent = (store: Store) => {
    const idMap = UIDMap.empty();
    const persistence = new MemPersistence(idMap, store);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <PersistenceContext.Provider value={persistence}>
            <FeatureEditor />
          </PersistenceContext.Provider>
        </JotaiProvider>
      </QueryClientProvider>,
    );

    const historyControl = persistence.useHistoryControl();
    return historyControl;
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

  const expectStatusDisplayed = (value: string, escapedName = "status") => {
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
