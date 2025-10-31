import { screen, render, waitFor } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import {
  SimulationFinished,
  Store,
  dataAtom,
  simulationAtom,
} from "src/state/jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import userEvent from "@testing-library/user-event";
import { useRunSimulation } from "./run-simulation";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { runSimulation as runSimulationInWorker } from "src/simulation/epanet/worker";
import { getPipe } from "src/hydraulic-model/assets-map";
vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("Run simulation", () => {
  beforeEach(() => {
    wireWebWorker();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists state the simulation when passes", async () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.r1)
      .aJunction(IDS.j1, { baseDemand: 1 })
      .aPipe(IDS.p1, { startNodeId: String(IDS.r1), endNodeId: String(IDS.j1) })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationAtom) as SimulationFinished;
      expect(simulation.status).toEqual("success");
      expect(simulation.report).not.toContain(/error/i);
      expect(simulation.modelVersion).toEqual(hydraulicModel.version);
    });

    const {
      hydraulicModel: { assets: updatedAssets },
    } = store.get(dataAtom);
    const pipe = getPipe(updatedAssets, String(IDS.p1));
    expect(pipe!.flow).toBeCloseTo(1);
  });

  it("persists the state when the simulation fails", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationAtom) as SimulationFinished;
      expect(simulation.status).toEqual("failure");
      expect(simulation.report).toContain("not enough");
      expect(simulation.modelVersion).toEqual(hydraulicModel.version);
    });
  });

  it("can show the report after a failure", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(screen.getByText(/with error/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /view report/i }));

    await waitFor(() => {
      expect(screen.getByText(/not enough/)).toBeInTheDocument();
    });
  });

  it("can show the report with warnings", async () => {
    const hydraulicModel = aSimulableModelWithWarnings();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(screen.getByText(/simulation with warnings/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /view report/i }));

    await waitFor(() => {
      expect(screen.getByText(/negative pressures/i)).toBeInTheDocument();
    });
  });

  it("can show the report after a success", async () => {
    const hydraulicModel = aSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /view report/i }));

    await waitFor(() => {
      expect(screen.getByText(/Page 1/)).toBeInTheDocument();
    });
  });

  it("can skip close with keyboard after success", async () => {
    const hydraulicModel = aSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    });
  });

  it("by default opens report on enter when failure", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(screen.getByText(/with error/i)).toBeInTheDocument();
    });

    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/not enough/i)).toBeInTheDocument();
    });
  });

  const triggerRun = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "runSimulation" }),
    );
  };

  const TestableComponent = () => {
    const runSimulation = useRunSimulation();

    return (
      <button aria-label="runSimulation" onClick={() => runSimulation()}>
        Run
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

  const wireWebWorker = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      runSimulationInWorker,
    );
  };

  const aNonSimulableModel = () => {
    const IDS = { r1: 1 } as const;
    return HydraulicModelBuilder.with().aReservoir(IDS.r1).build();
  };

  const aSimulableModel = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1)
      .aJunction(IDS.j1, { baseDemand: 1 })
      .aPipe(IDS.p1, { startNodeId: String(IDS.r1), endNodeId: String(IDS.j1) })
      .build();
  };

  const aSimulableModelWithWarnings = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1, { head: 0 })
      .aJunction(IDS.j1, { baseDemand: 10 })
      .aPipe(IDS.p1, { startNodeId: String(IDS.r1), endNodeId: String(IDS.j1) })
      .build();
  };
});
