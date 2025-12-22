import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { runEPSSimulation } from "./main";
import {
  runEPSSimulation as workerRunEPSSimulation,
  SimulationProgress,
} from "./worker-eps";
import { SimulationMetadata } from "./simulation-metadata";
import { Mock } from "vitest";

vi.mock("src/lib/worker", () => ({
  lib: {
    runEPSSimulation: vi.fn(),
  },
}));

describe("EPS simulation", () => {
  beforeEach(() => {
    (lib.runEPSSimulation as unknown as Mock).mockImplementation(
      workerRunEPSSimulation,
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

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.reportingPeriods).toEqual(1);
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

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.reportingPeriods).toBe(3); // initial + 2 timesteps
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

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");
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

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("failure");
    expect(simulationMetadata.reportingPeriods).toEqual(0);
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

    await runEPSSimulation(inp, "test-app-id", {}, onProgress);

    expect(progressUpdates.length).toBe(3); // initial + 2 timesteps
    expect(progressUpdates[0].totalDuration).toBe(7200);
    expect(progressUpdates[progressUpdates.length - 1].currentTime).toBe(7200);
  });
});
