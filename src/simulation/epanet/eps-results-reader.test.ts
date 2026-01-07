import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "../build-inp";
import { runSimulation as workerRunSimulation } from "./worker";
import { runSimulation } from "./main";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { EPSResultsReader } from "./eps-results-reader";
import { SimulationMetadata } from "./simulation-metadata";
import { InMemoryStorage } from "src/infra/storage";

vi.mock("src/lib/worker", () => ({
  lib: {
    runSimulation: vi.fn(),
  },
}));

describe("EPSResultsReader", () => {
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }], elevation: 10 })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-junction-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toBeGreaterThanOrEqual(1);

      const resultsReader = await reader.getResultsForTimestep(0);
      const junction = resultsReader.getJunction(String(IDS.J1));

      expect(junction).not.toBeNull();
      expect(junction?.type).toEqual("junction");
      expect(junction?.head).toBeGreaterThan(0);
      expect(junction?.pressure).toBeGreaterThan(0);
    });

    it("reads pipe results for a single timestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-pipe-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(String(IDS.P1));

      expect(pipe).not.toBeNull();
      expect(pipe?.type).toEqual("pipe");
      expect(pipe?.flow).toBeGreaterThan(0);
      expect(pipe?.status).toEqual("open");
    });

    it("reads multiple timesteps correctly", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
        .build();
      const inp = buildInp(hydraulicModel);

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
        const junction = resultsReader.getJunction(String(IDS.J1));
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .eps({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-tank-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(String(IDS.T1));

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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .eps({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-tank-level-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const tank = resultsReader.getTank(String(IDS.T1));

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
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-nonexistent";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);

      expect(resultsReader.getJunction("nonexistent")).toBeNull();
      expect(resultsReader.getPipe("nonexistent")).toBeNull();
      expect(resultsReader.getValve("nonexistent")).toBeNull();
      expect(resultsReader.getPump("nonexistent")).toBeNull();
      expect(resultsReader.getTank("nonexistent")).toBeNull();
    });

    it("returns null results reader when accessing timestep out of range", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-out-of-range";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const negativeIndexReader = await reader.getResultsForTimestep(-1);
      expect(negativeIndexReader.getJunction(String(IDS.J1))).toBeNull();

      const highIndexReader = await reader.getResultsForTimestep(100);
      expect(highIndexReader.getPipe(String(IDS.P1))).toBeNull();
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          length: pipeLength,
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-pipe-headloss";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(String(IDS.P1));

      expect(pipe).not.toBeNull();
      // headloss = unitHeadloss * (length / 1000)
      // For 1000m pipe: headloss should equal unitHeadloss
      expect(pipe?.headloss).toBeCloseTo(pipe?.unitHeadloss ?? 0, 5);
    });

    it("reads pump results with headloss and status", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 1 }], elevation: 0 })
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 1, y: 1 }] })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-pump-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pump = resultsReader.getPump(String(IDS.PUMP1));

      expect(pump).not.toBeNull();
      expect(pump?.type).toEqual("pump");
      expect(pump?.flow).toBeGreaterThanOrEqual(0);
      expect(pump?.headloss).toBeCloseTo(-1);
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          length: pipeLength,
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-pipe-length";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pipe = resultsReader.getPipe(String(IDS.P1));

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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 3 }], elevation: 0 })
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 1, y: 1 }] })
        .eps({ duration: 3600, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-pump-xflow";
      const { status } = await runSimulation(inp, testAppId);
      // Expect warning because pump is operating beyond its curve
      expect(status).toEqual("warning");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const pump = resultsReader.getPump(String(IDS.PUMP1));

      expect(pump).not.toBeNull();
      expect(pump?.type).toEqual("pump");
      expect(pump?.status).toEqual("on");
      expect(pump?.statusWarning).toEqual("cannot-deliver-flow");
    });

    it("reads pump status across multiple timesteps", async () => {
      const IDS = { R1: 1, J1: 2, PUMP1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 50 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }], elevation: 0 })
        .aPump(IDS.PUMP1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .aPumpCurve({ id: String(IDS.PUMP1), points: [{ x: 20, y: 40 }] })
        .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
        .build();
      const inp = buildInp(hydraulicModel);

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
        const pump = resultsReader.getPump(String(IDS.PUMP1));

        expect(pump).not.toBeNull();
        expect(pump?.type).toEqual("pump");
        expect(pump?.status).toMatch(/on|off/);
      }
    });

    it("reads valve results with flow and status", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 1 }] })
        .aValve(IDS.V1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-valve-reader";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("success");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const valve = resultsReader.getValve(String(IDS.V1));

      expect(valve).not.toBeNull();
      expect(valve?.type).toEqual("valve");
      expect(valve?.flow).toBeGreaterThan(0);
      expect(valve?.status).toMatch(/active|open|closed/);
    });

    it("reads closed valve status", async () => {
      const IDS = { R1: 1, J1: 2, V1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 1 }] })
        .aValve(IDS.V1, {
          startNodeId: IDS.R1,
          endNodeId: IDS.J1,
          initialStatus: "closed",
        })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-valve-closed";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("warning"); // Warning due to negative pressures

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const resultsReader = await reader.getResultsForTimestep(0);
      const valve = resultsReader.getValve(String(IDS.V1));

      expect(valve).not.toBeNull();
      expect(valve?.status).toEqual("closed");
    });

    it("returns null results when simulation fails", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { demands: [{ baseDemand: 1 }] })
        .aJunction(IDS.J2) // Disconnected junction causes failure
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-failed-simulation";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("failure");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toEqual(0);
      const resultsReader = await reader.getResultsForTimestep(0);
      expect(resultsReader.getJunction(String(IDS.J1))).toBeNull();
      expect(resultsReader.getPipe(String(IDS.P1))).toBeNull();
    });
  });

  describe("getNodeTimeSeries", () => {
    it("reads node pressure time series across multiple timesteps", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }], elevation: 10 })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-node-time-series";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getNodeTimeSeries(IDS.J1, "pressure");

      expect(timeSeries).not.toBeNull();
      expect(timeSeries!.timestepCount).toBe(3);
      expect(timeSeries!.values).toBeInstanceOf(Float32Array);
      expect(timeSeries!.values.length).toBe(3);
      expect(timeSeries!.reportingTimeStep).toBe(3600);
    });

    it("returns values matching getResultsForTimestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }], elevation: 10 })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-node-series-values";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const pressureSeries = await reader.getNodeTimeSeries(IDS.J1, "pressure");
      const headSeries = await reader.getNodeTimeSeries(IDS.J1, "head");
      const demandSeries = await reader.getNodeTimeSeries(IDS.J1, "demand");

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const junction = resultsReader.getJunction(String(IDS.J1));

        expect(pressureSeries!.values[t]).toBeCloseTo(junction!.pressure, 5);
        expect(headSeries!.values[t]).toBeCloseTo(junction!.head, 5);
        expect(demandSeries!.values[t]).toBeCloseTo(junction!.demand, 5);
      }
    });

    it("returns null for non-existent node", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-node-nonexistent";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getNodeTimeSeries(999, "pressure");
      expect(timeSeries).toBeNull();
    });

    it("reads all node property types", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }], elevation: 10 })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-node-all-properties";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const properties = ["demand", "head", "pressure", "quality"] as const;
      for (const property of properties) {
        const timeSeries = await reader.getNodeTimeSeries(IDS.J1, property);
        expect(timeSeries).not.toBeNull();
        expect(timeSeries!.values).toBeInstanceOf(Float32Array);
      }
    });

    it("throws error when not initialized", async () => {
      const storage = new InMemoryStorage("test-node-uninitialized");
      const reader = new EPSResultsReader(storage);

      await expect(reader.getNodeTimeSeries(1, "pressure")).rejects.toThrow(
        /not initialized/i,
      );
    });
  });

  describe("getLinkTimeSeries", () => {
    it("reads link flow time series across multiple timesteps", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-link-time-series";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getLinkTimeSeries(IDS.P1, "flow");

      expect(timeSeries).not.toBeNull();
      expect(timeSeries!.timestepCount).toBe(3);
      expect(timeSeries!.values).toBeInstanceOf(Float32Array);
      expect(timeSeries!.values.length).toBe(3);
      expect(timeSeries!.reportingTimeStep).toBe(3600);
    });

    it("returns values matching getResultsForTimestep", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-link-series-values";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const flowSeries = await reader.getLinkTimeSeries(IDS.P1, "flow");
      const velocitySeries = await reader.getLinkTimeSeries(IDS.P1, "velocity");

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const pipe = resultsReader.getPipe(String(IDS.P1));

        expect(flowSeries!.values[t]).toBeCloseTo(pipe!.flow, 5);
        expect(velocitySeries!.values[t]).toBeCloseTo(pipe!.velocity, 5);
      }
    });

    it("returns null for non-existent link", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-link-nonexistent";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getLinkTimeSeries(999, "flow");
      expect(timeSeries).toBeNull();
    });

    it("reads all link property types", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-link-all-properties";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const properties = [
        "flow",
        "velocity",
        "headloss",
        "avgQuality",
        "status",
        "setting",
        "reactionRate",
        "friction",
      ] as const;
      for (const property of properties) {
        const timeSeries = await reader.getLinkTimeSeries(IDS.P1, property);
        expect(timeSeries).not.toBeNull();
        expect(timeSeries!.values).toBeInstanceOf(Float32Array);
      }
    });

    it("throws error when not initialized", async () => {
      const storage = new InMemoryStorage("test-link-uninitialized");
      const reader = new EPSResultsReader(storage);

      await expect(reader.getLinkTimeSeries(1, "flow")).rejects.toThrow(
        /not initialized/i,
      );
    });
  });

  describe("getTankVolumeTimeSeries", () => {
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-tank-volume-series";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getTankVolumeTimeSeries(IDS.T1);

      expect(timeSeries).not.toBeNull();
      expect(timeSeries!.timestepCount).toBe(3);
      expect(timeSeries!.values).toBeInstanceOf(Float32Array);
      expect(timeSeries!.values.length).toBe(3);
      expect(timeSeries!.reportingTimeStep).toBe(3600);
    });

    it("returns values matching getResultsForTimestep tank volumes", async () => {
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
        .aJunction(IDS.J1, { demands: [{ baseDemand: 10 }] })
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
        .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 3600 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-tank-volume-values";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const volumeSeries = await reader.getTankVolumeTimeSeries(IDS.T1);

      for (let t = 0; t < reader.timestepCount; t++) {
        const resultsReader = await reader.getResultsForTimestep(t);
        const tank = resultsReader.getTank(String(IDS.T1));

        expect(volumeSeries!.values[t]).toBeCloseTo(tank!.volume, 5);
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
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-tank-nonexistent";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getTankVolumeTimeSeries(999);
      expect(timeSeries).toBeNull();
    });

    it("returns null for junction (non-tank node)", async () => {
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

      const testAppId = "test-tank-junction";
      await runSimulation(inp, testAppId);

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      const timeSeries = await reader.getTankVolumeTimeSeries(IDS.J1);
      expect(timeSeries).toBeNull();
    });

    it("throws error when not initialized", async () => {
      const storage = new InMemoryStorage("test-tank-uninitialized");
      const reader = new EPSResultsReader(storage);

      await expect(reader.getTankVolumeTimeSeries(1)).rejects.toThrow(
        /not initialized/i,
      );
    });
  });

  describe("edge cases", () => {
    it("returns null for time series when simulation fails with 0 timesteps", async () => {
      const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1)
        .aJunction(IDS.J1, { demands: [{ baseDemand: 1 }] })
        .aJunction(IDS.J2) // Disconnected junction causes failure
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .build();
      const inp = buildInp(hydraulicModel);

      const testAppId = "test-empty-series";
      const { status } = await runSimulation(inp, testAppId);
      expect(status).toEqual("failure");

      const storage = new InMemoryStorage(testAppId);
      const reader = new EPSResultsReader(storage);
      await reader.initialize();

      expect(reader.timestepCount).toBe(0);

      // When simulation fails, no IDs are available so lookups return null
      const nodeSeries = await reader.getNodeTimeSeries(IDS.J1, "pressure");
      expect(nodeSeries).toBeNull();

      const linkSeries = await reader.getLinkTimeSeries(IDS.P1, "flow");
      expect(linkSeries).toBeNull();
    });

    it("reportingTimeStep accessor returns correct value", async () => {
      const IDS = { R1: 1, J1: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aReservoir(IDS.R1, { head: 100 })
        .aJunction(IDS.J1)
        .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
        .eps({ duration: 7200, hydraulicTimestep: 1800, reportTimestep: 900 })
        .build();
      const inp = buildInp(hydraulicModel);

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
  });
});
