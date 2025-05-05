import { CommandContainer } from "src/commands/__helpers__/command-container";
import { aNodesAnalysis, setInitialState } from "src/__helpers__/state";
import { screen, render, waitFor } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { SymbolizationDialog, defaultNewColor } from "./symbolization-dialog";
import { Dialog } from "@radix-ui/react-dialog";
import { analysisAtom } from "src/state/analysis";
import { PressuresAnalysis } from "src/analysis";
import userEvent from "@testing-library/user-event";
import { ISymbolizationRamp } from "src/types";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOn } from "src/__helpers__/feature-flags";

describe("symbolization dialog", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOMIZE");
  });
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

    expectColor(0, red);
    expectStopValue(0, "20");
    expectColor(1, green);
    expectStopValue(1, "30");
    expectColor(2, blue);
  });

  it("can change the range stops manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    const field = screen.getByRole("textbox", {
      name: /value for: step 0/i,
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

  it("can change the colors manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(
      screen.getByRole("button", {
        name: /color 1/i,
      }),
    );
    const field = screen.getByRole("textbox", { name: "color input" });
    expect(field).toHaveValue(green);
    await user.clear(field);
    await user.type(field, "#123456");
    await user.click(screen.getByText(/done/i));

    await waitFor(() => {
      expectColor(1, "#123456");
    });
    expectStopValue(0, "20");
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
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 100, output: blue },
    ]);
  });

  it("can apply equal quantiles based on data", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 20 } })
      .aJunction("j4", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByText(/equal quantiles/i));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 100, output: blue },
    ]);
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

  it("can prepend stops", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 10, output: green },
        { input: 20, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /prepend stop/i }));

    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);

    await user.click(screen.getByRole("button", { name: /prepend stop/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: -1, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);

    await user.click(screen.getByRole("button", { name: /delete stop 0/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);

    await user.click(screen.getByRole("button", { name: /delete stop 0/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);
  });

  it("can append stops", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /append stop/i }));

    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: 10, output: red },
      { input: 20, output: green },
      { input: 21, output: defaultNewColor },
    ]);

    await user.click(screen.getByRole("button", { name: /append stop/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: 10, output: red },
      { input: 20, output: green },
      { input: 21, output: defaultNewColor },
      { input: 22, output: defaultNewColor },
    ]);
  });

  it("can delete a stop", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /delete stop 1/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 2, output: green },
    ]);
  });

  it("can reverse colors", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /reverse colors/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: blue },
      { input: 2, output: green },
      { input: 3, output: red },
    ]);
  });

  it("can choose a ramp with more values", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 10.1, output: red },
        { input: 20.1, output: green },
        { input: 30.1, output: blue },
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
    expect(stops[0].input).toEqual(10.1);
    expect(stops[1].input).toEqual(20.1);
    expect(stops[2].input).toEqual(30.1);
    expect(stops[3].input).toEqual(31);
  });

  it.skip("shows an error when range not in order", async () => {
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

    field = screen.getByRole("textbox", {
      name: /value for: step 0/i,
    });
    await user.click(field);
    expect(field).toHaveValue("10");
    await user.clear(field);
    await user.type(field, "1000");
    await user.keyboard("{Enter}");
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /append stop/i }));
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete stop 1/i }));
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete stop 0/i }));
    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
  });

  it("shows error when applying equal intervals with no data", async () => {
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

    await user.click(screen.getByText(/equal intervals/i));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("shows error when applying quantile intervals with no data", async () => {
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

  const expectColor = (index: number, color: string) => {
    expect(
      screen
        .getByRole("button", {
          name: new RegExp(`color ${index}`, "i"),
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
