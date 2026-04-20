import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandContainer } from "./__helpers__/command-container";
import { SimulationState, simulationStepAtom } from "src/state/simulation";
import {
  simulationDerivedAtom,
  simulationResultsDerivedAtom,
} from "src/state/derived-branch-state";
import { Store } from "src/state";
import { setInitialState } from "src/__helpers__/state";
import { useChangeTimestep } from "./change-timestep";
import { useAtomValue } from "jotai";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import { createMockResultsReader } from "src/__helpers__/state";

vi.mock("src/infra/storage/opfs-storage", () => ({
  OPFSStorage: vi.fn(),
}));

const initialResultsReader = createMockResultsReader();
const nextResultsReader = createMockResultsReader();
const mockGetResultsForTimestep = vi.fn();

vi.mock("src/simulation/epanet/eps-results-reader", () => ({
  EPSResultsReader: vi
    .fn()
    .mockImplementation((_storage, timestepCount = 0) => ({
      initialize: vi.fn(),
      getResultsForTimestep: mockGetResultsForTimestep,
      dispose: vi.fn().mockResolvedValue(undefined),
      timestepCount,
    })),
}));

describe("useChangeTimestep", () => {
  beforeEach(() => {
    mockGetResultsForTimestep
      .mockResolvedValueOnce(initialResultsReader)
      .mockResolvedValue(nextResultsReader);
  });

  afterEach(() => {
    mockGetResultsForTimestep.mockReset();
  });

  describe("changeTimestep", () => {
    it("resets simulation state when no simulation results are available", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: { status: "idle" },
      });
      renderComponent({ store, targetTimestep: 1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(store.get(simulationDerivedAtom).status).toBe("idle");
        expect(store.get(simulationStepAtom)).toBeNull();
        expect(store.get(simulationResultsDerivedAtom)).toBe(null);
      });
    });

    it("clamps a negative timestep index to 0", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store, targetTimestep: -1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("clamps a timestep index beyond the last to the last", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store, targetTimestep: 5 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("updates step when valid", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store, targetTimestep: 3 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(3);
        expect(store.get(simulationStepAtom)).toBe(3);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("allows changing to timestep 0", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store, targetTimestep: 0 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("allows changing to last timestep", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store, targetTimestep: 4 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });
  });

  describe("goToPreviousTimestep", () => {
    it("decrements the current step", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(1);
        expect(store.get(simulationStepAtom)).toBe(1);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("clamps to 0 when already at the first step", async () => {
      const store = setInitialState({
        simulationStep: 0,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(0);
        expect(store.get(simulationStepAtom)).toBe(0);
        // Step didn't change so derived atom doesn't recompute — results stay as initial
        expect(store.get(simulationResultsDerivedAtom)).toBe(
          initialResultsReader,
        );
      });
    });
  });

  describe("goToNextTimestep", () => {
    it("increments the current step", async () => {
      const store = setInitialState({
        simulationStep: 2,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(3);
        expect(store.get(simulationStepAtom)).toBe(3);
        expect(store.get(simulationResultsDerivedAtom)).toBe(nextResultsReader);
      });
    });

    it("clamps to the last step when already at the last step", async () => {
      const store = setInitialState({
        simulationStep: 4,
        simulation: aSuccessSimulation({ timestepCount: 5 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenLastCalledWith(4);
        expect(store.get(simulationStepAtom)).toBe(4);
        // Step didn't change so derived atom doesn't recompute — results stay as initial
        expect(store.get(simulationResultsDerivedAtom)).toBe(
          initialResultsReader,
        );
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
    useAtomValue(simulationResultsDerivedAtom);

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
