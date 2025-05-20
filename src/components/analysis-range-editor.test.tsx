import { CommandContainer } from "src/commands/__helpers__/command-container";
import {
  aLinksAnalysis,
  aNodesAnalysis,
  setInitialState,
} from "src/__helpers__/state";
import { screen, render, waitFor } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { AnalysisRangeEditor } from "./analysis-range-editor";
import userEvent from "@testing-library/user-event";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import {
  SymbolizationRamp,
  defaultNewColor,
} from "src/analysis/symbolization-ramp";
import { PropertyAnalysis } from "src/analysis/analysis-types";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  linksAnalysisAtom,
  nodesAnalysisAtom,
  savedAnalysesAtom,
} from "src/state/analysis";

describe("analysis range editor", () => {
  const red = "#ff0000";
  const green = "#00ff00";
  const blue = "#0000ff";
  const white = "#ffffff";

  beforeEach(() => {
    stubFeatureOn("FLAG_MEMORIZE");
  });

  it("can change the range breaks manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      breaks: [20, 30],
      colors: [red, green, blue],
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

    const { mode, breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(breaks).toEqual([25, 30]);
    expect(colors).toEqual([red, green, blue]);
    expect(mode).toEqual("manual");

    expect(screen.getByRole("combobox", { name: "Mode" })).toHaveTextContent(
      "Manual",
    );
  });

  it("can change the colors manually", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
      breaks: [20, 30],
      colors: [red, green, blue],
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
    const { breaks, colors, mode } = getNodesAnalysisSymbolization(store);
    expect(breaks).toEqual([20, 30]);
    expect(colors).toEqual([red, "#123456", blue]);
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
      breaks: [20, 30],
      colors: [red, green, blue],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal intervals/i }));

    const { mode, breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(mode).toEqual("equalIntervals");
    expect(breaks).toEqual([20, 30]);
    expect(colors).toEqual([red, green, blue]);
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
      property: "pressure",
      colors: [red, green, blue],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    const { mode, breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(mode).toEqual("equalQuantiles");
    expect(breaks).toEqual([15, 20]);
    expect(colors).toEqual([red, green, blue]);
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
      property: "pressure",
      mode: "prettyBreaks",
      breaks: [20, 40],
      colors: [red, green, blue],
    });

    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /manual/i }));

    const { mode, breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(mode).toEqual("manual");
    expect(breaks).toEqual([50, 75]);
    expect(colors).toEqual([red, green, blue]);
  });

  it("can apply different ramp color", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "prettyBreaks",
      breaks: [2, 3],
      colors: [red, green, blue],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
    await user.click(screen.getByTitle("OrRd"));

    const { mode, colors, breaks } = getNodesAnalysisSymbolization(store);
    expect(mode).toEqual("prettyBreaks");
    expect(breaks).toEqual([2, 3]);
    expect(colors).toEqual([
      "rgb(254,232,200)",
      "rgb(253,187,132)",
      "rgb(227,74,51)",
    ]);
  });

  it("can prepend breaks", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      mode: "equalQuantiles",
      breaks: [10, 20],
      colors: [red, green, blue],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getAllByRole("button", { name: /add break/i })[0]);

    const firstState = getNodesAnalysisSymbolization(store);
    expect(firstState.breaks).toEqual([0, 10, 20]);
    expect(firstState.colors).toEqual([defaultNewColor, red, green, blue]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getAllByRole("button", { name: /add break/i })[0]);

    const secondState = getNodesAnalysisSymbolization(store);
    expect(secondState.breaks).toEqual([-1, 0, 10, 20]);
    expect(secondState.colors).toEqual([
      defaultNewColor,
      defaultNewColor,
      red,
      green,
      blue,
    ]);

    await user.click(screen.getByRole("button", { name: /delete 0/i }));

    const thirdState = getNodesAnalysisSymbolization(store);
    expect(thirdState.breaks).toEqual([0, 10, 20]);
    expect(thirdState.colors).toEqual([defaultNewColor, red, green, blue]);

    await user.click(screen.getByRole("button", { name: /delete 0/i }));

    const forthState = getNodesAnalysisSymbolization(store);
    expect(forthState.breaks).toEqual([10, 20]);
    expect(forthState.colors).toEqual([red, green, blue]);
  });

  it("can append breaks", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      breaks: [10, 20],
      colors: [red, green, blue],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getAllByRole("button", { name: /add break/i })[1]);

    const firstState = getNodesAnalysisSymbolization(store);
    expect(firstState.breaks).toEqual([10, 20, 21]);
    expect(firstState.colors).toEqual([red, green, blue, defaultNewColor]);
    expect(firstState.mode).toEqual("manual");

    await user.click(screen.getAllByRole("button", { name: /add break/i })[1]);

    const secondState = getNodesAnalysisSymbolization(store);
    expect(secondState.breaks).toEqual([10, 20, 21, 22]);
    expect(secondState.colors).toEqual([
      red,
      green,
      blue,
      defaultNewColor,
      defaultNewColor,
    ]);
  });

  it("can delete a break", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      colors: [red, green, blue, white],
      breaks: [2, 3, 4],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("button", { name: /delete 1/i }));

    const { breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(breaks).toEqual([2, 4]);
    expect(colors).toEqual([red, green, white]);
  });

  it("can reverse colors", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      breaks: [2, 3],
      colors: [red, green, blue],
    });
    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
    await user.click(screen.getByRole("button", { name: /reverse colors/i }));

    const { breaks, colors, reversedRamp } =
      getNodesAnalysisSymbolization(store);
    expect(breaks).toEqual([2, 3]);
    expect(colors).toEqual([blue, green, red]);
    expect(reversedRamp).toEqual(true);
  });

  it("can choose a ramp with more values", async () => {
    const user = userEvent.setup();
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction("j1", { simulation: { pressure: 10 } })
      .aJunction("j2", { simulation: { pressure: 15 } })
      .aJunction("j3", { simulation: { pressure: 100 } })
      .build();
    const nodesAnalysis = aNodesAnalysis({
      mode: "prettyBreaks",
      breaks: [20, 30],
      colors: [red, green, blue],
    });
    const store = setInitialState({ hydraulicModel, nodesAnalysis });

    renderComponent({ store });

    expect(
      screen.getByRole("combobox", { name: /classes/i }),
    ).toHaveTextContent("3");

    await user.click(screen.getByRole("combobox", { name: /classes/i }));
    await user.click(screen.getByRole("option", { name: /4/ }));

    const { breaks, colors } = getNodesAnalysisSymbolization(store);
    expect(breaks).toEqual([25, 50, 75]);
    expect(colors.length).toEqual(4);
  });

  it("shows an error when range not in order", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      breaks: [10, 20, 30],
      colors: [white, red, green, blue],
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
    const firstState = getNodesAnalysisSymbolization(store);
    expect(firstState.breaks[1]).toEqual(20);
    expect(screen.getByText(/ascending order/i)).toBeInTheDocument();

    field = screen.getByRole("textbox", {
      name: /value for: break 2/i,
    });
    await user.click(field);
    await user.clear(field);
    await user.type(field, "110");
    await user.keyboard("{Enter}");

    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
    const secondState = getNodesAnalysisSymbolization(store);
    expect(secondState.breaks[1]).toEqual(100);
    expect(secondState.breaks[2]).toEqual(110);

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
      breaks: [20, 30],
      colors: [red, green, blue],
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
      breaks: [20, 30],
      colors: [red, green, blue],
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
      breaks: [20, 30],
      colors: [red, green, blue],
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
      breaks: [20, 30],
      colors: [red, green, blue],
      absValues: true,
    });

    const store = setInitialState({ linksAnalysis, hydraulicModel });

    renderComponent({ store, geometryType: "links" });

    await user.click(screen.getByRole("combobox", { name: /Mode/i }));
    await user.click(screen.getByRole("option", { name: /equal quantiles/i }));

    const firstState = getLinksAnalysisSymbolization(store);
    expect(firstState.breaks).toEqual([15, 20]);

    const field = screen.getByRole("textbox", {
      name: /value for: break 0/i,
    });
    await user.click(field);
    expect(field).toHaveValue("15");
    await user.clear(field);
    await user.type(field, "-14");
    await user.keyboard("{Enter}");

    const secondState = getLinksAnalysisSymbolization(store);
    expect(secondState.breaks).toEqual([14, 20]);
    expect(secondState.colors).toEqual([red, green, blue]);
  });

  it("preserves nodes settings for later", async () => {
    const user = userEvent.setup();
    const nodesAnalysis = aNodesAnalysis({
      property: "pressure",
      rampName: "Temps",
    });

    const store = setInitialState({ nodesAnalysis });

    renderComponent({ store });

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
    await user.click(screen.getByTitle("OrRd"));

    expect(screen.queryByText(/not enough data/)).not.toBeInTheDocument();
    const savedAnalyses = store.get(savedAnalysesAtom);
    expect(savedAnalyses.get("pressure")).toMatchObject({
      symbolization: { rampName: "OrRd" },
    });
  });

  it("preserves links settings for later", async () => {
    const user = userEvent.setup();
    const linksAnalysis = aLinksAnalysis({
      property: "flow",
      rampName: "Temps",
    });

    const store = setInitialState({ linksAnalysis });

    renderComponent({ store, geometryType: "links" });

    await user.click(screen.getByRole("combobox", { name: /ramp select/i }));
    await user.click(screen.getByTitle("OrRd"));

    expect(screen.queryByText(/not enough data/)).not.toBeInTheDocument();
    const savedAnalyses = store.get(savedAnalysesAtom);
    expect(savedAnalyses.get("flow")).toMatchObject({
      symbolization: { rampName: "OrRd" },
    });
  });

  const getNodesAnalysisSymbolization = (store: Store): SymbolizationRamp => {
    return (store.get(nodesAnalysisAtom) as PropertyAnalysis).symbolization;
  };

  const getLinksAnalysisSymbolization = (store: Store): SymbolizationRamp => {
    return (store.get(linksAnalysisAtom) as PropertyAnalysis).symbolization;
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
