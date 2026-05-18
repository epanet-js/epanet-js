import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mode, modeAtom } from "src/state/mode";
import { Store } from "src/state";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { CommandContainer } from "./__helpers__/command-container";
import { useStartProfileSelection } from "./start-profile-selection";

describe("useStartProfileSelection", () => {
  it("enters hgl-profile mode when simulation results are available", async () => {
    const store = setInitialState({
      simulationResults: createMockResultsReader(),
    });

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  it("enters hgl-profile mode even when no simulation has run", async () => {
    const store = setInitialState({});

    renderComponent({ store });

    await userEvent.click(screen.getByRole("button", { name: "start" }));

    expect(store.get(modeAtom).mode).toBe(Mode.HGL_PROFILE);
  });

  const TestableComponent = () => {
    const start = useStartProfileSelection();

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
