import { render, screen, waitFor, act } from "@testing-library/react";
import { Store, dataAtom, nullData } from "src/state/jotai";
import { Provider as JotaiProvider, createStore } from "jotai";
import { HydraulicModel, Pipe, Pump } from "src/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { PersistenceContext } from "src/lib/persistence/context";
import { MemPersistence } from "src/lib/persistence/memory";
import userEvent from "@testing-library/user-event";
import { AssetId, getLink, getPipe } from "src/hydraulic-model/assets-map";
import FeatureEditor from "../feature-editor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Valve } from "src/hydraulic-model/asset-types";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("AssetPanel", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_ACTIVE_TOPOLOGY");
  });
  describe("with a pipe", () => {
    it("can show its properties", () => {
      const IDS = { P1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .headlossFormula("D-W")
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aPipe(IDS.P1, {
          label: "MY_PIPE",
          initialStatus: "open",
          length: 10,
          diameter: 100.1,
          roughness: 1,
          minorLoss: 0.1,
          startNodeId: IDS.j1,
          endNodeId: IDS.j2,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.P1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_PIPE")).toBeInTheDocument();
      expect(screen.getByText("Pipe")).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", {
          name: /initial status/i,
        }),
      ).toHaveTextContent("Open");
      expectTextPropertyDisplayed("start node", "J1");
      expectTextPropertyDisplayed("end node", "J2");
      expectPropertyDisplayed("diameter (mm)", "100.1");
      expectPropertyDisplayed("roughness", "1");
      expectPropertyDisplayed("length", "10");
      expectPropertyDisplayed("loss coeff. (m)", "0.1");
      expect(screen.queryAllByText("Not available").length).toBeGreaterThan(0);
    });

    it("can show simulation results", () => {
      const IDS = { P1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.P1, {
          simulation: {
            flow: 20.1234,
            velocity: 10.1234,
            headloss: 0.234,
            unitHeadloss: 0.1234,
            status: "open",
          },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.P1,
      });

      renderComponent(store);

      expectTextPropertyDisplayed("flow (l/s)", "20.123");
      expectTextPropertyDisplayed("velocity (m/s)", "10.123");
      expectTextPropertyDisplayed("headloss (m)", "0.234");
      expectTextPropertyDisplayed("unit headloss (m/km)", "0.123");
    });
  });

  describe("with a valve", () => {
    it("can show its properties", () => {
      const IDS = { V1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aValve(IDS.V1, {
          label: "MY_VALVE",
          connections: [IDS.j1, IDS.j2],
          minorLoss: 14,
          diameter: 22,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.V1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_VALVE")).toBeInTheDocument();
      expect(screen.getByText("Valve")).toBeInTheDocument();
      expectTextPropertyDisplayed("start node", "J1");
      expectTextPropertyDisplayed("end node", "J2");
      expectPropertyDisplayed("diameter (mm)", "22");
      expectPropertyDisplayed("loss coeff.", "14");
    });

    it("can change its initial status", async () => {
      const IDS = { V1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(IDS.V1, { initialStatus: "active" })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.V1,
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
        (getLink(updatedHydraulicModel.assets, IDS.V1) as Valve).initialStatus,
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
      const IDS = { V1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(IDS.V1, {
          initialStatus: "active",
          kind: "fcv",
          setting: 10,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.V1,
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
        (getLink(updatedHydraulicModel.assets, IDS.V1) as Valve).kind,
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
      const IDS = { v1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aValve(IDS.v1, {
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
        selectedAssetId: IDS.v1,
      });

      renderComponent(store);

      expectTextPropertyDisplayed("flow (l/s)", "20.123");
      expectTextPropertyDisplayed("velocity (m/s)", "10.123");
      expectTextPropertyDisplayed("headloss (m)", "98");
      expectTextPropertyDisplayed("status", "Open - Cannot deliver pressure");
    });
  });

  describe("with a pump", () => {
    it("can show its properties", () => {
      const IDS = { PU1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .headlossFormula("D-W")
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aPump(IDS.PU1, {
          label: "MY_PUMP",
          connections: [IDS.j1, IDS.j2],
          initialStatus: "on",
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_PUMP")).toBeInTheDocument();
      expect(screen.getByText("Pump")).toBeInTheDocument();
      expectTextPropertyDisplayed("start node", "J1");
      expectTextPropertyDisplayed("end node", "J2");
      expect(
        screen.getByRole("combobox", {
          name: /initial status/i,
        }),
      ).toHaveTextContent("On");
    });

    it("shows properties for flow-vs-head definition", () => {
      const IDS = { PU1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .headlossFormula("D-W")
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aPump(IDS.PU1, {
          label: "MY_PUMP",
          connections: [IDS.j1, IDS.j2],
          initialStatus: "on",
          definitionType: "flow-vs-head",
          designFlow: 20,
          designHead: 10,
          speed: 0.8,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_PUMP")).toBeInTheDocument();
      expect(screen.getByText("Pump")).toBeInTheDocument();
      expectPropertyDisplayed("design flow (l/s)", "20");
      expectPropertyDisplayed("design head (m)", "10");
      expectPropertyDisplayed("speed", "0.8");
    });

    it("shows properties for power defintion", () => {
      const IDS = { PU1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .headlossFormula("D-W")
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aPump(IDS.PU1, {
          label: "MY_PUMP",
          connections: [IDS.j1, IDS.j2],
          initialStatus: "on",
          definitionType: "power",
          power: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_PUMP")).toBeInTheDocument();
      expect(screen.getByText("Pump")).toBeInTheDocument();
      expectPropertyDisplayed("power (kW)", "100");
    });

    it("can change pump definition", async () => {
      const IDS = { PU1: 1, j1: 2, j2: 3 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .headlossFormula("D-W")
        .aJunction(IDS.j1, { label: "J1" })
        .aJunction(IDS.j2, { label: "J2" })
        .aPump(IDS.PU1, {
          label: "MY_PUMP",
          connections: [IDS.j1, IDS.j2],
          initialStatus: "on",
          definitionType: "flow-vs-head",
          designFlow: 20,
          designHead: 40,
          power: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
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
      const IDS = { PU1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPump(IDS.PU1, { simulation: { flow: 20.1234, headloss: -10.1234 } })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
      });

      renderComponent(store);

      expectTextPropertyDisplayed("flow (l/s)", "20.123");
      expectTextPropertyDisplayed("pump head (m)", "10.123");
      expectTextPropertyDisplayed("status", "On");
    });

    it("can change its status", async () => {
      const IDS = { PU1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPump(IDS.PU1, { initialStatus: "on" })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PU1,
      });
      const user = userEvent.setup();

      const historyControl = renderComponent(store);

      const selector = screen.getByRole("combobox", {
        name: /initial status/i,
      });

      await user.click(selector);

      await user.click(screen.getByText(/off/i));

      const { hydraulicModel: updatedHydraulicModel } = store.get(dataAtom);
      expect(
        (getLink(updatedHydraulicModel.assets, IDS.PU1) as Pump).initialStatus,
      ).toEqual("off");

      expect(selector).not.toHaveFocus();
      expect(selector).toHaveTextContent("Of");

      historyControl("undo");
      await waitFor(() => {
        const updatedSelector = screen.getByRole("combobox", {
          name: /initial status/i,
        });
        expect(updatedSelector).toHaveTextContent("On");
      });
    });
  });

  describe("with a junction", () => {
    it("shows its properties", () => {
      const IDS = { J1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: "MY_JUNCTION",
          elevation: 10,
          baseDemand: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.J1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_JUNCTION")).toBeInTheDocument();
      expect(screen.getByText("Junction")).toBeInTheDocument();
      expectPropertyDisplayed("elevation (m)", "10");
      expectPropertyDisplayed("direct demand (l/s)", "100");
      expect(screen.queryAllByText("Not available").length).toBeGreaterThan(0);
    });

    it("can show simulation results", () => {
      const IDS = { J1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          elevation: 10,
          baseDemand: 100,
          simulation: { pressure: 20, head: 10, demand: 20 },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.J1,
      });

      renderComponent(store);

      expectTextPropertyDisplayed("pressure (m)", "20");
      expectTextPropertyDisplayed("head (m)", "10");
      expectTextPropertyDisplayed("actual demand (l/s)", "20");
    });

    it("shows Customer Demand field when junction has customer points", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: "MY_JUNCTION",
          baseDemand: 50,
        })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          label: "CP1",
          coordinates: [1, 2],
          demand: 25,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [1, 2],
          },
        })
        .aCustomerPoint(IDS.CP2, {
          label: "CP2",
          coordinates: [3, 4],
          demand: 30,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [3, 4],
          },
        })
        .build();

      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.J1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_JUNCTION")).toBeInTheDocument();
      expect(screen.getByText("Junction")).toBeInTheDocument();
      expectPropertyDisplayed("direct demand (l/s)", "50");

      expectTextPropertyDisplayed("customer demand (l/s)", "55");

      const connectedCustomersTrigger = screen.getByRole("button", {
        name: /connected customers/i,
      });
      expect(connectedCustomersTrigger).toBeInTheDocument();
      expect(connectedCustomersTrigger).toHaveTextContent("2");
    });

    it("opens popover when Customer Demand field is clicked", async () => {
      const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4, CP2: 5 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: "MY_JUNCTION",
          baseDemand: 50,
        })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
        })
        .aCustomerPoint(IDS.CP1, {
          label: "CP1",
          coordinates: [1, 2],
          demand: 25,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [1, 2],
          },
        })
        .aCustomerPoint(IDS.CP2, {
          label: "CP2",
          coordinates: [3, 4],
          demand: 30,
          connection: {
            pipeId: IDS.P1,
            junctionId: IDS.J1,
            snapPoint: [3, 4],
          },
        })
        .build();

      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.J1,
      });
      const user = userEvent.setup();

      renderComponent(store);

      const connectedCustomersTrigger = screen.getByRole("button", {
        name: /connected customers/i,
      });

      await user.click(connectedCustomersTrigger);

      await waitFor(() => {
        expect(screen.getByText("CP1")).toBeInTheDocument();
      });
      expect(screen.getByText("CP2")).toBeInTheDocument();
      expect(screen.getByText("2,160,000")).toBeInTheDocument();
      expect(screen.getByText("2,592,000")).toBeInTheDocument();
    });

    it("does not show Customer Demand field when junction has no customer points", () => {
      const IDS = { J1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          label: "MY_JUNCTION",
          baseDemand: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.J1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_JUNCTION")).toBeInTheDocument();
      expect(screen.getByText("Junction")).toBeInTheDocument();
      expectPropertyDisplayed("direct demand (l/s)", "100");

      expect(
        screen.queryByLabelText(/label: customer demand \(l\/s\)/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("with a reservoir", () => {
    it("shows its properties", () => {
      const IDS = { R1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, {
          label: "MY_RESERVOIR",
          elevation: 10,
          head: 100,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.R1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_RESERVOIR")).toBeInTheDocument();
      expect(screen.getByText("Reservoir")).toBeInTheDocument();
      expectPropertyDisplayed("elevation (m)", "10");
      expectPropertyDisplayed("head (m)", "100");
    });
  });

  describe("with a tank", () => {
    it("shows its properties", () => {
      const IDS = { T1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, {
          label: "MY_TANK",
          elevation: 10,
          diameter: 300,
          initialLevel: 50,
          minLevel: 0,
          maxLevel: 100,
          minVolume: 0,
          overflow: true,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.T1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_TANK")).toBeInTheDocument();
      expect(screen.getByText("Tank")).toBeInTheDocument();
      expectPropertyDisplayed("elevation (m)", "10");
      expectPropertyDisplayed("diameter (m)", "300");
      expectPropertyDisplayed("initial level (m)", "50");
      expectPropertyDisplayed("min level (m)", "0");
      expectPropertyDisplayed("max level (m)", "100");
      expectPropertyDisplayed("min volume (m³)", "0");
      expect(
        screen.getByRole("checkbox", { name: /can overflow/i }),
      ).toBeChecked();
    });

    it("can change the overflow setting", async () => {
      const IDS = { T1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, {
          label: "MY_TANK",
          overflow: false,
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.T1,
      });

      renderComponent(store);

      expect(screen.getByText("MY_TANK")).toBeInTheDocument();
      expect(screen.getByText("Tank")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /overflow/i }),
      ).not.toBeChecked();

      await userEvent.click(
        screen.getByRole("checkbox", { name: /overflow/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("checkbox", { name: /overflow/i }),
        ).toBeChecked();
      });
    });

    it("can show simulation results", () => {
      const IDS = { T1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, {
          simulation: {
            pressure: 15.1234,
            head: 125.5678,
            level: 25.9876,
            volume: 1500.4321,
          },
        })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.T1,
      });

      renderComponent(store);

      expectTextPropertyDisplayed("pressure (m)", "15.123");
      expectTextPropertyDisplayed("head (m)", "125.568");
      expectTextPropertyDisplayed("level (m)", "25.988");
      expectTextPropertyDisplayed("volume (m³)", "1,500.432");
    });
  });

  it("can change its status", async () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { initialStatus: "open" })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
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
      (getPipe(updatedHydraulicModel.assets, IDS.PIPE1) as Pipe).initialStatus,
    ).toEqual("closed");

    expect(selector).not.toHaveFocus();
    expect(selector).toHaveTextContent("Closed");

    historyControl("undo");
    await waitFor(() => {
      const updatedSelector = screen.getByRole("combobox", {
        name: /initial status/i,
      });
      expect(updatedSelector).toHaveTextContent("Open");
    });
  });

  it("can change a property", async () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { diameter: 10.4 })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
    });
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
      (getPipe(updatedHydraulicModel.assets, IDS.PIPE1) as Pipe).diameter,
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

  it("can toggle active topology status", async () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { isActive: true })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
    });

    renderComponent(store);

    expect(screen.getByRole("checkbox", { name: /enabled/i })).toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: /enabled/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("checkbox", { name: /enabled/i }),
      ).not.toBeChecked();
    });
  });

  it("cannot change simulation results", () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { simulation: { flow: 10, status: "open" } })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
    });

    renderComponent(store);

    expectTextPropertyDisplayed("flow (l/s)", "10");
    expect(
      screen.queryByRole("textbox", {
        name: /value for: flow/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("clears group formatting when focusing input", async () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { length: 10000.2 })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
    });
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
      (getPipe(updatedHydraulicModel.assets, IDS.PIPE1) as Pipe).length,
    ).toEqual(1000.4);

    const updatedField = screen.getByRole("textbox", {
      name: /value for: length/i,
    });
    expect(updatedField).not.toHaveFocus();
    expect(updatedField).toHaveValue("1,000.4");
  });

  it("can edit from the keyboard", async () => {
    const IDS = { PIPE1: 1 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe(IDS.PIPE1, { initialStatus: "closed" })
      .build();
    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.PIPE1,
    });
    const user = userEvent.setup();

    renderComponent(store);

    await user.tab();
    const selector = screen.getByRole("combobox", {
      name: /initial status/i,
    });
    expect(selector).toHaveFocus();

    await user.keyboard("[ArrowDown]");
    expect(screen.getByText(/open/i)).toBeInTheDocument();
    await user.keyboard("[ArrowUp]");
    await user.keyboard("[Enter]");

    expect(selector).toHaveTextContent("Open");
  });

  describe("validations", () => {
    it("ignores sign in positive only numeric fields", async () => {
      const IDS = { PIPE1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.PIPE1, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PIPE1,
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
      const IDS = { PIPE1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.PIPE1, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PIPE1,
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
      const IDS = { PIPE1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.PIPE1, { diameter: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PIPE1,
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
      const IDS = { PIPE1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.PIPE1, { length: 20 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PIPE1,
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
      const IDS = { PIPE1: 1 };
      const hydraulicModel = HydraulicModelBuilder.with()
        .aPipe(IDS.PIPE1, { diameter: 10 })
        .build();
      const store = setInitialState({
        hydraulicModel,
        selectedAssetId: IDS.PIPE1,
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
        (getPipe(updatedHydraulicModel.assets, IDS.PIPE1) as Pipe).diameter,
      ).toEqual(10);

      expect(field).toHaveValue("10");
      expect(field).not.toHaveFocus();

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

  it("updates numeric fields when switching between assets", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 };
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        label: "Junction_1",
        baseDemand: 100,
      })
      .aJunction(IDS.J2, {
        label: "Junction_2",
        baseDemand: 200,
      })
      .aPipe(IDS.P1, {
        label: "Pipe_1",
        diameter: 150,
        length: 500,
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        label: "Pipe_2",
        diameter: 300,
        length: 1000,
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const store = setInitialState({
      hydraulicModel,
      selectedAssetId: IDS.J1,
    });

    renderComponent(store);

    expectPropertyDisplayed("direct demand (l/s)", "100");

    act(() => {
      store.set(dataAtom, {
        ...store.get(dataAtom),
        selection: { type: "single", id: IDS.J2, parts: [] },
      });
    });

    expectPropertyDisplayed("direct demand (l/s)", "200");

    act(() => {
      store.set(dataAtom, {
        ...store.get(dataAtom),
        selection: { type: "single", id: IDS.P1, parts: [] },
      });
    });

    expectPropertyDisplayed("diameter (mm)", "150");
    expectPropertyDisplayed("length (m)", "500");

    act(() => {
      store.set(dataAtom, {
        ...store.get(dataAtom),
        selection: { type: "single", id: IDS.P2, parts: [] },
      });
    });

    expectPropertyDisplayed("diameter (mm)", "300");
    expectPropertyDisplayed("length (m)", "1,000");
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
    const persistence = new MemPersistence(store);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider store={store}>
          <PersistenceContext.Provider value={persistence}>
            <TooltipProvider>
              <FeatureEditor />
            </TooltipProvider>
          </PersistenceContext.Provider>
        </JotaiProvider>
      </QueryClientProvider>,
    );

    const historyControl = persistence.useHistoryControl();
    return historyControl;
  };

  const expectTextPropertyDisplayed = (name: string, value: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const label = screen.getByLabelText(
      new RegExp(`label: ${escapedName}`, "i"),
    );
    expect(label).toBeInTheDocument();
    const container = label.closest(".flex.items-center.gap-1");
    expect(container).toHaveTextContent(value);
  };

  const expectPropertyDisplayed = (name: string, value: string) => {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(
      screen.getByLabelText(new RegExp(`label: ${escapedName}`, "i")),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`value for: ${escapedName}`, "i"),
      }),
    ).toHaveValue(value);
  };
});
