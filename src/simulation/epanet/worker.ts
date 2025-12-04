import { InitHydOption, Project, Workspace } from "epanet-js";
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

export type SimulationProgress = {
  /** Current simulation time in seconds */
  currentTime: number;
  /** Total simulation duration in seconds (0 if unknown) */
  totalDuration: number;
};

export type ProgressCallback = (progress: SimulationProgress) => void;

/**
 * Runs a hydraulic simulation and stores results in IndexedDB.
 *
 * Uses step-by-step hydraulic solving to report progress.
 * Results are accessed via loadEPSSimulation() from the main thread.
 */
export const runSimulation = async (
  inp: string,
  simulationId: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<SimulationResult> => {
  // eslint-disable-next-line
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    // Open model
    model.open("net.inp", "report.rpt", "results.out");

    // Get total simulation duration from time parameters
    const totalDuration = model.getTimeParameter(0); // Duration parameter

    // Run hydraulic simulation step by step for progress reporting
    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    let currentTime = 0;

    // Run hydraulic timesteps
    do {
      currentTime = model.runH();

      // Report progress
      if (onProgress) {
        onProgress({ currentTime, totalDuration });
      }
    } while (model.nextH() > 0);

    // Save results to binary file
    model.saveH();

    // Read the binary output file
    const binaryData = ws.readFile("results.out", "binary");

    // Parse prolog to get metadata
    const prolog = parseProlog(binaryData);

    // Create metadata
    const metadata: EPSSimulationMetadata = {
      simulationId,
      createdAt: Date.now(),
      duration: totalDuration,
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
