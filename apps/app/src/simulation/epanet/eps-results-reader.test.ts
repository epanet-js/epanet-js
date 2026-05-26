import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { SimulationSettingsBuilder } from "src/__helpers__/simulation-settings-builder";
import { buildInp } from "../build-inp";
import { presets } from "src/lib/project-settings/quantities-spec";
import { runSimulation as workerRunSimulation } from "./worker";
import { runSimulation } from "./main";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { EPSResultsReader, TimeSeries } from "./eps-results-reader";
import { SimulationMetadata } from "./simulation-metadata";
import { InMemoryStorage } from "src/infra/storage";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("EPSResultsReader", () => {
  beforeAll(() => patchEpanetLoader());

  beforeEach(() => {
    (lib.runSimulation as unknown as Mock).mockImplementation(
      workerRunSimulation,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getResultsForTimestep", () => {
    it("reads junction results for a single timestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-junction-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toBeGreaterThanOrEqual(1);

      const resultsReader = await reader.getResultsForTimestep(0);
      const junction = resultsReader.getJunction(IDS.J1);

      expect(junction).not.toBeNull();
      expect(junction?.type).toEqual("junction");
      expect(junction?.head).toBeGreaterThan(0);
      expect(junction?.pressure).toBeGreaterThan(0);
    });

    it("reads pipe results for a single timestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-pipe-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(IDS.P1);

      expect(pipe).not.toBeNull();
      expect(pipe?.type).toEqual("pipe");
      expect(pipe?.flow).toBeGreaterThan(0);
      expect(pipe?.status).toEqual("open");
    });

    it("reads multiple timesteps correctly", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-multi-timestep";
      const { status, metadata } = await runSimulation(inp, testAppId);
      const prolog = new SimulationMetadata(metadata);
      expect(status).toEqual("success");
      expect(prolog.reportingStepsCount).toBe(3); // initial + 2 timesteps

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toBe(3);

      // Read each timestep
      for (let i = 0; i < 3; i++) {
        const resultsReader = await reader.getResultsForTimestep(i);
        const junction = resultsReader.getJunction(IDS.J1);
        expect(junction).not.toBeNull();
      }
    });

    it("reads tank results with volume from separate file", async () => {
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
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-tank-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(IDS.T1);

      expect(tank).not.toBeNull();
      expect(tank?.type).toEqual("tank");
      expect(tank?.head).toBeGreaterThan(0);
    });

    it("reads tank level", async () => {
      const IDS = { R1: 1, T1: 2, J1: 3, P1: 4, P2: 5 } as const;
      const tankInitialLevel = 15;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 120 })
        .aTank(IDS.T1, {
          elevation: 100,
          initialLevel: tankInitialLevel,
          minLevel: 5,
          maxLevel: 25,
          diameter: 120,
        })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-tank-level-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(IDS.T1);

      expect(tank).not.toBeNull();
      // Level at timestep 0 should be close to initial level
      expect(tank?.level).toBeCloseTo(tankInitialLevel, 0);
    });

    it("returns null for non-existent assets", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-nonexistent";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);

      const nonExistentId = 999999;
      expect(resultsReader.getJunction(nonExistentId)).toBeNull();
      expect(resultsReader.getPipe(nonExistentId)).toBeNull();
      expect(resultsReader.getValve(nonExistentId)).toBeNull();
      expect(resultsReader.getPump(nonExistentId)).toBeNull();
      expect(resultsReader.getTank(nonExistentId)).toBeNull();
    });

    it("returns null results reader when accessing timestep out of range", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-out-of-range";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const negativeIndexReader = await reader.getResultsForTimestep(-1);
      expect(negativeIndexReader.getJunction(IDS.J1)).toBeNull();

      const highIndexReader = await reader.getResultsForTimestep(100);
      expect(highIndexReader.getPipe(IDS.P1)).toBeNull();
    });

    it("throws error when not initialized", async () => {
      const storage = new InMemoryStorage("test-uninitialized");
      const reader = new EPSResultsReader(storage);

      expect(() => reader.timestepCount).toThrow(/not initialized/i);
      await expect(reader.getResultsForTimestep(0)).rejects.toThrow(
        /not initialized/i,
      );
    });

    it("calculates pipe headloss from unit headloss and length", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const pipeLength = 1000; // 1000 meters
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          length: pipeLength,
        })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-pipe-headloss";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(IDS.P1);

      expect(pipe).not.toBeNull();
      // headloss = unitHeadloss * (length / 1000)
      // For 1000m pipe: headloss should equal unitHeadloss
      expect(pipe?.headloss).toBeCloseTo(pipe?.unitHeadloss ?? 0, 5);
    });

    it("reads pump results with head and status", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { elevation: 0 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: IDS.PUMP1, points: [{ x: 1, y: 1 }] })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-pump-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pump = resultsReader.getPump(IDS.PUMP1);

      expect(pump).not.toBeNull();
      expect(pump?.type).toEqual("pump");
      expect(pump?.flow).toBeGreaterThanOrEqual(0);
      expect(pump?.head).toBeGreaterThan(0);
      expect(pump?.status).toMatch(/on|off/);
      // statusWarning should be null or one of the warning types
      expect([null, "cannot-deliver-head", "cannot-deliver-flow"]).toContain(
        pump?.statusWarning,
      );
    });

    it("reads correct pipe length for headloss calculation", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const pipeLength = 500; // 500 meters
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          length: pipeLength,
        })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-pipe-length";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(IDS.P1);

      expect(pipe).not.toBeNull();
      // For 500m pipe: headloss = unitHeadloss * 0.5
      // So unitHeadloss = headloss / 0.5 = headloss * 2
      if (pipe && pipe.headloss !== 0) {
        expect(pipe.unitHeadloss).toBeCloseTo(pipe.headloss * 2, 5);
      }
    });

    it("reads pump XFLOW status warning when pump exceeds max flow", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { elevation: 0 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 3 }])
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: IDS.PUMP1, points: [{ x: 1, y: 1 }] })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-pump-xflow";
      const { status } = await runSimulation(inp, testAppId);
      // Expect warning because pump is operating beyond its curve
      expect(status).toEqual("warning");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pump = resultsReader.getPump(IDS.PUMP1);

      expect(pump).not.toBeNull();
      expect(pump?.type).toEqual("pump");
      expect(pump?.status).toEqual("on");
      expect(pump?.statusWarning).toEqual("cannot-deliver-flow");
    });

    it("reads pump status across multiple timesteps", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { elevation: 0 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPump(IDS.PUMP1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          curve: [{ x: 20, y: 40 }],
        })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-pump-multi-timestep";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      // Should have 3 timesteps (initial + 2)
      expect(reader.timestepCount).toBe(3);

      // Read pump status from each timestep
      for (let i = 0; i < reader.timestepCount; i++) {
        const resultsReader = await reader.getResultsForTimestep(i);
        const pump = resultsReader.getPump(IDS.PUMP1);

        expect(pump).not.toBeNull();
        expect(pump?.type).toEqual("pump");
        expect(pump?.status).toMatch(/on|off/);
      }
    });

    it("reads valve results with flow and status", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aValve(IDS.V1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
        })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-valve-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const valve = resultsReader.getValve(IDS.V1);

      expect(valve).not.toBeNull();
      expect(valve?.type).toEqual("valve");
      expect(valve?.flow).toBeGreaterThan(0);
      expect(valve?.status).toMatch(/active|open|closed/);
    });

    it("reads closed valve status", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aValve(IDS.V1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          initialStatus: "closed",
        })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-valve-closed";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("warning"); // Warning due to negative pressures

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const valve = resultsReader.getValve(IDS.V1);

      expect(valve).not.toBeNull();
      expect(valve?.status).toEqual("closed");
    });

    it("returns null results when simulation fails", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aJunction(IDS.J2) // Disconnected junction causes failure
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-failed-simulation";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("failure");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toEqual(0);
      const resultsReader = await reader.getResultsForTimestep(0);
      expect(resultsReader.getJunction(IDS.J1)).toBeNull();
      expect(resultsReader.getPipe(IDS.P1)).toBeNull();
    });
  });

  describe("getAllValues", () => {
    it("returns node property values consistent with per-asset getters", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aJunction(IDS.J2, { elevation: 20 })
        .aJunctionDemand(IDS.J2, [{ baseDemand: 5 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-getallvalues-nodes";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);

      // 3 nodes: R1, J1, J2
      const pressures = resultsReader.getAllValues("pressure");
      expect(pressures).toHaveLength(3);

      const heads = resultsReader.getAllValues("head");
      expect(heads).toHaveLength(3);

      const demands = resultsReader.getAllValues("actualDemand");
      expect(demands).toHaveLength(3);

      // Values should match per-asset getters
      const j1 = resultsReader.getJunction(IDS.J1)!;
      const j2 = resultsReader.getJunction(IDS.J2)!;
      expect(pressures).toContain(j1.pressure);
      expect(pressures).toContain(j2.pressure);
      expect(heads).toContain(j1.head);
      expect(heads).toContain(j2.head);
    });

    it("returns link property values consistent with per-asset getters", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aJunction(IDS.J2, { elevation: 20 })
        .aJunctionDemand(IDS.J2, [{ baseDemand: 5 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-getallvalues-links";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);

      // 2 links: P1, P2
      const flows = resultsReader.getAllValues("flow");
      expect(flows).toHaveLength(2);

      const velocities = resultsReader.getAllValues("velocity");
      expect(velocities).toHaveLength(2);

      const headlosses = resultsReader.getAllValues("unitHeadloss");
      expect(headlosses).toHaveLength(2);

      // Values should match per-asset getters
      const p1 = resultsReader.getPipe(IDS.P1)!;
      const p2 = resultsReader.getPipe(IDS.P2)!;
      expect(flows).toContain(p1.flow);
      expect(flows).toContain(p2.flow);
      expect(velocities).toContain(p1.velocity);
      expect(velocities).toContain(p2.velocity);
    });

    it("returns empty array from null results reader", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-getallvalues-null";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      // Out-of-range timestep returns NullResultsReader
      const resultsReader = await reader.getResultsForTimestep(999);
      expect(resultsReader.getAllValues("pressure")).toEqual([]);
      expect(resultsReader.getAllValues("flow")).toEqual([]);
    });
  });

  describe("getTimeSeries", () => {
    describe("junction", () => {
      it("reads junction pressure time series across multiple timesteps", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1, { elevation: 10 })
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-junction-time-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(
          IDS.J1,
          "junction",
          "pressure",
        );

        expect(timeSeries).not.toBeNull();
        expect(timeSeries!.intervalsCount).toBe(3);
        expect(timeSeries!.values).toBeInstanceOf(Float32Array);
        expect(timeSeries!.values.length).toBe(3);
        expect(timeSeries!.intervalSeconds).toBe(3600);
      });

      it("returns values matching getResultsForTimestep", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1, { elevation: 10 })
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-junction-series-values";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const pressureSeries = await reader.getTimeSeries(
          IDS.J1,
          "junction",
          "pressure",
        );
        const headSeries = await reader.getTimeSeries(
          IDS.J1,
          "junction",
          "head",
        );
        const demandSeries = await reader.getTimeSeries(
          IDS.J1,
          "junction",
          "demand",
        );

        for (let t = 0; t < reader.timestepCount; t++) {
          const resultsReader = await reader.getResultsForTimestep(t);
          const junction = resultsReader.getJunction(IDS.J1);

          expect(pressureSeries!.values[t]).toBeCloseTo(junction!.pressure, 5);
          expect(headSeries!.values[t]).toBeCloseTo(junction!.head, 5);
          expect(demandSeries!.values[t]).toBeCloseTo(junction!.demand, 5);
        }
      });

      it("returns null for non-existent junction", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-junction-nonexistent";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(
          999,
          "junction",
          "pressure",
        );
        expect(timeSeries).toBeNull();
      });

      it("reads all junction property types", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1, { elevation: 10 })
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-junction-all-properties";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const properties = ["demand", "head", "pressure", "quality"] as const;
        for (const property of properties) {
          const timeSeries = await reader.getTimeSeries(
            IDS.J1,
            "junction",
            property,
          );
          expect(timeSeries).not.toBeNull();
          expect(timeSeries!.values).toBeInstanceOf(Float32Array);
        }
      });
    });

    describe("pipe", () => {
      it("reads pipe flow time series across multiple timesteps", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-pipe-time-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(IDS.P1, "pipe", "flow");

        expect(timeSeries).not.toBeNull();
        expect(timeSeries!.intervalsCount).toBe(3);
        expect(timeSeries!.values).toBeInstanceOf(Float32Array);
        expect(timeSeries!.values.length).toBe(3);
        expect(timeSeries!.intervalSeconds).toBe(3600);
      });

      it("returns values matching getResultsForTimestep", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-pipe-series-values";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const flowSeries = await reader.getTimeSeries(IDS.P1, "pipe", "flow");
        const velocitySeries = await reader.getTimeSeries(
          IDS.P1,
          "pipe",
          "velocity",
        );

        for (let t = 0; t < reader.timestepCount; t++) {
          const resultsReader = await reader.getResultsForTimestep(t);
          const pipe = resultsReader.getPipe(IDS.P1);

          expect(flowSeries!.values[t]).toBeCloseTo(pipe!.flow, 5);
          expect(velocitySeries!.values[t]).toBeCloseTo(pipe!.velocity, 5);
        }
      });

      it("returns null for non-existent pipe", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-pipe-nonexistent";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(999, "pipe", "flow");
        expect(timeSeries).toBeNull();
      });

      it("reads all pipe property types", async () => {
        const IDS = { R1: 1, J1: 2, P1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-pipe-all-properties";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const properties = ["flow", "velocity", "headloss", "status"] as const;
        for (const property of properties) {
          const timeSeries = await reader.getTimeSeries(
            IDS.P1,
            "pipe",
            property,
          );
          expect(timeSeries).not.toBeNull();
          expect(timeSeries!.values).toBeInstanceOf(Float32Array);
        }
      });
    });

    describe("tank", () => {
      it("reads tank volume time series across multiple timesteps", async () => {
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
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
          .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-tank-volume-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(IDS.T1, "tank", "volume");

        expect(timeSeries).not.toBeNull();
        expect(timeSeries!.intervalsCount).toBe(3);
        expect(timeSeries!.values).toBeInstanceOf(Float32Array);
        expect(timeSeries!.values.length).toBe(3);
        expect(timeSeries!.intervalSeconds).toBe(3600);
      });

      it("returns volume values matching getResultsForTimestep", async () => {
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
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
          .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-tank-volume-values";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const volumeSeries = await reader.getTimeSeries(
          IDS.T1,
          "tank",
          "volume",
        );

        for (let t = 0; t < reader.timestepCount; t++) {
          const resultsReader = await reader.getResultsForTimestep(t);
          const tank = resultsReader.getTank(IDS.T1);

          expect(volumeSeries!.values[t]).toBeCloseTo(tank!.volume);
        }
      });

      it("reads tank level (maps to pressure internally)", async () => {
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
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
          .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-tank-level-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const levelSeries = await reader.getTimeSeries(IDS.T1, "tank", "level");

        expect(levelSeries).not.toBeNull();
        expect(levelSeries!.values).toBeInstanceOf(Float32Array);

        // Level should match the tank's level from getResultsForTimestep
        for (let t = 0; t < reader.timestepCount; t++) {
          const resultsReader = await reader.getResultsForTimestep(t);
          const tank = resultsReader.getTank(IDS.T1);
          expect(levelSeries!.values[t]).toBeCloseTo(tank!.level);
        }
      });

      it("returns null for non-existent tank", async () => {
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
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-tank-nonexistent";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(999, "tank", "volume");
        expect(timeSeries).toBeNull();
      });

      it("returns null for junction when requesting tank volume", async () => {
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
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings: defaultSimulationSettings,
        });

        const testAppId = "test-tank-junction-volume";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const timeSeries = await reader.getTimeSeries(IDS.J1, "tank", "volume");
        expect(timeSeries).toBeNull();
      });
    });

    describe("pump", () => {
      it("reads pump flow time series", async () => {
        const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 50 })
          .aJunction(IDS.J1, { elevation: 0 })
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .aPumpCurve({ id: IDS.PUMP1, points: [{ x: 20, y: 40 }] })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-pump-flow-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const flowSeries = await reader.getTimeSeries(
          IDS.PUMP1,
          "pump",
          "flow",
        );

        expect(flowSeries).not.toBeNull();
        expect(flowSeries!.values).toBeInstanceOf(Float32Array);
        expect(flowSeries!.intervalsCount).toBe(3);
      });

      it("reads pump status time series from separate file", async () => {
        const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 50 })
          .aJunction(IDS.J1, { elevation: 0 })
          .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
          .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
          .aPumpCurve({ id: IDS.PUMP1, points: [{ x: 20, y: 40 }] })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-pump-status-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const statusSeries = await reader.getTimeSeries(
          IDS.PUMP1,
          "pump",
          "status",
        );

        expect(statusSeries).not.toBeNull();
        expect(statusSeries!.values).toBeInstanceOf(Float32Array);
        expect(statusSeries!.intervalsCount).toBe(3);
      });
    });

    describe("valve", () => {
      it("reads valve flow time series", async () => {
        const IDS = { R1: 1, J1: 2, V1: 3 } as const;
        const hydraulicModel = HydraulicModelBuilder.with()
          .aReservoir(IDS.R1, { head: 100 })
          .aJunction(IDS.J1)
          .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
          .aValve(IDS.V1, {
            startNodeId: IDS.R1,
            endNodeId: IDS.J1,
          })
          .build();
        const simulationSettings = SimulationSettingsBuilder.with()
          .timing({ duration: 7200, hydraulicTimestep: 3600 })
          .build();
        const inp = buildInp(hydraulicModel, {
          units: presets.LPS.units,
          simulationSettings,
        });

        const testAppId = "test-valve-flow-series";
        await runSimulation(inp, testAppId);

        const storage = new InMemoryStorage(testAppId);
        const reader = new EPSResultsReader(storage);
        await reader.initialize();

        const flowSeries = await reader.getTimeSeries(IDS.V1, "valve", "flow");

        expect(flowSeries).not.toBeNull();
        expect(flowSeries!.values).toBeInstanceOf(Float32Array);
        expect(flowSeries!.intervalsCount).toBe(3);
      });
    });

    it("throws error when not initialized", async () => {
      const storage = new InMemoryStorage("test-timeseries-uninitialized");
      const reader = new EPSResultsReader(storage);

      await expect(
        reader.getTimeSeries(1, "junction", "pressure"),
      ).rejects.toThrow(/not initialized/i);
    });

    it("returns null for time series when simulation fails with 0 timesteps", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 1 }])
        .aJunction(IDS.J2) // Disconnected junction causes failure
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-empty-series";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("failure");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toBe(0);

      // When simulation fails, no IDs are available so lookups return null
      const nodeSeries = await reader.getTimeSeries(
        IDS.J1,
        "junction",
        "pressure",
      );
      expect(nodeSeries).toBeNull();

      const linkSeries = await reader.getTimeSeries(IDS.P1, "pipe", "flow");
      expect(linkSeries).toBeNull();
    });

    it("reportingTimeStep accessor returns correct value", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({
          duration: 7200,
          hydraulicTimestep: 1800,
          reportTimestep: 900,
        })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-reporting-timestep";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.reportingTimeStep).toBe(900);
    });

    it("reportingTimeStep throws when not initialized", () => {
      const storage = new InMemoryStorage("test-timestep-uninitialized");
      const reader = new EPSResultsReader(storage);

      expect(() => reader.reportingTimeStep).toThrow(/not initialized/i);
    });

    it("qualityType returns 'age' when quality analysis is enabled", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
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

      const testAppId = "test-quality-type-age";
      await runSimulation(inp, testAppId, undefined, { runQuality: true });

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.qualityType).toBe("age");
    });

    it("qualityType returns 'trace' when trace analysis is enabled", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .qualitySimulationType("trace")
        .qualityTraceNodeId(IDS.R1)
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-quality-type-trace";
      await runSimulation(inp, testAppId, undefined, { runQuality: true });

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.qualityType).toBe("trace");

      const results = await reader.getResultsForTimestep(0);
      const junction = results.getJunction(IDS.J1);
      expect(junction?.waterTrace).not.toBeNull();
      expect(junction?.waterAge).toBeNull();
    });

    it("qualityType returns 'none' when quality analysis is not run", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-quality-type-none";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.qualityType).toBe("none");
    });

    it("qualityType throws when not initialized", () => {
      const storage = new InMemoryStorage("test-quality-type-uninitialized");
      const reader = new EPSResultsReader(storage);

      expect(() => reader.qualityType).toThrow(/not initialized/i);
    });
  });

  describe("getHeadRangesForNodes", () => {
    it("returns per-node min/max head matching the head time series", async () => {
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
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-head-ranges-bulk";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const cases = [
        { nodeId: IDS.R1, type: "reservoir" as const },
        { nodeId: IDS.T1, type: "tank" as const },
        { nodeId: IDS.J1, type: "junction" as const },
      ];
      const bulk = reader.getHeadRangesForNodes(cases.map((c) => c.nodeId));

      expect(bulk.length).toBe(cases.length);
      for (let i = 0; i < cases.length; i++) {
        const { nodeId, type } = cases[i];
        const series =
          type === "reservoir"
            ? await reader.getTimeSeries(nodeId, "reservoir", "head")
            : type === "tank"
              ? await reader.getTimeSeries(nodeId, "tank", "head")
              : await reader.getTimeSeries(nodeId, "junction", "head");

        expect(series).not.toBeNull();
        const expectedMin = Math.min(...series!.values);
        const expectedMax = Math.max(...series!.values);

        const [min, max] = bulk[i];
        expect(min).toBeCloseTo(expectedMin, 3);
        expect(max).toBeCloseTo(expectedMax, 3);
      }
    });

    it("returns equal min and max for a steady-state (single-timestep) run", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-head-ranges-steady";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const bulk = reader.getHeadRangesForNodes([IDS.J1]);
      const [min, max] = bulk[0];
      expect(min).toBeCloseTo(max, 6);
    });

    it("returns [Infinity, -Infinity] for unknown node ids while preserving order", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-head-ranges-bulk-mixed";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const bulk = reader.getHeadRangesForNodes([IDS.J1, 999]);
      expect(bulk.length).toBe(2);
      expect(bulk[0][0]).toBeLessThanOrEqual(bulk[0][1]);
      expect(bulk[1]).toEqual([Infinity, -Infinity]);
    });

    it("returns an empty array for an empty input", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-head-ranges-bulk-empty";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const bulk = reader.getHeadRangesForNodes([]);
      expect(bulk.length).toBe(0);
    });

    it("returns [Infinity, -Infinity] entries when reader is not initialized", () => {
      const storage = new InMemoryStorage(
        "test-head-ranges-bulk-uninitialized",
      );
      const reader = new EPSResultsReader(storage);

      const bulk = reader.getHeadRangesForNodes([1, 2]);
      expect(bulk).toEqual([
        [Infinity, -Infinity],
        [Infinity, -Infinity],
      ]);
    });

    it("reads node_stats.bin during initialize() and makes no storage calls in getHeadRangesForNodes", async () => {
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
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-head-ranges-bulk-readcount";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const getFileSpy = vi.spyOn(storage, "getFile");
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      // node_stats.bin is loaded once during initialize()
      const nodeStatsOpens = getFileSpy.mock.calls.filter(
        ([key]) => key === "node_stats.bin",
      );
      expect(nodeStatsOpens.length).toBe(1);

      // getHeadRangesForNodes reads from in-memory data — no further storage calls
      getFileSpy.mockClear();
      reader.getHeadRangesForNodes([IDS.R1, IDS.T1, IDS.J1]);
      expect(getFileSpy).not.toHaveBeenCalled();
    });
  });

  describe("iterateTimeSeries", () => {
    it("does not call onResult when not initialized", async () => {
      const storage = new InMemoryStorage("test-its-uninitialized");
      const reader = new EPSResultsReader(storage);
      const onResult = vi.fn();

      await reader.iterateTimeSeries(new Map(), ["pressure"], onResult);

      expect(onResult).not.toHaveBeenCalled();
    });

    it("calls onResult once per property per asset", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-its-call-count";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const calls: Array<{ metric: string; assetId: number }> = [];
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["pressure", "flow"],
        async (metric, asset) => {
          calls.push({ metric, assetId: asset.id });
          return Promise.resolve();
        },
      );

      // 3 assets × 2 properties = 6 calls
      expect(calls).toHaveLength(6);
      expect(calls.filter((c) => c.metric === "pressure")).toHaveLength(3);
      expect(calls.filter((c) => c.metric === "flow")).toHaveLength(3);
    });

    it("node property values match getResultsForTimestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-its-node-values";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const seriesMap = new Map<string, TimeSeries | null>();
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["pressure", "head", "demand"],
        async (metric, asset, ts) => {
          if (asset.id === IDS.J1) seriesMap.set(metric, ts);
          return Promise.resolve();
        },
      );

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const junction = resultsReader.getJunction(IDS.J1)!;

        expect(seriesMap.get("pressure")!.values[t]).toBeCloseTo(
          junction.pressure,
          5,
        );
        expect(seriesMap.get("head")!.values[t]).toBeCloseTo(junction.head, 5);
        expect(seriesMap.get("demand")!.values[t]).toBeCloseTo(
          junction.demand,
          5,
        );
      }
    });

    it("link property values match getResultsForTimestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-its-link-values";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const seriesMap = new Map<string, TimeSeries | null>();
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["flow", "velocity"],
        async (metric, asset, ts) => {
          if (asset.id === IDS.P1) seriesMap.set(metric, ts);
          return Promise.resolve();
        },
      );

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const pipe = resultsReader.getPipe(IDS.P1)!;

        expect(seriesMap.get("flow")!.values[t]).toBeCloseTo(pipe.flow, 5);
        expect(seriesMap.get("velocity")!.values[t]).toBeCloseTo(
          pipe.velocity,
          5,
        );
      }
    });

    it("pump status values match getResultsForTimestep", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { elevation: 0 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: IDS.PUMP1, points: [{ x: 20, y: 40 }] })
        .build();
      const simulationSettings = SimulationSettingsBuilder.with()
        .timing({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings,
      });

      const testAppId = "test-its-pump-status";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      let pumpStatusTs: TimeSeries | null = null;
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["status"],
        async (metric, asset, ts) => {
          if (asset.id === IDS.PUMP1) pumpStatusTs = ts;
          return Promise.resolve();
        },
      );

      expect(pumpStatusTs).not.toBeNull();
      expect(pumpStatusTs!.values).toBeInstanceOf(Float32Array);
      expect(pumpStatusTs!.intervalsCount).toBe(reader.timestepCount);

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const pump = resultsReader.getPump(IDS.PUMP1)!;
        expect(pumpStatusTs!.values[t] >= 3).toBe(pump.status === "on");
      }
    });

    it("yields null for a node asset when property has no node mapping", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-its-node-null-property";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      let junctionFlowTs: TimeSeries | null | undefined = undefined;
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["flow"], // "flow" is not in NODE_RESULTS_PROPERTY_INDEX
        async (metric, asset, ts) => {
          if (asset.id === IDS.J1) junctionFlowTs = ts;
          return Promise.resolve();
        },
      );

      expect(junctionFlowTs).toBeNull();
    });

    it("yields null for a link asset when property has no link mapping", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-its-link-null-property";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      let pipePressureTs: TimeSeries | null | undefined = undefined;
      await reader.iterateTimeSeries(
        hydraulicModel.assets,
        ["pressure"], // "pressure" is not in LINK_RESULTS_PROPERTY_INDEX
        async (metric, asset, ts) => {
          if (asset.id === IDS.P1) pipePressureTs = ts;
          return Promise.resolve();
        },
      );

      expect(pipePressureTs).toBeNull();
    });

    it("throws when signal is aborted", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { elevation: 10 })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 10 }])
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel, {
        units: presets.LPS.units,
        simulationSettings: defaultSimulationSettings,
      });

      const testAppId = "test-its-abort";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const controller = new AbortController();
      controller.abort();

      await expect(
        reader.iterateTimeSeries(
          hydraulicModel.assets,
          ["pressure"],
          vi.fn(),
          controller.signal,
        ),
      ).rejects.toThrow();
    });
  });
});
