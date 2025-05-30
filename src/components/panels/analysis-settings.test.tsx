import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisSettingsPanel } from "./analysis-settings";
import userEvent from "@testing-library/user-event";
import { PropertyAnalysis } from "src/analysis/analysis-types";
import {
  aLinkSymbology,
  aNodeSymbology,
  aSimulationSuccess,
  setInitialState,
} from "src/__helpers__/state";
import { colorFor } from "src/analysis/range-symbology";
import {
  AnalysesMap,
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedAnalysesAtom,
} from "src/state/analysis";

describe("Analysis Settings Panel", () => {
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

    const nodeSymbology = store.get(nodeSymbologyAtom) as PropertyAnalysis;
    expect(nodeSymbology.type).toEqual("pressure");
    expect(colorFor(nodeSymbology.colorRule, 10)).not.toBeUndefined();
    expect(nodeSymbology.colorRule.property).toEqual("pressure");
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

    const linkSymbology = store.get(linkSymbologyAtom) as PropertyAnalysis;
    expect(linkSymbology.type).toEqual("flow");
    expect(colorFor(linkSymbology.colorRule, 10)).not.toBeUndefined();
    expect(linkSymbology.colorRule.property).toEqual("flow");

    expect(screen.getByRole("combobox", { name: /links/i })).toHaveTextContent(
      "Flow",
    );
  });

  it("uses a previous links analysis when available", async () => {
    const simulation = aSimulationSuccess();
    const previousFlowAnalysis = aLinkSymbology({
      symbology: { property: "flow", rampName: "PREVIOUS" },
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousFlowAnalysis.type, previousFlowAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    await userEvent.click(screen.getByText(/flow/i));

    const linkSymbology = store.get(linkSymbologyAtom) as PropertyAnalysis;
    expect(linkSymbology.type).toEqual("flow");
    expect(linkSymbology.colorRule.rampName).toEqual("PREVIOUS");
  });

  it("uses a previous nodes analysis when available", async () => {
    const simulation = aSimulationSuccess();
    const previousAnalysis = aNodeSymbology({
      symbology: {
        property: "pressure",
        rampName: "PREVIOUS",
      },
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousAnalysis.type, previousAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    await userEvent.click(screen.getByText(/pressure/i));

    const nodeSymbology = store.get(nodeSymbologyAtom) as PropertyAnalysis;
    expect(nodeSymbology.type).toEqual("pressure");
    expect(nodeSymbology.colorRule.rampName).toEqual("PREVIOUS");
  });

  it("can show and hide labels for nodes", async () => {
    const simulation = aSimulationSuccess();
    const previousAnalysis = aNodeSymbology({
      symbology: {
        property: "pressure",
        rampName: "PREVIOUS",
      },
      label: null,
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousAnalysis.type, previousAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /nodes/i }));
    await userEvent.click(screen.getByText(/pressure/i));

    let nodeSymbology = store.get(nodeSymbologyAtom) as PropertyAnalysis;
    expect(nodeSymbology.type).toEqual("pressure");
    expect(nodeSymbology.colorRule.rampName).toEqual("PREVIOUS");

    await userEvent.click(
      screen.getAllByRole("checkbox", { name: /show labels/i })[0],
    );

    nodeSymbology = store.get(nodeSymbologyAtom) as PropertyAnalysis;
    expect(nodeSymbology.colorRule.rampName).toEqual("PREVIOUS");
    expect(nodeSymbology.label).toEqual("pressure");

    await userEvent.click(
      screen.getAllByRole("checkbox", { name: /show labels/i })[0],
    );

    nodeSymbology = store.get(nodeSymbologyAtom) as PropertyAnalysis;
    expect(nodeSymbology.colorRule.rampName).toEqual("PREVIOUS");
    expect(nodeSymbology.label).toEqual(null);
  });

  it("can show and hide labels for links", async () => {
    const simulation = aSimulationSuccess();
    const previousAnalysis = aLinkSymbology({
      symbology: {
        property: "flow",
        rampName: "PREVIOUS",
      },
      label: null,
    });
    const store = setInitialState({ simulation });
    const analysesMap: AnalysesMap = new Map();
    analysesMap.set(previousAnalysis.type, previousAnalysis);
    store.set(savedAnalysesAtom, analysesMap);

    renderComponent(store);

    await userEvent.click(screen.getByRole("combobox", { name: /links/i }));
    await userEvent.click(screen.getByText(/flow/i));

    let linkSymbology = store.get(linkSymbologyAtom) as PropertyAnalysis;
    expect(linkSymbology.type).toEqual("flow");
    expect(linkSymbology.colorRule.rampName).toEqual("PREVIOUS");

    await userEvent.click(
      screen.getAllByRole("checkbox", { name: /show labels/i })[0],
    );

    linkSymbology = store.get(linkSymbologyAtom) as PropertyAnalysis;
    expect(linkSymbology.colorRule.rampName).toEqual("PREVIOUS");
    expect(linkSymbology.label).toEqual("flow");

    await userEvent.click(
      screen.getAllByRole("checkbox", { name: /show labels/i })[0],
    );

    linkSymbology = store.get(linkSymbologyAtom) as PropertyAnalysis;
    expect(linkSymbology.colorRule.rampName).toEqual("PREVIOUS");
    expect(linkSymbology.label).toEqual(null);
  });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <AnalysisSettingsPanel />
      </JotaiProvider>,
    );
  };
});
