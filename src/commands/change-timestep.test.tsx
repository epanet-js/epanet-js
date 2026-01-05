import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandContainer } from "./__helpers__/command-container";
import { Store, simulationAtom, SimulationState } from "src/state/jotai";
import { setInitialState } from "src/__helpers__/state";
import { useChangeTimestep } from "./change-timestep";
import {
  PROLOG_SIZE,
  EPILOG_SIZE,
} from "src/simulation/epanet/simulation-metadata";

vi.mock("src/infra/storage/opfs-storage", () => ({
  OPFSStorage: vi.fn(),
}));

const mockGetResultsForTimestep = vi.fn().mockResolvedValue({
  getNodeResult: vi.fn(),
  getLinkResult: vi.fn(),
});

vi.mock("src/simulation/epanet/eps-results-reader", () => ({
  EPSResultsReader: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getResultsForTimestep: mockGetResultsForTimestep,
  })),
}));

describe("useChangeTimestep", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("changeTimestep", () => {
    it("does nothing when simulation status is idle", async () => {
      const store = setInitialState({
        simulation: { status: "idle" },
      });
      renderComponent({ store, targetTimestep: 1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(store.get(simulationAtom).status).toBe("idle");
      });
    });

    it("does nothing when simulation status is running", async () => {
      const store = setInitialState({
        simulation: { status: "running" },
      });
      renderComponent({ store, targetTimestep: 1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(store.get(simulationAtom).status).toBe("running");
      });
    });

    it("does nothing when timestep index is negative", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store, targetTimestep: -1 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(2);
      });
    });

    it("does nothing when timestep index exceeds available timesteps", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store, targetTimestep: 5 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(2);
      });
    });

    it("updates timestep index when valid", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store, targetTimestep: 3 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(3);
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(3);
      });
    });

    it("allows changing to timestep 0", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store, targetTimestep: 0 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(0);
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(0);
      });
    });

    it("allows changing to last timestep", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store, targetTimestep: 4 });

      await userEvent.click(screen.getByRole("button", { name: "go" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(4);
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(4);
      });
    });
  });

  describe("goToPreviousTimestep", () => {
    it("decrements the current timestep index", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(1);
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(1);
      });
    });

    it("does nothing when already at first timestep", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 0 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "previous" }));

      await waitFor(() => {
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(0);
      });
    });
  });

  describe("goToNextTimestep", () => {
    it("increments the current timestep index", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 2 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        expect(mockGetResultsForTimestep).toHaveBeenCalledWith(3);
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(3);
      });
    });

    it("does nothing when already at last timestep", async () => {
      const store = setInitialState({
        simulation: aSuccessSimulation({ timestepCount: 5, currentIndex: 4 }),
      });
      renderComponent({ store });

      await userEvent.click(screen.getByRole("button", { name: "next" }));

      await waitFor(() => {
        const simulation = store.get(simulationAtom) as SimulationState & {
          currentTimestepIndex: number;
        };
        expect(simulation.currentTimestepIndex).toBe(4);
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
    currentIndex,
  }: {
    timestepCount: number;
    currentIndex: number;
  }): SimulationState => {
    return {
      status: "success",
      report: "REPORT",
      modelVersion: "1",
      metadata: createMetadataBuffer(timestepCount),
      simulationIds: {
        nodeIds: [],
        linkIds: [],
        nodeIdToIndex: new Map(),
        linkIdToIndex: new Map(),
      },
      currentTimestepIndex: currentIndex,
    };
  };

  const createMetadataBuffer = (timestepCount: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(PROLOG_SIZE + EPILOG_SIZE);
    const epilogView = new DataView(buffer, PROLOG_SIZE, EPILOG_SIZE);
    epilogView.setInt32(0, timestepCount, true);
    return buffer;
  };
});
