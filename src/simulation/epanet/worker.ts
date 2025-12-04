import { Project, Workspace } from "epanet-js";
import { SimulationStatus } from "../result";
import {
  saveEPSSimulation,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
} from "../eps/eps-store";
import { parseProlog } from "../eps/epanet-binary-reader";

export type SimulationResult = {
  status: SimulationStatus;
  report: string;
  simulationId: string;
  metadata: EPSSimulationMetadata;
};

/**
 * Runs a hydraulic simulation and stores results in IndexedDB.
 *
 * Uses solveH + saveH to run the simulation and store binary output.
 * Results are accessed via loadEPSSimulation() from the main thread.
 */
export const runSimulation = async (
  inp: string,
  simulationId: string,
  flags: Record<string, boolean> = {},
): Promise<SimulationResult> => {
  // eslint-disable-next-line
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    // Open model and run full hydraulic simulation
    model.open("net.inp", "report.rpt", "results.out");
    model.solveH(); // Runs full simulation (handles both steady-state and EPS)
    model.saveH(); // Save binary output to results.out

    // Read the binary output file
    const binaryData = ws.readFile("results.out", "binary");

    // Parse prolog to get metadata
    const prolog = parseProlog(binaryData);

    // Create metadata
    const metadata: EPSSimulationMetadata = {
      simulationId,
      createdAt: Date.now(),
      duration: 0, // Duration determined by INP time settings
      timestepCount: prolog.reportingPeriods,
      nodeCount: prolog.nodeCount,
      linkCount: prolog.linkCount,
    };

    // Store in IndexedDB
    const record: EPSSimulationRecord = {
      metadata,
      binaryData,
    };
    await saveEPSSimulation(record);

    model.close();

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
      simulationId,
      metadata,
    };
  } catch (error) {
    model.close();
    const report = ws.readFile("report.rpt");

    // Create error metadata
    const errorMetadata: EPSSimulationMetadata = {
      simulationId,
      createdAt: Date.now(),
      duration: 0,
      timestepCount: 0,
      nodeCount: 0,
      linkCount: 0,
    };

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
      simulationId,
      metadata: errorMetadata,
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
