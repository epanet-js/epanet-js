import { render, screen, within } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisEditor } from "./AnalysisEditor";
import userEvent from "@testing-library/user-event";
import { analysisAtom } from "src/state/analysis";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { FlowsAnalysis, PressuresAnalysis } from "src/analysis";

describe("Analysis Editor", () => {
  it("can change the analysis for nodes", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    expect(screen.getByText("Nodes analysis")).toBeInTheDocument();
    expect(
      isSelected(
        within(getNodesAnalysisSelector()).getByRole("option", {
          name: "None",
        }),
      ),
    ).toBeTruthy();

    await userEvent.selectOptions(
      getNodesAnalysisSelector(),
      within(getNodesAnalysisSelector()).getByRole("option", {
        name: "Pressures",
      }),
    );
    expect(
      isSelected(
        within(getNodesAnalysisSelector()).getByRole("option", {
          name: "Pressures",
        }),
      ),
    ).toBeTruthy();

    await userEvent.selectOptions(
      getNodesAnalysisSelector(),
      within(getNodesAnalysisSelector()).getByRole("option", { name: "None" }),
    );

    expect(
      isSelected(
        within(getNodesAnalysisSelector()).getByRole("option", {
          name: "None",
        }),
      ),
    ).toBeTruthy();

    expect(document.activeElement).not.toBe(getNodesAnalysisSelector());
  });

  it("can change the analysis for links", async () => {
    stubFeatureOn("FLAG_FLOWS");
    const store = getDefaultStore();
    renderComponent(store);

    expect(screen.getByText("Links analysis")).toBeInTheDocument();
    expect(
      isSelected(
        within(getLinksAnalysisSelector()).getByRole("option", {
          name: "None",
        }),
      ),
    ).toBeTruthy();

    await userEvent.selectOptions(
      getLinksAnalysisSelector(),
      within(getLinksAnalysisSelector()).getByRole("option", { name: "Flows" }),
    );
    expect(
      isSelected(screen.getByRole("option", { name: "Flows" })),
    ).toBeTruthy();

    await userEvent.selectOptions(
      getLinksAnalysisSelector(),
      within(getLinksAnalysisSelector()).getByRole("option", { name: "None" }),
    );

    expect(
      isSelected(
        within(getLinksAnalysisSelector()).getByRole("option", {
          name: "None",
        }),
      ),
    ).toBeTruthy();

    expect(document.activeElement).not.toBe(getLinksAnalysisSelector());
  });

  it("applies a default symbolizaton when choosing pressures", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    await userEvent.selectOptions(
      getNodesAnalysisSelector(),
      within(getNodesAnalysisSelector()).getByRole("option", {
        name: "Pressures",
      }),
    );

    const { nodes } = store.get(analysisAtom);
    const nodesAnalysis = nodes as PressuresAnalysis;
    expect(nodesAnalysis.type).toEqual("pressures");
    expect(nodesAnalysis.rangeColorMapping.colorFor(10)).not.toBeUndefined();
    expect(nodesAnalysis.rangeColorMapping.symbolization).toEqual(
      expect.objectContaining({
        type: "ramp",
        property: "pressure",
      }),
    );
  });

  it("applies a default symbolizaton when choosing flows", async () => {
    stubFeatureOn("FLAG_FLOWS");
    const store = getDefaultStore();
    renderComponent(store);

    await userEvent.selectOptions(
      getLinksAnalysisSelector(),
      within(getLinksAnalysisSelector()).getByRole("option", {
        name: "Flows",
      }),
    );

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
  });

  const getNodesAnalysisSelector = () =>
    screen.getByRole("combobox", {
      name: /nodes/i,
    });

  const getLinksAnalysisSelector = () =>
    screen.getByRole("combobox", {
      name: /links/i,
    });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <AnalysisEditor />
      </JotaiProvider>,
    );
  };
});

const isSelected = (element: HTMLElement): boolean => {
  return (element as HTMLOptionElement).selected;
};
