import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Project, Workspace } from "epanet-js";
import { buildInpEPS } from "../build-inp-eps";
import {
  EpanetBinaryReader,
  parseProlog,
  extractNodeIds,
  extractLinkIds,
  extractTimestepResults,
} from "./epanet-binary-reader";

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
