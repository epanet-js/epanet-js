import {
  InitHydOption,
  NodeProperty,
  NodeType,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";
import {
  saveEPSSimulation,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
  type TankTimestepData,
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
  modelVersion: string,
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

    // Find tank indices before simulation loop
    const nodeCount = model.getCount(0); // CountType.Node = 0
    const tankIndices: { index: number; id: string }[] = [];
    for (let i = 1; i <= nodeCount; i++) {
      if (model.getNodeType(i) === NodeType.Tank) {
        tankIndices.push({ index: i, id: model.getNodeId(i) });
      }
    }

    // Initialize tank data storage
    const tankData = new Map<string, TankTimestepData[]>();
    for (const tank of tankIndices) {
      tankData.set(tank.id, []);
    }

    // Run hydraulic simulation step by step for progress reporting
    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    let currentTime = 0;

    // Run hydraulic timesteps
    do {
      currentTime = model.runH();

      // Capture tank volume at each timestep (level is available as pressure in binary)
      for (const tank of tankIndices) {
        const volume = model.getNodeValue(tank.index, NodeProperty.TankVolume);
        tankData.get(tank.id)!.push({ volume });
      }

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
      modelVersion,
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
      tankData: tankData.size > 0 ? tankData : undefined,
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
      modelVersion,
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
