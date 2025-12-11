import { screen, render, waitFor } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import {
  SimulationFinished,
  Store,
  simulationAtom,
  dataAtom,
} from "src/state/jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import userEvent from "@testing-library/user-event";
import { useRunSimulation } from "./run-simulation";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { runEPSSimulation as workerRunEPSSimulation } from "src/simulation/epanet/worker-eps";
import { stubFeatureOn } from "src/__helpers__/feature-flags";
import { Pipe } from "src/hydraulic-model";

vi.mock("src/lib/worker", () => ({
  lib: {
    runEPSSimulation: vi.fn(),
  },
}));

describe("Run EPS simulation", () => {
  beforeEach(() => {
    stubFeatureOn("FLAG_EPS");
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
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationAtom) as SimulationFinished;
      expect(simulation.status).toEqual("success");
      expect(simulation.report).not.toContain(/error/i);
    });

    await waitFor(() => {
      const { hydraulicModel: updatedModel } = store.get(dataAtom);
      const pipe = updatedModel.assets.get(IDS.p1) as Pipe;
      expect(pipe.flow).not.toBeNull();
      expect(pipe.flow).toBeGreaterThan(0);
    });
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
    (lib.runEPSSimulation as unknown as Mock).mockImplementation(
      workerRunEPSSimulation,
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
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
  };

  const aSimulableModelWithWarnings = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1, { head: 0 })
      .aJunction(IDS.j1, { baseDemand: 10 })
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
  };
});
