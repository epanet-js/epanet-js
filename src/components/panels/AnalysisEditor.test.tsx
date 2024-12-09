import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import { Store } from "src/state/jotai";
import { AnalysisEditor } from "./AnalysisEditor";
import userEvent from "@testing-library/user-event";
import { analysisAtom } from "src/state/analysis";

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
    expect(store.get(analysisAtom).nodes).toEqual("pressures");

    await userEvent.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "None" }),
    );

    expect(store.get(analysisAtom).nodes).toEqual("none");
    expect(
      isSelected(screen.getByRole("option", { name: "None" })),
    ).toBeTruthy();
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
