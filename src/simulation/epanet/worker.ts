import {
  InitHydOption,
  NodeProperty,
  NodeType,
  Project,
  Workspace,
} from "epanet-js";
import { SimulationStatus } from "../result";
import {
  initOPFS,
  writeBinaryToOPFS,
  writeTankBinaryToOPFS,
} from "../eps/eps-store";

export type SimulationResult = {
  status: SimulationStatus;
  report: string;
};

export type SimulationProgress = {
  /** Current simulation time in seconds */
  currentTime: number;
  /** Total simulation duration in seconds (0 if unknown) */
  totalDuration: number;
};

export type ProgressCallback = (progress: SimulationProgress) => void;

/**
 * Runs a hydraulic simulation and stores results in OPFS.
 *
 * Uses step-by-step hydraulic solving to report progress.
 * Results are accessed via partial reads from the main thread.
 */
export const runSimulation = async (
  inp: string,
  appId: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<SimulationResult> => {
  // eslint-disable-next-line
  if (Object.keys(flags).length) console.log("Running with flags", flags);

  // Initialize OPFS with the app ID from main thread
  initOPFS(appId);

  const ws = new Workspace();
  await ws.loadModule();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    // Open model
    model.open("net.inp", "report.rpt", "results.out");

    // Get total simulation duration from time parameters
    const totalDuration = model.getTimeParameter(0); // Duration parameter

    // Identify tanks and reservoirs for capturing volume data (1-based EPANET indices)
    // Must match the order in the binary prolog (tanks and reservoirs together)
    const nodeCount = model.getCount(0); // CountType.Node = 0
    const tankAndReservoirIndices: number[] = [];
    for (let i = 1; i <= nodeCount; i++) {
      const nodeType = model.getNodeType(i);
      if (nodeType === NodeType.Tank || nodeType === NodeType.Reservoir) {
        tankAndReservoirIndices.push(i);
      }
    }
    const tankCount = tankAndReservoirIndices.length;

    // Collect tank volumes per timestep (will convert to binary after simulation)
    const tankVolumesPerTimestep: number[][] = [];

    // Run hydraulic simulation step by step for progress reporting
    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    let currentTime = 0;

    // Run hydraulic timesteps
    do {
      currentTime = model.runH();

      // Capture tank/reservoir volumes at this timestep (in tank index order)
      const timestepVolumes: number[] = [];
      for (const epanetIndex of tankAndReservoirIndices) {
        const volume = model.getNodeValue(epanetIndex, NodeProperty.TankVolume);
        timestepVolumes.push(volume);
      }
      tankVolumesPerTimestep.push(timestepVolumes);

      // Report progress
      if (onProgress) {
        onProgress({ currentTime, totalDuration });
      }
    } while (model.nextH() > 0);

    // Save results to binary file
    model.saveH();

    // Read the binary output file
    const binaryData = ws.readFile("results.out", "binary");

    // Write binary to OPFS for partial reading
    await writeBinaryToOPFS(binaryData);

    // Convert tank volumes to binary format (Float32, organized by timestep)
    // Format: [timestep0_tank0, timestep0_tank1, ..., timestep1_tank0, ...]
    if (tankCount > 0 && tankVolumesPerTimestep.length > 0) {
      const tankBinaryData = new Float32Array(
        tankVolumesPerTimestep.length * tankCount,
      );
      for (let t = 0; t < tankVolumesPerTimestep.length; t++) {
        for (let i = 0; i < tankCount; i++) {
          tankBinaryData[t * tankCount + i] = tankVolumesPerTimestep[t][i];
        }
      }
      await writeTankBinaryToOPFS(new Uint8Array(tankBinaryData.buffer));
    }

    model.close();

    const report = ws.readFile("report.rpt");

    return {
      status: report.includes("WARNING") ? "warning" : "success",
      report: curateReport(report),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Simulation failed:", error);
    model.close();
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
