import { CommandContainer } from "src/commands/__helpers__/command-container";
import { aNodesAnalysis, setInitialState } from "src/__helpers__/state";
import { screen, render } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { SymbolizationDialog } from "./symbolization-dialog";
import { Dialog } from "@radix-ui/react-dialog";

describe("symbolization dialog", () => {
  it("shows the property being changed", () => {
    const red = "#ff0000";
    const green = "#00ff00";
    const blue = "#0000ff";

    const nodesAnalysis = aNodesAnalysis({
      property: "pressure",
      stops: [
        { input: 10, output: red },
        { input: 20, output: green },
        { input: 30, output: blue },
      ],
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
