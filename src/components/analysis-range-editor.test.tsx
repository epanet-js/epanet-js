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
import { ISymbolizationRamp } from "src/types";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { defaultNewColor } from "src/analysis/symbolization-ramp";
import { FlowAnalysis, PropertyAnalysis } from "src/analysis/analysis-types";

describe("analysis range editor", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_CUSTOMIZE");
  });
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";
  const white = "#ffffff";
  const startingStops = [
    { input: 10, output: red },
    { input: 20, output: green },
    { input: 30, output: blue },
  ];

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

    const { mode, stops } = getUpdateNodesAnalysisSymbolization(store);
    expect(stops[1].input).toEqual(25);
    expect(stops[1].output).toEqual(green);
    expect(mode).toEqual("manual");

    expect(
      screen.getByRole("combobox", { name: "ramp mode" }),
    ).toHaveTextContent("Manual");
  });

  it("can change the colors manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "quantiles",
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
    const { stops, mode } = getUpdateNodesAnalysisSymbolization(store);
    expect(stops[1].output).toEqual("#123456");
    expect(mode).toEqual("quantiles");
  });

  it("can apply equal intervals based on data", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      mode: "quantiles",
      stops: [
        { input: 0, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops).toEqual([
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 55, output: blue },
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
      mode: "linear",
      property: "pressure",
      stops: [
        { input: -Infinity, output: red },
        { input: 2, output: green },
        { input: 3, output: blue },
      ],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    expect(screen.queryByText(/not enough data/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ascending/)).not.toBeInTheDocument();
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
      mode: "linear",
      property: "pressure",
      stops: startingStops,
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /manual/i }));

    const { stops, mode } = getUpdateNodesAnalysisSymbolization(store);
    expect(mode).toEqual("manual");
    const asEqualIntervalStops = [
      { input: -Infinity, output: red },
      { input: 10, output: green },
      { input: 55, output: blue },
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

  it("can prepend stops", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "quantiles",
      stops: [
        { input: -Infinity, output: red },
        { input: 10, output: green },
        { input: 20, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /prepend stop/i }));

    const firstState = getUpdateNodesAnalysisSymbolization(store);
    expect(firstState.stops).toEqual([
      { input: -Infinity, output: defaultNewColor },
      { input: 0, output: red },
      { input: 10, output: green },
      { input: 20, output: blue },
    ]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getByRole("button", { name: /prepend stop/i }));

    let stops = getUpdateNodesAnalysisSymbolization(store).stops;
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

    const firstState = getUpdateNodesAnalysisSymbolization(store);
    expect(firstState.stops).toEqual([
      { input: 10, output: red },
      { input: 20, output: green },
      { input: 21, output: defaultNewColor },
    ]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getByRole("button", { name: /append stop/i }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
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
        { input: 4, output: white },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /delete stop 1/i }));

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
      screen.getByRole("combobox", { name: /ramp size/i }),
    ).toHaveTextContent("3");

    await user.click(screen.getByRole("combobox", { name: /ramp size/i }));
    await user.click(screen.getByRole("option", { name: /4/ }));

    const stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops.length).toEqual(4);
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
      mode: "quantiles",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it("shows error when applying quantile intervals with no data", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "linear",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));
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

    await user.click(screen.getByRole("combobox", { name: /ramp mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    expect(screen.queryByText(/not enough data/i)).not.toBeInTheDocument();
    let stops = getUpdateLinksAnalysisSymbolization(store).stops;
    expect(stops[0].input).toEqual(-Infinity);
    expect(stops[1].input).toEqual(15);
    expect(stops[2].input).toEqual(20);

    const field = screen.getByRole("textbox", {
      name: /value for: step 0/i,
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
  ): ISymbolizationRamp => {
    return (store.get(analysisAtom).nodes as PropertyAnalysis).rangeColorMapping
      .symbolization;
  };

  const getUpdateLinksAnalysisSymbolization = (
    store: Store,
  ): ISymbolizationRamp => {
    return (store.get(analysisAtom).links as FlowAnalysis).rangeColorMapping
      .symbolization;
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
