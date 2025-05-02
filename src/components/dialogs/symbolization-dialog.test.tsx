import { CommandContainer } from "src/commands/__helpers__/command-container";
import { aSymbolization, setInitialState } from "src/__helpers__/state";
import { screen, render } from "@testing-library/react";
import { Store } from "src/state/jotai";
import { SymbolizationDialog } from "./symbolization-dialog";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { NodesAnalysis } from "src/analysis";
import { Dialog } from "@radix-ui/react-dialog";

describe("symbolization dialog", () => {
  it("shows the property being changed", () => {
    const nodesAnalysis: NodesAnalysis = {
      type: "pressures",
      rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
        aSymbolization({ property: "pressure" }),
      ),
    };
    const store = setInitialState({ nodesAnalysis });
    renderComponent({ store });

    expect(screen.getByText(/Pressure \(m\)/)).toBeInTheDocument();
  });

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
