import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { runSimulation } from "./main";
import {
  runSimulation as workerRunSimulation,
  SimulationProgress,
} from "./worker";
import { SimulationMetadata } from "./simulation-metadata";
import { Mock } from "vitest";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("EPS simulation", () => {
  beforeEach(() => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      workerRunSimulation,
    );
  });

  it("returns metadata with timestep count for single timestep", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.reportingStepsCount).toEqual(1);
    expect(simulationMetadata.nodeCount).toEqual(2);
    expect(simulationMetadata.linkCount).toEqual(1);
    expect(simulationMetadata.resAndTankCount).toEqual(1); // reservoir
  });

  it("returns metadata with multiple timesteps for EPS duration", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.reportingStepsCount).toBe(3); // initial + 2 timesteps
  });

  it("counts tanks and reservoirs as supply sources", async () => {
    const IDS = { R1: 1, T1: 2, J1: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 120 })
      .aTank(IDS.T1, {
        elevation: 100,
        initialLevel: 15,
        minLevel: 5,
        maxLevel: 25,
        diameter: 120,
      })
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.resAndTankCount).toEqual(2); // reservoir + tank
  });

  it("returns failure status with zero metadata on error", async () => {
    const IDS = { R1: 1, R2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aReservoir(IDS.R2)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.R2 })
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("failure");
    expect(simulationMetadata.reportingStepsCount).toEqual(0);
  });

  it("includes multiple errors in report", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3, J2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .aJunction(IDS.J2) // Disconnected junction
      .build();
    const inp = buildInp(hydraulicModel);

    const { status, report } = await runSimulation(inp, "test-multi-error");

    expect(status).toEqual("failure");
    expect(report).toContain("Error 200");
    expect(report).toContain("4"); // Reference to disconnected node
  });

  it("calls progress callback during simulation", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInp(hydraulicModel);

    const progressUpdates: SimulationProgress[] = [];
    const onProgress = (progress: SimulationProgress) => {
      progressUpdates.push(progress);
    };

    await runSimulation(inp, "test-app-id", onProgress);

    expect(progressUpdates.length).toBe(3); // initial + 2 timesteps
    expect(progressUpdates[0].totalDuration).toBe(7200);
    expect(progressUpdates[progressUpdates.length - 1].currentTime).toBe(7200);
  });
});
