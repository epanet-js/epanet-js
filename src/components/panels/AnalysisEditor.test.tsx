import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisEditor } from "./AnalysisEditor";
import userEvent from "@testing-library/user-event";
import { analysisAtom } from "src/state/analysis";
import { FlowsAnalysis } from "src/analysis";
import { PressureAnalysis } from "src/analysis/analysis-types";

describe("Analysis Editor", () => {
  it("displays nodes analysis options", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    expect(screen.getByRole("combobox", { name: /nodes/i })).toHaveTextContent(
      "None",
    );
    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    expect(screen.getByText("Pressure")).toBeInTheDocument();
  });

  it("can change nodes analysis", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    await userEvent.click(screen.getByText("Pressure"));

    const { nodes } = store.get(analysisAtom);
    const nodesAnalysis = nodes as PressureAnalysis;
    expect(nodesAnalysis.type).toEqual("pressure");
    expect(nodesAnalysis.rangeColorMapping.colorFor(10)).not.toBeUndefined();
    expect(nodesAnalysis.rangeColorMapping.symbolization).toEqual(
      expect.objectContaining({
        type: "ramp",
        property: "pressure",
      }),
    );
  });

  it("displays link analysis options", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    expect(screen.getByRole("combobox", { name: /links/i })).toHaveTextContent(
      "None",
    );
    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    expect(screen.getByText("Flows")).toBeInTheDocument();
    expect(screen.getByText("Velocities")).toBeInTheDocument();
  });

  it("can change link analysis", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    await userEvent.click(screen.getByText(/flows/i));

    const { links } = store.get(analysisAtom);
    const linksAnalysis = links as FlowsAnalysis;
    expect(linksAnalysis.type).toEqual("flows");
    expect(linksAnalysis.rangeColorMapping.colorFor(10)).not.toBeUndefined();
    expect(linksAnalysis.rangeColorMapping.symbolization).toEqual(
      expect.objectContaining({
        type: "ramp",
        property: "flow",
      }),
    );

    expect(screen.getByRole("combobox", { name: /links/i })).toHaveTextContent(
      "Flows",
    );
  });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <AnalysisEditor />
      </JotaiProvider>,
    );
  };
});
