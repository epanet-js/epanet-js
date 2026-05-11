import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAtomValue } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useStartProfileSelection } from "./start-profile-selection";
import { ProfileSimulationToastGuard } from "src/components/profile-simulation-toast-guard";

describe("useStartProfileSelection", () => {
  it("enters profile-view mode when simulation results are available", async () => {
    const store = setInitialState({
      simulationResults: createMockResultsReader(),
    });

    renderComponent({ store });

    await waitFor(() => {
      expect(store.get(simulationResultsDerivedAtom)).not.toBeNull();
    });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(modeAtom).mode).toBe(Mode.PROFILE_VIEW);
    expect(screen.queryByText(/simulation required/i)).not.toBeInTheDocument();
  });

  it("shows a warning and does not enter mode when no simulation has run", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(await screen.findByText(/simulation required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/run a simulation first to view the profile/i),
    ).toBeInTheDocument();
    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });

  it("dismisses the warning toast once simulation results become available", async () => {
    const store = setInitialState({});

    render(
      <CommandContainer store={store}>
        <ProfileSimulationToastGuard />
        <TestableComponent />
      </CommandContainer>,
    );

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(await screen.findByText(/simulation required/i)).toBeInTheDocument();

    act(() => {
      setInitialState({ store, simulationResults: createMockResultsReader() });
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/simulation required/i),
      ).not.toBeInTheDocument();
    });
  });

  const TestableComponent = () => {
    const start = useStartProfileSelection();
    useAtomValue(simulationResultsDerivedAtom);

    return (
      <button aria-label="start" onClick={() => start({ source: "toolbar" })}>
        Start
      </button>
    );
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>,
    );
  };
});
