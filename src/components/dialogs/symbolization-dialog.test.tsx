import { CommandContainer } from "src/commands/__helpers__/command-container";
import { aNodesAnalysis, setInitialState } from "src/__helpers__/state";
import { screen, render, waitFor } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { SymbolizationDialog } from "./symbolization-dialog";
import { Dialog } from "@radix-ui/react-dialog";
import { analysisAtom } from "src/state/analysis";
import { PressuresAnalysis } from "src/analysis";
import userEvent from "@testing-library/user-event";
import { ISymbolizationRamp } from "src/types";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("symbolization dialog", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";
  const startingStops = [
    { input: 10, output: red },
    { input: 20, output: green },
    { input: 30, output: blue },
  ];

  it("shows the property being changed", () => {
    const nodesAnalysis = aNodesAnalysis({
      property: "pressure",
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    expect(screen.getByText(/Pressure \(m\)/)).toBeInTheDocument();

    expectStopValue(0, "10");
    expectStopColor(0, red);
    expectStopValue(1, "20");
    expectStopColor(1, green);
    expectStopValue(2, "30");
    expectStopColor(2, blue);
  });

  it("can change the range stops manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    const field = screen.getByRole("textbox", {
      name: /value for: step 1/i,
    });
    await user.click(field);
    expect(field).toHaveValue("20");
    await user.clear(field);
    await user.type(field, "25");
    await user.keyboard("{Enter}");

    const { stops } = getUpdateNodesAnalysisSymbolization(store);
    expect(stops[1].input).toEqual(25);
    expect(stops[1].output).toEqual(green);
  });

  it("shows an error when range not in order", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    let field = screen.getByRole("textbox", {
      name: /value for: step 1/i,
    });
    await user.click(field);
    expect(field).toHaveValue("20");
    await user.clear(field);
    await user.type(field, "100");
    await user.keyboard("{Enter}");

    expectStopValue(1, "100");
    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[1].input).toEqual(20);
    expect(stops[1].output).toEqual(green);
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    field = screen.getByRole("textbox", {
      name: /value for: step 2/i,
    });
    await user.click(field);
    await user.clear(field);
    await user.type(field, "110");
    await user.keyboard("{Enter}");

    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[1].input).toEqual(100);
    expect(stops[2].input).toEqual(110);
  });

  it("can change the colors manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(
      screen.getByRole("button", {
        name: /color for step 1/i,
      }),
    );
    const field = screen.getByRole("textbox", { name: "color input" });
    expect(field).toHaveValue(green);
    await user.clear(field);
    await user.type(field, "#123456");
    await user.click(screen.getByText(/done/i));

    await waitFor(() => {
      expectStopColor(1, "#123456");
    });
    expectStopValue(1, "20");
    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[1].output).toEqual("#123456");
  });

  it("can apply equal intervals based on data", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 0, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/equal intervals/i));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(10);
    expect(stops[0].output).toEqual(red);
    expect(stops[1].input).toEqual(55);
    expect(stops[1].output).toEqual(green);
    expect(stops[2].input).toEqual(100);
    expect(stops[2].output).toEqual(blue);
  });

  it("can apply equal quantiles based on data", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 0, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/equal quantiles/i));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(10);
    expect(stops[0].output).toEqual(red);
    expect(stops[1].input).toEqual(15);
    expect(stops[1].output).toEqual(green);
    expect(stops[2].input).toEqual(100);
    expect(stops[2].output).toEqual(blue);
  });

  it("can apply different ramp color", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 0, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/change color ramp/i));
    await user.click(screen.getByTitle("OrRd"));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(0);
    expect(stops[0].output).toEqual("rgb(254,232,200)");
    expect(stops[1].input).toEqual(2);
    expect(stops[1].output).toEqual("rgb(253,187,132)");
    expect(stops[2].input).toEqual(3);
    expect(stops[2].output).toEqual("rgb(227,74,51)");
  });

  it("can choose a ramp with more values", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/change color ramp/i));
    expect(
      screen.getByRole("combobox", { name: /ramp size/i }),
    ).toHaveTextContent("3");

    await user.click(screen.getByRole("combobox", { name: /ramp size/i }));
    await user.click(screen.getByText(/4/));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(10);
    expect(stops[1].input).toEqual(16.6667);
    expect(stops[2].input).toEqual(23.3333);
    expect(stops[3].input).toEqual(30);
  });

  it("shows error when attempting to apply quantiles without enough data", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/equal quantiles/i));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  const getUpdateNodesAnalysisSymbolization = (
    store: Store,
  ): ISymbolizationRamp => {
    return (store.get(analysisAtom).nodes as PressuresAnalysis)
      .rangeColorMapping.symbolization;
  };

  const expectStopValue = (index: number, value: string) => {
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`value for: step ${index}`, "i"),
      }),
    ).toHaveValue(value);
  };

  const expectStopColor = (index: number, color: string) => {
    expect(
      screen
        .getByRole("button", {
          name: new RegExp(`color for step ${index}`, "i"),
        })
        .getAttribute("data-color"),
    ).toEqual(color);
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <CommandContainer store={store}>
        <Dialog>
          <SymbolizationDialog />
        </Dialog>
      </CommandContainer>,
    );
  };
});
