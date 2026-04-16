import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandContainer } from "./__helpers__/command-container";
import { SimulationState, simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import {
  createMockResultsReader,
  setInitialState,
} from "src/__helpers__/state";
import { useChangeTimestep } from "./change-timestep";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";

vi.mock("src/infra/storage/opfs-storage", () => ({
  OPFSStorage: vi.fn(),
}));

const initialResultsReader = createMockResultsReader();
const nextResultsReader = createMockResultsReader();
const mockGetResultsForTimestep = vi.fn().mockResolvedValue(nextResultsReader);

vi.mock("src/simulation/epanet/eps-results-reader", () => ({
  EPSResultsReader: vi
    .fn()
    .mockImplementation((_storage, timestepCount = 0) => ({
      initialize: vi.fn(),
      getResultsForTimestep: mockGetResultsForTimestep,
      timestepCount,
    })),
}));

describe("useChangeTimestep", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("changeTimestep", () => {
    it("resets simulation state when the current step is unknown", async () => {
      const store = setInitialState({
        simulation: { status: "idle" },
        simulationStep: null,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: 1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(store.get(simulationDerivedAtom).status).toBe("idle");
        expect(store.get(simulationStepAtom)).toBeNull();
      });
    });

    it("clamps a negative timestep index to 0", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: -1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
      });
    });

    it("clamps a timestep index beyond the last to the last", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: 5 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
      });
    });

    it("updates step when valid", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: 3 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(3);
        expect(store.get(simulationStepAtom)).toBe(3);
      });
    });

    it("allows changing to timestep 0", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: 0 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
      });
    });

    it("allows changing to last timestep", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store, targetTimestep: 4 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
      });
    });
  });

  describe("goToPreviousTimestep", () => {
    it("decrements the current step", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(1);
        expect(store.get(simulationStepAtom)).toBe(1);
      });
    });

    it("clamps to 0 when already at the first step", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 0,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
      });
    });
  });

  describe("goToNextTimestep", () => {
    it("increments the current step", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 2,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(3);
        expect(store.get(simulationStepAtom)).toBe(3);
      });
    });

    it("clamps to the last step when already at the last step", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5 }),
        simulationStep: 4,
        simulationResults: initialResultsReader,
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
      });
    });
  });

  const TestableComponent = ({
    targetTimestep,
  }: {
    targetTimestep: number;
  }) => {
    const { changeTimestep, goToPreviousTimestep, goToNextTimestep } =
      useChangeTimestep();

    return (
      <>
        <button
          aria-label="go"
          onClick={() => void changeTimestep(targetTimestep, "dropdown")}
        >
          Go
        </button>
        <button
          aria-label="previous"
          onClick={() => void goToPreviousTimestep()}
        >
          Previous
        </button>
        <button aria-label="next" onClick={() => void goToNextTimestep()}>
          Next
        </button>
      </>
    );
  };

  const renderComponent = ({
    store,
    targetTimestep = 0,
  }: {
    store: Store;
    targetTimestep?: number;
  }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent targetTimestep={targetTimestep} />
      </CommandContainer>,
    );
  };

  const aSuccessSimulation = ({
    timestepCount,
  }: {
    timestepCount: number;
  }): SimulationState => {
    return {
      status: "success",
      report: "REPORT",
      modelVersion: "1",
      settingsVersion: "",
      epsResultsReader: new (EPSResultsReader as unknown as new (
        storage: unknown,
        timestepCount: number,
      ) => EPSResultsReader)(undefined, timestepCount),
    };
  };
});
