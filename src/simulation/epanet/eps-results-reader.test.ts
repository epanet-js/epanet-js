import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInpEPS } from "../build-inp-eps";
import { runEPSSimulation as workerRunEPSSimulation } from "./worker-eps";
import { runEPSSimulation } from "./main";
import { lib } from "src/lib/worker";
import { Mock } from "vitest";
import { EPSResultsReader } from "./eps-results-reader";
import { SimulationMetadata } from "./simulation-metadata";
import { InMemoryStorage } from "src/infra/storage";

vi.mock("src/lib/worker", () => ({
  lib: {
    runEPSSimulation: vi.fn(),
  },
}));

describe("EPSResultsReader", () => {
  beforeEach(() => {
    (lib.runEPSSimulation as unknown as Mock).mockImplementation(
      workerRunEPSSimulation,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads junction results for a single timestep", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { head: 100 })
      .aJunction(IDS.J1, { baseDemand: 10, elevation: 10 })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-junction-reader";
    const { status } = await runEPSSimulation(inp, testAppId);
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
      .aJunction(IDS.J1, { baseDemand: 10 })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-pipe-reader";
    const { status } = await runEPSSimulation(inp, testAppId);
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
      .aJunction(IDS.J1, { baseDemand: 10 })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .eps({ duration: 7200, hydraulicTimestep: 3600 }) // 2 hours, 1 hour timestep
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-multi-timestep";
    const { status, metadata } = await runEPSSimulation(inp, testAppId);
    const prolog = new SimulationMetadata(metadata);
    expect(status).toEqual("success");
    expect(prolog.reportingPeriods).toBe(3); // initial + 2 timesteps

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
      .aJunction(IDS.J1, { baseDemand: 10 })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.T1 })
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .eps({ duration: 3600, hydraulicTimestep: 3600 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-tank-reader";
    const { status } = await runEPSSimulation(inp, testAppId);
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

  it("returns null for non-existent assets", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-nonexistent";
    await runEPSSimulation(inp, testAppId);

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

  it("throws error when accessing timestep out of range", async () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1)
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();
    const inp = buildInpEPS(hydraulicModel);

    const testAppId = "test-out-of-range";
    await runEPSSimulation(inp, testAppId);

    const storage = new InMemoryStorage(testAppId);
    const reader = new EPSResultsReader(storage);
    await reader.initialize();

    await expect(reader.getResultsForTimestep(-1)).rejects.toThrow(
      /out of range/,
    );
    await expect(reader.getResultsForTimestep(100)).rejects.toThrow(
      /out of range/,
    );
  });

  it("throws error when not initialized", async () => {
    const storage = new InMemoryStorage("test-uninitialized");
    const reader = new EPSResultsReader(storage);

    expect(() => reader.timestepCount).toThrow(/not initialized/i);
    await expect(reader.getResultsForTimestep(0)).rejects.toThrow(
      /not initialized/i,
    );
  });
});
