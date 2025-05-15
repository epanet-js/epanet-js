import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisEditor } from "./analysis-editor";
import userEvent from "@testing-library/user-event";
import { analysisAtom } from "src/state/analysis";
import { FlowAnalysis, PropertyAnalysis } from "src/analysis/analysis-types";
import { aSimulationSuccess, setInitialState } from "src/__helpers__/state";

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

  it("disables node analysis that require a simulation", async () => {
    const store = setInitialState({ simulation: { status: "idle" } });
    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));

    expect(screen.getByRole("option", { name: /pressure/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables link analysis that require a simulation", async () => {
    const store = setInitialState({ simulation: { status: "idle" } });
    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));

    expect(screen.getByRole("option", { name: /flow/i })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("can change nodes analysis", async () => {
    const store = setInitialState({ simulation: aSimulationSuccess() });

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    await userEvent.click(screen.getByText("Pressure"));

    const { nodes } = store.get(analysisAtom);
    const nodesAnalysis = nodes as PropertyAnalysis;
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
    expect(screen.getByText("Flow (Abs.)")).toBeInTheDocument();
    expect(screen.getByText("Velocity")).toBeInTheDocument();
  });

  it("can change link analysis", async () => {
    const store = setInitialState({ simulation: aSimulationSuccess() });

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    await userEvent.click(screen.getByText(/flow/i));

    const { links } = store.get(analysisAtom);
    const linksAnalysis = links as FlowAnalysis;
    expect(linksAnalysis.type).toEqual("flow");
    expect(linksAnalysis.rangeColorMapping.colorFor(10)).not.toBeUndefined();
    expect(linksAnalysis.rangeColorMapping.symbolization).toEqual(
      expect.objectContaining({
        type: "ramp",
        property: "flow",
      }),
    );

    expect(screen.getByRole("combobox", { name: /links/i })).toHaveTextContent(
      "Flow",
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
