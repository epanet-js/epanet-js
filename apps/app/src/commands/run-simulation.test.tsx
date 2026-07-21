import { screen, render, waitFor, act } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import { SimulationFinished } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { dialogAtom } from "src/state/dialog";
import { splitsAtom } from "src/state/layout";
import { modelAttributesValidationIssuesAtom } from "src/state/network-review";
import userEvent from "@testing-library/user-event";
import { useRunSimulation } from "./run-simulation";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { runSimulation as workerRunSimulation } from "src/simulation/epanet/worker";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

let canValidateModelAttributes = false;
vi.mock("src/hooks/use-permissions", () => ({
  usePermissions: () => ({ canValidateModelAttributes }),
}));

describe("Run simulation", () => {
  beforeAll(() => patchEpanetLoader());

  beforeEach(() => {
    wireWebWorker();
    canValidateModelAttributes = false;
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists state the simulation when passes", async () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.r1)
      .aJunction(IDS.j1)
      .aJunctionDemand(IDS.j1, [{ baseDemand: 1 }])
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("success");
      expect(simulation.report).not.toContain(/error/i);
      expect(
        "epsResultsReader" in simulation && simulation.epsResultsReader,
      ).toBeTruthy();
    });
  });

  it("persists the state when the simulation fails", async () => {
    const hydraulicModel = aNonSimulableModel();
    const store = setInitialState({ hydraulicModel });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
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

  it("shows the out of memory dialog when the simulation runs out of memory", async () => {
    (lib.runSimulation as unknown as Mock).mockResolvedValue({
      status: "failure",
      report: "",
      metadata: new ArrayBuffer(0),
      jsError: "memory access out of bounds",
      errorKind: "oom",
      simulationStats: { nodeCount: 1, linkCount: 0, stepCount: 1 },
    });

    const store = setInitialState({ hydraulicModel: aSimulableModel() });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(store.get(dialogAtom)).toMatchObject({
        type: "simulationOutOfMemory",
      });
    });
    expect(store.get(dialogAtom)).not.toMatchObject({
      type: "simulationSummary",
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

  describe("model validation", () => {
    const enableValidation = () => {
      canValidateModelAttributes = true;
    };

    it("shows the validation dialog and does not run when there are issues", async () => {
      enableValidation();
      const store = setInitialState({
        hydraulicModel: aModelWithEmptyRoughness(),
      });
      renderComponent({ store });

      await triggerRun();

      await waitFor(() => {
        expect(store.get(dialogAtom)).toMatchObject({
          type: "modelAttributesValidation",
          issueCount: 1,
        });
      });
      expect(store.get(modelAttributesValidationIssuesAtom)).toHaveLength(1);
      expect(lib.runSimulation).not.toHaveBeenCalled();
    });

    it("shows the dialog even without the validation permission", async () => {
      canValidateModelAttributes = false;
      const store = setInitialState({
        hydraulicModel: aModelWithEmptyRoughness(),
      });
      renderComponent({ store });

      await triggerRun();

      await waitFor(() => {
        expect(store.get(dialogAtom)).toMatchObject({
          type: "modelAttributesValidation",
        });
      });
      expect(lib.runSimulation).not.toHaveBeenCalled();
    });

    it("runs the simulation when choosing run anyway", async () => {
      enableValidation();
      const store = setInitialState({
        hydraulicModel: aModelWithEmptyRoughness(),
      });
      renderComponent({ store });

      await triggerRun();
      await waitFor(() => {
        expect(store.get(dialogAtom)).toMatchObject({
          type: "modelAttributesValidation",
        });
      });

      const dialog = store.get(dialogAtom) as { onRunAnyway: () => void };
      act(() => {
        dialog.onRunAnyway();
      });

      await waitFor(() => {
        expect(lib.runSimulation).toHaveBeenCalled();
      });
    });

    it("opens the network review panel and does not run when choosing fix first", async () => {
      enableValidation();
      const store = setInitialState({
        hydraulicModel: aModelWithEmptyRoughness(),
      });
      renderComponent({ store });

      await triggerRun();
      await waitFor(() => {
        expect(store.get(dialogAtom)).toMatchObject({
          type: "modelAttributesValidation",
        });
      });

      const dialog = store.get(dialogAtom) as { onFixFirst: () => void };
      act(() => {
        dialog.onFixFirst();
      });

      expect(store.get(splitsAtom).leftOpen).toBe(true);
      expect(store.get(dialogAtom)).toBeNull();
      expect(lib.runSimulation).not.toHaveBeenCalled();
    });

    it("runs directly when the model has no issues", async () => {
      enableValidation();
      const store = setInitialState({ hydraulicModel: aSimulableModel() });
      renderComponent({ store });

      await triggerRun();

      await waitFor(() => {
        const simulation = store.get(
          simulationDerivedAtom,
        ) as SimulationFinished;
        expect(simulation.status).toEqual("success");
      });
      expect(store.get(dialogAtom)).not.toMatchObject({
        type: "modelAttributesValidation",
      });
    });
  });

  describe("controls on inactive assets", () => {
    const aModelWithControlOnInactiveAsset = () => {
      const IDS = { r1: 1, j1: 2, p1: 3, n1: 4, n2: 5, pu1: 6 } as const;
      return HydraulicModelBuilder.with()
        .aReservoir(IDS.r1)
        .aJunction(IDS.j1)
        .aJunctionDemand(IDS.j1, [{ baseDemand: 1 }])
        .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
        .aNode(IDS.n1)
        .aNode(IDS.n2)
        .aPump(IDS.pu1, {
          startNodeId: IDS.n1,
          endNodeId: IDS.n2,
          isActive: false,
        })
        .aSimpleControl({
          template: "LINK {{0}} OPEN AT TIME 6",
          assetReferences: [{ assetId: IDS.pu1, isActionTarget: true }],
        })
        .build();
    };

    it("excludes controls referencing inactive assets from the INP", async () => {
      const store = setInitialState({
        hydraulicModel: aModelWithControlOnInactiveAsset(),
      });
      renderComponent({ store });

      await triggerRun();

      await waitFor(() => expect(lib.runSimulation).toHaveBeenCalled());
      const inp = (lib.runSimulation as unknown as Mock).mock
        .calls[0][0] as string;
      expect(inp).not.toContain("LINK 6 OPEN AT TIME 6");
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
      workerRunSimulation,
    );
  };

  const aNonSimulableModel = () => {
    const IDS = { r1: 1 } as const;
    return HydraulicModelBuilder.with().aReservoir(IDS.r1).build();
  };

  const aModelWithEmptyRoughness = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1)
      .aJunction(IDS.j1)
      .aJunctionDemand(IDS.j1, [{ baseDemand: 1 }])
      .aPipe(IDS.p1, {
        startNodeId: IDS.r1,
        endNodeId: IDS.j1,
        roughness: null,
      })
      .build();
  };

  const aSimulableModel = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1)
      .aJunction(IDS.j1)
      .aJunctionDemand(IDS.j1, [{ baseDemand: 1 }])
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
  };

  const aSimulableModelWithWarnings = () => {
    const IDS = { r1: 1, j1: 2, p1: 3 } as const;
    return HydraulicModelBuilder.with()
      .aReservoir(IDS.r1, { head: 0 })
      .aJunction(IDS.j1)
      .aJunctionDemand(IDS.j1, [{ baseDemand: 10 }])
      .aPipe(IDS.p1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
      .build();
  };
});
