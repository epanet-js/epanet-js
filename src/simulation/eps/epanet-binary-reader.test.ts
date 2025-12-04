import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Project, Workspace } from "epanet-js";
import { buildInpEPS } from "../build-inp-eps";
import {
  EpanetBinaryReader,
  BinaryLinkType,
  parseProlog,
  extractNodeIds,
  extractLinkIds,
  extractLinkTypes,
  extractTankIndices,
  extractTimestepResults,
} from "./epanet-binary-reader";
import { binaryToSimulationResults } from "./convert-binary-results";

/**
 * These tests verify the EPANET binary reader against actual EPANET output.
 * They run the simulation directly (not through web worker) and read the binary.
 */
describe("EPANET binary reader", () => {
  it("parses prolog from binary output", async () => {
    const { binaryData } = await runSimulationAndGetBinary({
      duration: 3600, // 1 hour
      reportTimestep: 3600,
    });

    const prolog = parseProlog(binaryData);

    expect(prolog.nodeCount).toEqual(2); // Reservoir + Junction
    expect(prolog.linkCount).toEqual(1); // Pipe
    expect(prolog.reportingPeriods).toBeGreaterThan(0);
  });

  it("extracts node IDs from binary", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const prolog = parseProlog(binaryData);
    const nodeIds = extractNodeIds(binaryData, prolog);

    expect(nodeIds.length).toEqual(2);
    expect(nodeIds).toContain(String(ids.R1));
    expect(nodeIds).toContain(String(ids.J1));
  });

  it("extracts link IDs from binary", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const prolog = parseProlog(binaryData);
    const linkIds = extractLinkIds(binaryData, prolog);

    expect(linkIds.length).toEqual(1);
    expect(linkIds).toContain(String(ids.P1));
  });

  it("extracts timestep results with correct values", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const prolog = parseProlog(binaryData);
    const nodeIds = extractNodeIds(binaryData, prolog);
    const linkIds = extractLinkIds(binaryData, prolog);

    const results = extractTimestepResults(
      binaryData,
      prolog,
      0,
      nodeIds,
      linkIds,
    );

    // Check structure
    expect(results.timestepIndex).toEqual(0);
    expect(results.nodes.length).toEqual(2);
    expect(results.links.length).toEqual(1);

    // Check junction has reasonable pressure
    const junction = results.nodes.find((n) => n.id === String(ids.J1));
    expect(junction).toBeDefined();
    expect(junction!.pressure).toBeGreaterThan(0);

    // Check pipe has flow
    const pipe = results.links.find((l) => l.id === String(ids.P1));
    expect(pipe).toBeDefined();
    expect(Math.abs(pipe!.flow)).toBeGreaterThan(0);
  });

  it("can read multiple timesteps from EPS simulation", async () => {
    const { binaryData } = await runSimulationAndGetBinary({
      duration: 6 * 3600, // 6 hours
      reportTimestep: 3600, // hourly
    });

    const prolog = parseProlog(binaryData);
    const nodeIds = extractNodeIds(binaryData, prolog);
    const linkIds = extractLinkIds(binaryData, prolog);

    // Should have 7 timesteps (0, 1, 2, 3, 4, 5, 6 hours)
    expect(prolog.reportingPeriods).toBeGreaterThanOrEqual(6);

    // Read first and last timesteps
    const first = extractTimestepResults(
      binaryData,
      prolog,
      0,
      nodeIds,
      linkIds,
    );
    const last = extractTimestepResults(
      binaryData,
      prolog,
      prolog.reportingPeriods - 1,
      nodeIds,
      linkIds,
    );

    expect(first.nodes.length).toEqual(last.nodes.length);
    expect(first.links.length).toEqual(last.links.length);
  });

  it("EpanetBinaryReader provides convenient access", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3 * 3600,
      reportTimestep: 3600,
    });

    const reader = new EpanetBinaryReader(binaryData);

    expect(reader.getTimestepCount()).toBeGreaterThan(0);
    expect(reader.getNodeIds()).toContain(String(ids.J1));
    expect(reader.getLinkIds()).toContain(String(ids.P1));

    const results = reader.getTimestepResults(0);
    expect(results.nodes.length).toBeGreaterThan(0);
  });

  it("throws error for invalid timestep index", async () => {
    const { binaryData } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const reader = new EpanetBinaryReader(binaryData);
    const maxIndex = reader.getTimestepCount();

    expect(() => reader.getTimestepResults(-1)).toThrow();
    expect(() => reader.getTimestepResults(maxIndex + 10)).toThrow();
  });

  it("extracts link types from binary", async () => {
    const { binaryData } = await runSimulationWithPumpAndValve();

    const prolog = parseProlog(binaryData);
    const linkTypes = extractLinkTypes(binaryData, prolog);

    expect(linkTypes.length).toEqual(prolog.linkCount);
    expect(linkTypes).toContain(BinaryLinkType.Pipe);
    expect(linkTypes).toContain(BinaryLinkType.Pump);
    // Valve types are stored in binary (PRV=3, PSV=4, etc.)
    // Just verify we have some valve type
    const hasValve = linkTypes.some(
      (t) =>
        t === BinaryLinkType.PRV ||
        t === BinaryLinkType.PSV ||
        t === BinaryLinkType.PBV ||
        t === BinaryLinkType.FCV ||
        t === BinaryLinkType.TCV ||
        t === BinaryLinkType.GPV,
    );
    expect(hasValve).toBe(true);
  });

  it("extracts tank indices from binary", async () => {
    const { binaryData } = await runSimulationWithTank();

    const prolog = parseProlog(binaryData);
    const tankIndices = extractTankIndices(binaryData, prolog);

    // Should have 1 reservoir + 1 tank
    expect(prolog.resAndTankCount).toEqual(2);
    expect(tankIndices.length).toEqual(2);
    // Tank indices are 0-based
    tankIndices.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(prolog.nodeCount);
    });
  });

  it("identifies tank nodes correctly", async () => {
    const { binaryData, ids } = await runSimulationWithTank();

    const reader = new EpanetBinaryReader(binaryData);
    const nodeIds = reader.getNodeIds();

    // Find indices for each node type
    const reservoirIdx = nodeIds.indexOf(String(ids.R1));
    const tankIdx = nodeIds.indexOf(String(ids.T1));
    const junctionIdx = nodeIds.indexOf(String(ids.J1));

    expect(reader.isTankOrReservoir(reservoirIdx)).toBe(true);
    expect(reader.isTankOrReservoir(tankIdx)).toBe(true);
    expect(reader.isTankOrReservoir(junctionIdx)).toBe(false);
  });
});

describe("Binary to SimulationResults converter", () => {
  it("converts junction results correctly", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const results = binaryToSimulationResults(binaryData, 0);

    const junction = results.get(String(ids.J1));
    expect(junction).toBeDefined();
    expect(junction!.type).toEqual("junction");
    expect((junction as { pressure: number }).pressure).toBeGreaterThan(0);
  });

  it("converts pipe results correctly", async () => {
    const { binaryData, ids } = await runSimulationAndGetBinary({
      duration: 3600,
      reportTimestep: 3600,
    });

    const results = binaryToSimulationResults(binaryData, 0);

    const pipe = results.get(String(ids.P1));
    expect(pipe).toBeDefined();
    expect(pipe!.type).toEqual("pipe");
    // Check pipe has flow (water is moving through)
    expect(Math.abs((pipe as { flow: number }).flow)).toBeGreaterThan(0);
  });

  it("converts pump results correctly", async () => {
    const { binaryData, ids } = await runSimulationWithPumpAndValve();

    const results = binaryToSimulationResults(binaryData, 0);

    const pump = results.get(String(ids.PUMP));
    expect(pump).toBeDefined();
    expect(pump!.type).toEqual("pump");
    // Check pump has reasonable flow (pump is moving water)
    expect(Math.abs((pump as { flow: number }).flow)).toBeGreaterThan(0);
  });

  it("converts valve results correctly", async () => {
    const { binaryData, ids } = await runSimulationWithPumpAndValve();

    const results = binaryToSimulationResults(binaryData, 0);

    const valve = results.get(String(ids.VALVE));
    expect(valve).toBeDefined();
    expect(valve!.type).toEqual("valve");
  });

  it("converts tank results correctly", async () => {
    const { binaryData, ids } = await runSimulationWithTank();

    const results = binaryToSimulationResults(binaryData, 0);

    const tank = results.get(String(ids.T1));
    expect(tank).toBeDefined();
    expect(tank!.type).toEqual("tank");
    expect((tank as { head: number }).head).toBeGreaterThan(0);
  });

  it("converts closed valve correctly", async () => {
    const { binaryData, ids } = await runSimulationWithClosedValve();

    const results = binaryToSimulationResults(binaryData, 0);

    const valve = results.get(String(ids.VALVE));
    expect(valve).toBeDefined();
    expect(valve!.type).toEqual("valve");
    expect((valve as { status: string }).status).toEqual("closed");
  });
});

// Helper to run simulation and get binary output
async function runSimulationAndGetBinary(epsConfig: {
  duration: number;
  reportTimestep?: number;
  hydraulicTimestep?: number;
}): Promise<{
  binaryData: Uint8Array;
  ids: { R1: number; J1: number; P1: number };
}> {
  const IDS = { R1: 1, J1: 2, P1: 3 } as const;

  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { baseDemand: 1, elevation: 0 })
    .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
    .eps({
      duration: epsConfig.duration,
      hydraulicTimestep: epsConfig.hydraulicTimestep ?? 3600,
      reportTimestep: epsConfig.reportTimestep ?? 3600,
    })
    .build();

  const inp = buildInpEPS(hydraulicModel);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);
  model.open("net.inp", "report.rpt", "results.out");
  model.solveH();
  model.saveH(); // Write binary output file

  const binaryData = ws.readFile("results.out", "binary");
  model.close();

  return { binaryData, ids: IDS };
}

// Helper to run simulation with pump and valve
async function runSimulationWithPumpAndValve(): Promise<{
  binaryData: Uint8Array;
  ids: {
    R1: number;
    J1: number;
    J2: number;
    J3: number;
    PIPE: number;
    PUMP: number;
    VALVE: number;
  };
}> {
  const IDS = {
    R1: 1,
    J1: 2,
    J2: 3,
    J3: 4,
    PIPE: 5,
    PUMP: 6,
    VALVE: 7,
  } as const;

  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 50 })
    .aJunction(IDS.J1, { baseDemand: 0, elevation: 0 })
    .aJunction(IDS.J2, { baseDemand: 0, elevation: 0 })
    .aJunction(IDS.J3, { baseDemand: 1, elevation: 0 })
    .aPipe(IDS.PIPE, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
    .aPump(IDS.PUMP, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      power: 10,
      definitionType: "power",
    })
    .aValve(IDS.VALVE, {
      startNodeId: IDS.J2,
      endNodeId: IDS.J3,
      kind: "prv",
      setting: 30,
    })
    .eps({ duration: 3600, hydraulicTimestep: 3600, reportTimestep: 3600 })
    .build();

  const inp = buildInpEPS(hydraulicModel);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);
  model.open("net.inp", "report.rpt", "results.out");
  model.solveH();
  model.saveH();

  const binaryData = ws.readFile("results.out", "binary");
  model.close();

  return { binaryData, ids: IDS };
}

// Helper to run simulation with tank
async function runSimulationWithTank(): Promise<{
  binaryData: Uint8Array;
  ids: { R1: number; J1: number; T1: number; P1: number; P2: number };
}> {
  const IDS = { R1: 1, J1: 2, T1: 3, P1: 4, P2: 5 } as const;

  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { baseDemand: 0.5, elevation: 0 })
    .aTank(IDS.T1, {
      elevation: 10,
      initialLevel: 5,
      minLevel: 0,
      maxLevel: 10,
      diameter: 10,
    })
    .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
    .aPipe(IDS.P2, { startNodeId: IDS.J1, endNodeId: IDS.T1 })
    .eps({ duration: 3600, hydraulicTimestep: 3600, reportTimestep: 3600 })
    .build();

  const inp = buildInpEPS(hydraulicModel);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);
  model.open("net.inp", "report.rpt", "results.out");
  model.solveH();
  model.saveH();

  const binaryData = ws.readFile("results.out", "binary");
  model.close();

  return { binaryData, ids: IDS };
}

// Helper to run simulation with a closed valve
async function runSimulationWithClosedValve(): Promise<{
  binaryData: Uint8Array;
  ids: { R1: number; J1: number; J2: number; PIPE: number; VALVE: number };
}> {
  const IDS = { R1: 1, J1: 2, J2: 3, PIPE: 4, VALVE: 5 } as const;

  // Note: Valves cannot connect directly to reservoirs in EPANET
  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { baseDemand: 0, elevation: 0 })
    .aJunction(IDS.J2, { baseDemand: 1, elevation: 0 })
    .aPipe(IDS.PIPE, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
    .aValve(IDS.VALVE, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      kind: "prv",
      setting: 30,
      initialStatus: "closed",
    })
    .eps({ duration: 3600, hydraulicTimestep: 3600, reportTimestep: 3600 })
    .build();

  const inp = buildInpEPS(hydraulicModel);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);
  model.open("net.inp", "report.rpt", "results.out");
  model.solveH();
  model.saveH();

  const binaryData = ws.readFile("results.out", "binary");
  model.close();

  return { binaryData, ids: IDS };
}
