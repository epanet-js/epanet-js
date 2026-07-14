import { render, screen, within } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { Persistence } from "src/lib/persistence/persistence";
import { PersistenceContext } from "src/lib/persistence/context";
import { Store } from "src/state";
import { SimulationSettingsDialog } from "./simulation-settings-dialog";

const errorLabel = "This section has invalid values";

const renderDialog = (store: Store) => {
  const persistence = new Persistence(store);
  return render(
    <PersistenceContext.Provider value={persistence}>
      <JotaiProvider store={store}>
        <SimulationSettingsDialog />
      </JotaiProvider>
    </PersistenceContext.Provider>,
  );
};

const navButton = (name: RegExp) => screen.getByRole("button", { name });

describe("SimulationSettingsDialog sidebar warnings", () => {
  it("flags the Times section and blocks Save when a timestep is zero in EPS mode", () => {
    const store = setInitialState({
      simulationSettings: SimulationSettingsBuilder.with()
        .timing({ duration: 3600, hydraulicTimestep: 0 })
        .build(),
    });

    renderDialog(store);

    expect(
      within(navButton(/times/i)).getByLabelText(errorLabel),
    ).toBeInTheDocument();
    expect(
      within(navButton(/general/i)).queryByLabelText(errorLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save settings/i }),
    ).toBeDisabled();
  });

  it("flags Water quality and its Analysis subsection when a trace analysis has no node", () => {
    const store = setInitialState({
      simulationSettings: SimulationSettingsBuilder.with()
        .qualitySimulationType("trace")
        .qualityTraceNodeId(null)
        .build(),
    });

    renderDialog(store);

    expect(
      within(navButton(/water quality/i)).getByLabelText(errorLabel),
    ).toBeInTheDocument();
    expect(
      within(navButton(/^analysis/i)).getByLabelText(errorLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save settings/i }),
    ).toBeDisabled();
  });

  it("shows no warnings and keeps Save enabled when settings are valid", () => {
    const store = setInitialState({
      simulationSettings: SimulationSettingsBuilder.with().build(),
    });

    renderDialog(store);

    expect(screen.queryByLabelText(errorLabel)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save settings/i }),
    ).not.toBeDisabled();
  });
});
