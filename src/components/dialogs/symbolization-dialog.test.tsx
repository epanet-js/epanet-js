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
      name: /value for: step 1/i,
    });
    await user.click(field);
    await user.clear(field);
    await user.type(field, "22");
    await user.keyboard("{Enter}");

    expect(screen.queryByText(/ascending order/i)).not.toBeInTheDocument();
    stops = getUpdateNodesAnalysisSymbolization(store).stops;
    expect(stops[1].input).toEqual(22);
    expect(stops[1].output).toEqual(green);
  });

  it.only("can change the colors manually", async () => {
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
