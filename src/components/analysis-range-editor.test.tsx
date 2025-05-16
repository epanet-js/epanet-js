import { CommandContainer } from "src/commands/__helpers__/command-container";
import {
  aLinksAnalysis,
  aNodesAnalysis,
  setInitialState,
} from "src/__helpers__/state";
import { screen, render, waitFor } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { AnalysisRangeEditor } from "./analysis-range-editor";
import { analysisAtom } from "src/state/analysis";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  SymbolizationRamp,
  defaultNewColor,
} from "src/analysis/symbolization-ramp";
import { FlowAnalysis, PropertyAnalysis } from "src/analysis/analysis-types";

describe("analysis range editor", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";
  const white = "#ffffff";
  const startingStops = [
    { input: 10, output: red },
    { input: 20, output: green },
    { input: 30, output: blue },
  ];

  it("can change the range breaks manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: startingStops,
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    const field = screen.getByRole("textbox", {
      name: /value for: break 0/i,
    });
    await user.click(field);
    expect(field).toHaveValue("20");
    await user.clear(field);
    await user.type(field, "25");
    await user.keyboard("{Enter}");

    const { mode, stops } = getUpdateNodesAnalysisSymbolization(store);
    expect(stops[1].input).toEqual(25);
    expect(stops[1].output).toEqual(green);
    expect(mode).toEqual("manual");

    expect(screen.getByRole("combobox", { name: "Mode" })).toHaveTextContent(
      "Manual",
    );
  });

  it("can change the colors manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
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
      expectIntervalColor(1, "#123456");
    });
    expectBreakValue(0, "20");
    const { stops, mode } = getUpdateNodesAnalysisSymbolization(store);
    expect(stops[1].output).toEqual("#123456");
    expect(mode).toEqual("equalQuantiles");
  });

  it("can apply equal intervals based on data", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
      stops: [
        { input: 0, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 40, output: green },
      { input: 70, output: blue },
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
      mode: "equalIntervals",
      property: "pressure",
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 15, output: green },
      { input: 20, output: blue },
    ]);
  });

  it("can switch to manual mode", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 20 } })
      .aJunction("j4", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalIntervals",
      property: "pressure",
      stops: startingStops,
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /manual/i }));

    const { stops, mode } = getUpdateNodesAnalysisSymbolization(store);
    expect(mode).toEqual("manual");
    const asEqualIntervalStops = [
      { input: -Infinity, output: red },
      { input: 50, output: green },
      { input: 75, output: blue },
    ];
    expect(stops).toEqual(asEqualIntervalStops);
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

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
    await user.click(screen.getByTitle("OrRd"));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(0);
    expect(stops[0].output).toEqual("rgb(254,232,200)");
    expect(stops[1].input).toEqual(2);
    expect(stops[1].output).toEqual("rgb(253,187,132)");
    expect(stops[2].input).toEqual(3);
    expect(stops[2].output).toEqual("rgb(227,74,51)");
  });

  it("can prepend breaks", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
      stops: [
        { input: -Infinity, output: red },
        { input: 10, output: green },
        { input: 20, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getAllByRole("button", { name: /add break/i })[0]);

    const firstState = getUpdateNodesAnalysisSymbolization(store);
    expect(firstState.stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getAllByRole("button", { name: /add break/i })[0]);

    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: -1, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);

    await user.click(screen.getByRole("button", { name: /delete 0/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);

    await user.click(screen.getByRole("button", { name: /delete 0/i }));

    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);
  });

  it("can append breaks", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getAllByRole("button", { name: /add break/i })[1]);

    const firstState = getUpdateNodesAnalysisSymbolization(store);
    expect(firstState.stops).toEqual([
      { input: 10, output: red },
      { input: 20, output: green },
      { input: 21, output: defaultNewColor },
    ]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getAllByRole("button", { name: /add break/i })[1]);

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: 10, output: red },
      { input: 20, output: green },
      { input: 21, output: defaultNewColor },
      { input: 22, output: defaultNewColor },
    ]);
  });

  it("can delete a break", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
        { input: 4, output: white },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /delete 1/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 2, output: green },
      { input: 4, output: white },
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

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
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
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: red },
        { input: 20.1, output: green },
        { input: 30.1, output: blue },
      ],
    });
    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    expect(
      screen.getByRole("combobox", { name: /classes/i }),
    ).toHaveTextContent("3");

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: /4/ }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops.length).toEqual(4);
  });

  it("shows an error when range not in order", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      stops: [
        { input: -Infinity, output: white },
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    let field = screen.getByRole("textbox", {
      name: /value for: break 1/i,
    });
    await user.click(field);
    expect(field).toHaveValue("20");
    await user.clear(field);
    await user.type(field, "100");
    await user.keyboard("{Enter}");

    expectBreakValue(1, "100");
    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[2].input).toEqual(20);
    expect(stops[2].output).toEqual(green);
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    field = screen.getByRole("textbox", {
      name: /value for: break 2/i,
    });
    await user.click(field);
    await user.clear(field);
    await user.type(field, "110");
    await user.keyboard("{Enter}");

    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[2].input).toEqual(100);
    expect(stops[3].input).toEqual(110);

    field = screen.getByRole("textbox", {
      name: /value for: break 0/i,
    });
    await user.click(field);
    expect(field).toHaveValue("10");
    await user.clear(field);
    await user.type(field, "1000");
    await user.keyboard("{Enter}");
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /add break/i })[0]);
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete 2/i }));
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete 1/i }));
    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
  });

  it("shows error when applying equal intervals with no data", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("shows error when applying quantile intervals with no data", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalIntervals",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("shows error when changing to number of classes without data ", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("p1", { simulation: { flow: 10 } })
      .aPipe("p2", { simulation: { flow: 15 } })
      .aPipe("p3", { simulation: { flow: 20 } })
      .aPipe("p4", { simulation: { flow: 30 } })
      .build();
    const user = userEvent.setup();
    const linksAnalysis = aLinksAnalysis({
      property: "flow",
      mode: "equalIntervals",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ hydraulicModel, linksAnalysis });

    renderComponent({ store, geometryType: "links" });

    expect(screen.queryByText(/not enough data/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /classes/i }),
    ).toHaveTextContent("3");
    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /ckmeans/i }));
    expect(screen.queryByText(/not enough data/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: /4/i }));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("can also handle links with absolute values", async () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aPipe("p1", { simulation: { flow: 10 } })
      .aPipe("p2", { simulation: { flow: 15 } })
      .aPipe("p3", { simulation: { flow: -15 } })
      .aPipe("p4", { simulation: { flow: 20 } })
      .aPipe("p5", { simulation: { flow: 20 } })
      .aPipe("p6", { simulation: { flow: 20 } })
      .build();
    const user = userEvent.setup();
    const linksAnalysis = aLinksAnalysis({
      property: "flow",
      stops: startingStops,
      absValues: true,
    });

    const store = setInitialState({ linksAnalysis, hydraulicModel });

    renderComponent({ store, geometryType: "links" });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    let stops = getUpdateLinksAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(-Infinity);
    expect(stops[1].input).toEqual(15);
    expect(stops[2].input).toEqual(20);

    const field = screen.getByRole("textbox", {
      name: /value for: break 0/i,
    });
    await user.click(field);
    expect(field).toHaveValue("15");
    await user.clear(field);
    await user.type(field, "-14");
    await user.keyboard("{Enter}");

    stops = getUpdateLinksAnalysisSymbolization(store).stops;
    expect(stops[1].input).toEqual(14);
    expect(stops[1].output).toEqual(green);
  });

  const getUpdateNodesAnalysisSymbolization = (
    store: Store,
  ): SymbolizationRamp => {
    return (store.get(analysisAtom).nodes as PropertyAnalysis).rangeColorMapping
      .symbolization;
  };

  const getUpdateLinksAnalysisSymbolization = (
    store: Store,
  ): SymbolizationRamp => {
    return (store.get(analysisAtom).links as FlowAnalysis).rangeColorMapping
      .symbolization;
  };

  const expectBreakValue = (index: number, value: string) => {
    expect(
      screen.getByRole("textbox", {
        name: new RegExp(`value for: break ${index}`, "i"),
      }),
    ).toHaveValue(value);
  };

  const expectIntervalColor = (index: number, color: string) => {
    expect(
      screen
        .getByRole("button", {
          name: new RegExp(`color ${index}`, "i"),
        })
        .getAttribute("data-color"),
    ).toEqual(color);
  };

  const renderComponent = ({
    store,
    geometryType = "nodes",
  }: {
    store: Store;
    geometryType?: "nodes" | "links";
  }) => {
    render(
      <CommandContainer store={store}>
        <AnalysisRangeEditor geometryType={geometryType} />
      </CommandContainer>,
    );
  };
});
