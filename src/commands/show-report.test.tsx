import { Store } from "src/state/jotai";
import { screen, render } from "@testing-library/react";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { CommandContainer } from "./__helpers__/command-container";
import { useShowReport } from "./show-report";
import userEvent from "@testing-library/user-event";
import { aSimulationFailure, setInitialState } from "src/__helpers__/state";

describe("show report", () => {
  it("shows the report", async () => {
    const simulation = aSimulationFailure();
    const store = setInitialState({ simulation });
    renderComponent({ store });

    await triggerCommand();

    expect(screen.getByText(/report/i)).toBeInTheDocument();
  });

  it("tracks a user event", async () => {
    const userTracking = stubUserTracking();
    const simulation = aSimulationFailure();
    const store = setInitialState({ simulation });
    renderComponent({ store });

    await triggerCommand();

    expect(userTracking.capture).toHaveBeenCalledWith({
      name: "report.opened",
      source: "toolbar",
      status: "failure",
    });
  });

  const triggerCommand = async () => {
    await userEvent.click(screen.getByRole("button", { name: "showReport" }));
  };

  const TestableComponent = () => {
    const showReport = useShowReport();

    return (
      <button
        aria-label="showReport"
        onClick={() => showReport({ source: "toolbar" })}
      >
        Show
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
