import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisEditor } from "./AnalysisEditor";
import userEvent from "@testing-library/user-event";
import { PressuresAnalysis, analysisAtom } from "src/state/analysis";

describe("Analysis Editor", () => {
  it("can change the analysis for nodes", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    expect(screen.getByText("Nodes analysis")).toBeInTheDocument();
    expect(
      isSelected(screen.getByRole("option", { name: "None" })),
    ).toBeTruthy();

    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "Pressures" }),
    );
    expect(
      isSelected(screen.getByRole("option", { name: "Pressures" })),
    ).toBeTruthy();

    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "None" }),
    );

    expect(
      isSelected(screen.getByRole("option", { name: "None" })),
    ).toBeTruthy();

    expect(document.activeElement).not.toBe(screen.getByRole("combobox"));
  });

  it("applies a default symbolizaton when choosing pressures", async () => {
    const store = getDefaultStore();
    renderComponent(store);

    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "Pressures" }),
    );

    const { nodes } = store.get(analysisAtom);
    const nodesAnalysis = nodes as PressuresAnalysis;
    expect(nodesAnalysis.type).toEqual("pressures");
    expect(nodesAnalysis?.symbolization).toEqual(
      expect.objectContaining({
        type: "ramp",
      }),
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

const isSelected = (element: HTMLElement): boolean => {
  return (element as HTMLOptionElement).selected;
};
