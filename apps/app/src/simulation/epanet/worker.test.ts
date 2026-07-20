import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { lib } from "src/lib/worker";
import { buildInp } from "../build-inp";
import { presets } from "src/lib/project-settings/quantities-spec";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { runSimulation } from "./main";
import {
  runSimulation as workerRunSimulation,
  SimulationProgress,
} from "./worker";
import { SimulationMetadata } from "./simulation-metadata";
import { Mock } from "vitest";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { captureError, captureWarning } from "src/infra/error-tracking";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

vi.mock("src/infra/error-tracking", () => ({
  captureError: vi.fn(),
  captureWarning: vi.fn(),
}));

describe("EPS simulation", () => {
  beforeAll(() => patchEpanetLoader());

  beforeEach(() => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      workerRunSimulation,
    );
    (captureError as unknown as Mock).mockClear();
    (captureWarning as unknown as Mock).mockClear();
  });

  it("returns metadata with timestep count for single timestep", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });

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
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const simulationSettings = SimulationSettingsBuilder.with()
      .timing({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings,
    });

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
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.T1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.T1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.resAndTankCount).toEqual(2); // reservoir + tank
  });

  it("returns failure status with zero metadata on error", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3, J2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aJunction(IDS.J2, { elevation: 0 }) // Disconnected junction causes error
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });

    const { status, metadata } = await runSimulation(inp, "test-app-id");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("failure");
    expect(simulationMetadata.reportingStepsCount).toEqual(0);
  });

  it("includes multiple errors in report", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3, J2: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .aJunction(IDS.J2, { elevation: 0 }) // Disconnected junction
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });

    const { status, report } = await runSimulation(inp, "test-multi-error");

    expect(status).toEqual("failure");
    expect(report).toContain("Error 234");
    expect(report).toContain("4"); // Reference to disconnected node
  });

  it("runs quality analysis and sets quality type in metadata when runQuality flag is set", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const simulationSettings = SimulationSettingsBuilder.with()
      .qualitySimulationType("age")
      .timing({ duration: 7200, hydraulicTimestep: 3600 })
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings,
      includeQuality: true,
    });

    const { status, metadata } = await runSimulation(
      inp,
      "test-quality",
      undefined,
      { runQuality: true },
    );
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.qualityType).toEqual("age");
  });

  it("does not run quality analysis when runQuality flag is not set", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings: defaultSimulationSettings,
    });

    const { status, metadata } = await runSimulation(inp, "test-no-quality");
    const simulationMetadata = new SimulationMetadata(metadata);

    expect(status).toEqual("success");
    expect(simulationMetadata.qualityType).toEqual("none");
  });

  it("calls progress callback during simulation", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const simulationSettings = SimulationSettingsBuilder.with()
      .timing({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings,
    });

    const progressUpdates: SimulationProgress[] = [];
    const onProgress = (progress: SimulationProgress) => {
      progressUpdates.push(progress);
    };

    await runSimulation(inp, "test-app-id", onProgress);

    const hydraulicUpdates = progressUpdates.filter(
      (p) => p.phase === "hydraulic",
    );
    expect(hydraulicUpdates.length).toBe(3); // initial + 2 timesteps
    expect(hydraulicUpdates[0].totalDuration).toBe(7200);
    expect(hydraulicUpdates[hydraulicUpdates.length - 1].currentTime).toBe(
      7200,
    );
  });

  it("emits a finalizing progress event after the hydraulic loop", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { elevation: 0 })
      .aPipe(IDS.P1, {
        startNodeId: IDS.R1,
        endNodeId: IDS.J1,
        length: 100,
        diameter: 100,
        roughness: 100,
      })
      .build();
    const simulationSettings = SimulationSettingsBuilder.with()
      .timing({ duration: 7200, hydraulicTimestep: 3600 })
      .build();
    const inp = buildInp(hydraulicModel, {
      units: presets.LPS.units,
      simulationSettings,
    });

    const progressUpdates: SimulationProgress[] = [];
    const onProgress = (progress: SimulationProgress) => {
      progressUpdates.push(progress);
    };

    await runSimulation(inp, "test-finalizing", onProgress);

    const finalizingUpdates = progressUpdates.filter(
      (p) => p.phase === "finalizing",
    );
    expect(finalizingUpdates.length).toBe(1);
    expect(finalizingUpdates[0].currentTime).toBe(7200);
    expect(finalizingUpdates[0].totalDuration).toBe(7200);
    expect(progressUpdates[progressUpdates.length - 1].phase).toBe(
      "finalizing",
    );
  });

  it("reports an out-of-memory failure as a warning with sizing context", async () => {
    (lib.runSimulation as unknown as Mock).mockResolvedValue({
      status: "failure",
      report: "The simulation ran out of memory",
      metadata: new ArrayBuffer(0),
      jsError: "Array buffer allocation failed",
      errorKind: "oom",
      simulationStats: { nodeCount: 10, linkCount: 12, stepCount: 5 },
    });

    await runSimulation("inp", "test-oom");

    expect(captureError).not.toHaveBeenCalled();
    const [message, error, contexts] = (captureWarning as unknown as Mock).mock
      .calls[0];
    expect(message).toBe("Out of memory: Array buffer allocation failed");
    expect(error).toBeUndefined();
    expect(contexts).toEqual({
      Simulation: { nodeCount: 10, linkCount: 12, stepCount: 5 },
    });
  });

  it("reports a generic simulation JS error without the OOM prefix", async () => {
    (lib.runSimulation as unknown as Mock).mockResolvedValue({
      status: "failure",
      report: "boom",
      metadata: new ArrayBuffer(0),
      jsError: "something broke",
    });

    await runSimulation("inp", "test-js-error");

    expect(captureWarning).not.toHaveBeenCalled();
    const [error, contexts] = (captureError as unknown as Mock).mock.calls[0];
    expect(error.message).toBe("Simulation JS error: something broke");
    expect(contexts).toBeUndefined();
  });
});
