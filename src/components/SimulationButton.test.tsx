import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulationButton } from "./SimulationButton";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Provider as JotaiProvider, getDefaultStore } from "jotai";
import {
  dataAtom,
  simulationAtom,
  SimulationSuccess,
  Store,
} from "src/state/jotai";
import { lib } from "src/lib/worker";
import { runSimulation } from "src/simulation";
import { Mock } from "vitest";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("Simulation button", () => {
  afterEach(() => {
    wireWebWorker();
    vi.clearAllMocks();
  });

  it("displays", () => {
    const store = getDefaultStore();
    renderComponent(store);

    expect(
      screen.getByRole("button", { name: "Simulate" }),
    ).toBeInTheDocument();
  });

  describe("with a successful simulation", () => {
    it("shows success when simulation passes", async () => {
      const hydraulicModel = aSimulableModel();
      const store = getDefaultStore();
      store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

      renderComponent(store);

      await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

      expect(await screen.findByText(/success/i)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByText(/success/i)).not.toBeInTheDocument();
    });

    it("persists the simulation result", async () => {
      const hydraulicModel = aSimulableModel();
      const store = getDefaultStore();
      store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

      renderComponent(store);

      await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

      expect(await screen.findByText(/success/i)).toBeInTheDocument();
      const simulation = store.get(simulationAtom) as SimulationSuccess;
      expect(simulation.status).toEqual("success");
      expect(simulation.report).not.toContain(/error/i);
    });
  });

  it("shows failure when simulation fails", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponent(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(await screen.findByText(/with error/i)).toBeInTheDocument();
    expect(screen.getByText(/not enough nodes/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/with error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not enough nodes/i)).not.toBeInTheDocument();
  });

  it("shows loading state", async () => {
    mockSimulationOnHold();
    const hydraulicModel = aNonSimulableModel();
    const store = getDefaultStore();
    store.set(dataAtom, (prev) => ({ ...prev, hydraulicModel }));

    renderComponent(store);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  const renderComponent = (store: Store) => {
    return render(
      <JotaiProvider store={store}>
        <TooltipProvider>
          <SimulationButton />
        </TooltipProvider>
      </JotaiProvider>,
    );
  };

  const aSimulableModel = () => {
    return HydraulicModelBuilder.with()
      .aReservoir("r1")
      .aJunction("j1")
      .aPipe("p1", "r1", "j1")
      .build();
  };

  const aNonSimulableModel = () => {
    return HydraulicModelBuilder.with().aReservoir("r1").build();
  };

  const wireWebWorker = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(runSimulation);
  };

  const mockSimulationOnHold = () => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      () => new Promise((_) => {}),
    );
  };
});
