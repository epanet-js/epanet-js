import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisSettingsPanel } from "./analysis-settings";
import userEvent from "@testing-library/user-event";
import { PropertyAnalysis } from "src/analysis/analysis-types";
import {
  aLinksAnalysis,
  aNodesAnalysis,
  aSimulationSuccess,
  setInitialState,
} from "src/__helpers__/state";
import { colorFor } from "src/analysis/symbolization-ramp";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import {
  AnalysesMap,
  linksAnalysisAtom,
  nodesAnalysisAtom,
  savedAnalysesAtom,
} from "src/state/analysis";

describe("Analysis Settings Panel", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_MEMORIZE");
  });

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

    const nodesAnalysis = store.get(nodesAnalysisAtom) as PropertyAnalysis;
    expect(nodesAnalysis.type).toEqual("pressure");
    expect(colorFor(nodesAnalysis.symbolization, 10)).not.toBeUndefined();
    expect(nodesAnalysis.symbolization.property).toEqual("pressure");
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

    const linksAnalysis = store.get(linksAnalysisAtom) as PropertyAnalysis;
    expect(linksAnalysis.type).toEqual("flow");
    expect(colorFor(linksAnalysis.symbolization, 10)).not.toBeUndefined();
    expect(linksAnalysis.symbolization.property).toEqual("flow");

    expect(screen.getByRole("combobox", { name: /links/i })).toHaveTextContent(
      "Flow",
    );
  });

  it("uses a previous links analysis when available", async () => {
    const simulation = aSimulationSuccess();
    const previousFlowAnalysis = aLinksAnalysis({
      property: "flow",
      rampName: "PREVIOUS",
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousFlowAnalysis.type, previousFlowAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    await userEvent.click(screen.getByText(/flow/i));

    const linksAnalysis = store.get(linksAnalysisAtom) as PropertyAnalysis;
    expect(linksAnalysis.type).toEqual("flow");
    expect(linksAnalysis.symbolization.rampName).toEqual("PREVIOUS");
  });

  it("uses a previous nodes analysis when available", async () => {
    const simulation = aSimulationSuccess();
    const previousAnalysis = aNodesAnalysis({
      property: "pressure",
      rampName: "PREVIOUS",
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousAnalysis.type, previousAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    await userEvent.click(screen.getByText(/pressure/i));

    const nodesAnalysis = store.get(nodesAnalysisAtom) as PropertyAnalysis;
    expect(nodesAnalysis.type).toEqual("pressure");
    expect(nodesAnalysis.symbolization.rampName).toEqual("PREVIOUS");
  });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <AnalysisSettingsPanel />
      </JotaiProvider>,
    );
  };
});
