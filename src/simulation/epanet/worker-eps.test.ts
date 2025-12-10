import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { lib } from "src/lib/worker";
import { buildInpEPS } from "../build-inp-eps";
import { runEPSSimulation } from "./main";
import {
  runEPSSimulation as workerRunEPSSimulation,
  SimulationProgress,
} from "./worker-eps";
import { Mock } from "vitest";

vi.mock("src/lib/worker", () => ({
  lib: {
    runEPSSimulation: vi.fn(),
  },
}));

vi.mock("src/infra/storage", async (importOriginal) => {
  const original = await importOriginal<typeof import("src/infra/storage")>();
  return {
    ...original,
    OPFSStorage: original.InMemoryStorage,
  };
});

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
    const inp = buildInpEPS(hydraulicModel);

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");

    expect(status).toEqual("success");
    expect(metadata.timestepCount).toEqual(1);
    expect(metadata.nodeCount).toEqual(2);
    expect(metadata.linkCount).toEqual(1);
    expect(metadata.supplySourcesCount).toEqual(1); // reservoir
  });

  it("returns metadata with multiple timesteps for EPS duration", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");

    expect(status).toEqual("success");
    expect(metadata.timestepCount).toBe(3); // initial + 2 timesteps
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
    const inp = buildInpEPS(hydraulicModel);

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");

    expect(status).toEqual("success");
    expect(metadata.supplySourcesCount).toEqual(2); // reservoir + tank
  });

  it("returns failure status with zero metadata on error", async () => {
    const IDS = { R1: 1, R2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aReservoir(IDS.R2)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.R2 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const { status, metadata } = await runEPSSimulation(inp, "test-app-id");

    expect(status).toEqual("failure");
    expect(metadata.timestepCount).toEqual(0);
  });

  it("calls progress callback during simulation", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInpEPS(hydraulicModel);

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
