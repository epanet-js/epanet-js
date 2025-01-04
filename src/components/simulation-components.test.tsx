import { vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SimulationButton,
  SimulationStatusText,
} from "./simulation-components";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import {
  dataAtom,
  simulationAtom,
  SimulationFailure,
  SimulationSuccess,
  Store,
} from "src/state/jotai";
import { lib } from "src/lib/worker";
import { runSimulation } from "src/simulation/epanet/worker";
import { Mock } from "vitest";
import { getPipe } from "src/hydraulic-model/assets-map";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("simulation components integration", () => {
  beforeEach(() => {
    wireWebWorker();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("displays idle state", () => {
    const store = getDefaultStore();
    renderComponents(store);

    expect(
      screen.getByRole("button", { name: "Simulate" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
  });

  it("shows running state", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockDelayedSimulation();
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(screen.getAllByText(/running/i)).toHaveLength(2);

    vi.runAllTimers();
    vi.useRealTimers();

    expect(await screen.findAllByText(/with error/i)).toHaveLength(2);
    expect(screen.queryByText(/running/i)).not.toBeInTheDocument();
  });

  it("shows success when simulation passes", async () => {
    const hydraulicModel = aSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/success/i)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it("persists state the simulation when passes", async () => {
    const hydraulicModel = aSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/success/i)).toHaveLength(2);

    const simulation = store.get(simulationAtom) as SimulationSuccess;
    expect(simulation.status).toEqual("success");
    expect(simulation.report).not.toContain(/error/i);
    expect(simulation.modelVersion).toEqual(hydraulicModel.version);
  });

  it("updates the hydraulic model state when simulation passes", async () => {
    const hydraulicModel = aSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/success/i)).toHaveLength(2);

    const { hydraulicModel: lastModel } = store.get(dataAtom);
    expect(getPipe(lastModel.assets, "p1")!.flow).not.toBeNull();
  });

  it("shows failure when simulation fails", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/with error/i)).toHaveLength(2);
    expect(screen.getByText(/not enough nodes/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/with error/i)).toBeInTheDocument();
  });

  it("persists state when simulation fails", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/with error/i)).toHaveLength(2);

    const simulation = store.get(simulationAtom) as SimulationFailure;
    expect(simulation.status).toEqual("failure");
    expect(simulation.report).toContain("not enough");
  });

  it("shows message when simulation outdated after success", async () => {
    const hydraulicModel = aSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/success/i)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText("dialog")).not.toBeInTheDocument();

    const otherHydraulicModel = aSimulableModel();
    expect(hydraulicModel.version).not.toEqual(otherHydraulicModel);

    act(() => {
      store.set(dataAtom, (prev) => ({
        ...prev,
        hydraulicModel: otherHydraulicModel,
      }));
    });

    expect(await screen.findByText(/outdated/i)).toBeInTheDocument();
  });

  it("shows message when simulation outdated after failure", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponents(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findAllByText(/with errors/i)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByText("dialog")).not.toBeInTheDocument();

    const otherHydraulicModel = aSimulableModel();
    expect(hydraulicModel.version).not.toEqual(otherHydraulicModel);

    act(() => {
      store.set(dataAtom, (prev) => ({
        ...prev,
        hydraulicModel: otherHydraulicModel,
      }));
    });

    expect(await screen.findByText(/outdated/i)).toBeInTheDocument();
  });

  const renderComponents = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <TooltipProvider>
          <SimulationButton />
          <SimulationStatusText />
        </TooltipProvider>
      </JotaiProvider>,
    );
  };

  const aSimulableModel = () => {
    return HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", { startNodeId: "r1", endNodeId: "j1" })
      .build();
  };

  const aNonSimulableModel = () => {
    return HydraulicModelBuilder.with().aReservoir("r1").build();
  };

  const wireWebWorker = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(runSimulation);
  };

  const mockDelayedSimulation = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      (inp: string) =>
        new Promise((resolve) => {
          setTimeout(() => resolve(runSimulation(inp)), 1000);
        }),
    );
  };
});
