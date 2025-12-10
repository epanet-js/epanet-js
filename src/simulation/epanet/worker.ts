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
    // eslint-disable-next-line no-console
    console.log("[WORKER] Opening model...");
    model.open("net.inp", "report.rpt", "results.out");
    // eslint-disable-next-line no-console
    console.log("[WORKER] Model opened");

    // Get total simulation duration from time parameters
    const totalDuration = model.getTimeParameter(0); // Duration parameter
    // eslint-disable-next-line no-console
    console.log(`[WORKER] Total duration: ${totalDuration}`);

    // Identify tanks and reservoirs for capturing volume data (1-based EPANET indices)
    // Must match the order in the binary prolog (tanks and reservoirs together)
    const nodeCount = model.getCount(0); // CountType.Node = 0
    // eslint-disable-next-line no-console
    console.log(`[WORKER] Node count: ${nodeCount}`);
    const tankAndReservoirIndices: number[] = [];
    for (let i = 1; i <= nodeCount; i++) {
      const nodeType = model.getNodeType(i);
      if (nodeType === NodeType.Tank || nodeType === NodeType.Reservoir) {
        tankAndReservoirIndices.push(i);
      }
    }
    const tankCount = tankAndReservoirIndices.length;
    // eslint-disable-next-line no-console
    console.log(`[WORKER] Tank count: ${tankCount}`);

    // Collect tank volumes per timestep (will convert to binary after simulation)
    const tankVolumesPerTimestep: number[][] = [];

    // Use step-by-step hydraulic solving to capture tank volumes at each timestep
    // eslint-disable-next-line no-console
    console.log("[WORKER] Running step-by-step hydraulic simulation...");
    model.openH();
    model.initH(InitHydOption.SaveAndInit);

    let currentTime: number;
    do {
      currentTime = model.runH();

      // Capture tank volumes at this timestep
      if (tankCount > 0) {
        const volumes: number[] = [];
        for (const nodeIndex of tankAndReservoirIndices) {
          const volume = model.getNodeValue(nodeIndex, NodeProperty.TankVolume);
          volumes.push(volume);
        }
        tankVolumesPerTimestep.push(volumes);
      }

      // Report progress
      if (onProgress) {
        onProgress({ currentTime, totalDuration });
      }
    } while (model.nextH() > 0);

    // Close hydraulics first (finalizes the hydraulics file)
    // Then saveH transfers from hydraulics file to output file
    // eslint-disable-next-line no-console
    console.log("[WORKER] Closing and saving hydraulic results...");
    model.closeH();
    model.saveH();
    // eslint-disable-next-line no-console
    console.log(
      `[WORKER] Simulation complete: ${tankVolumesPerTimestep.length} timesteps captured`,
    );

    // Read the binary output file
    // eslint-disable-next-line no-console
    console.log("[WORKER] Reading binary file...");
    const binaryData = ws.readFile("results.out", "binary");
    // eslint-disable-next-line no-console
    console.log("[WORKER] Binary file read successfully");
    // eslint-disable-next-line no-console
    console.log(
      `[WORKER] Binary data read from EPANET: ${binaryData.length} bytes, appId=${appId}`,
    );

    // Write binary to OPFS for partial reading
    await writeBinaryToOPFS(binaryData);
    // eslint-disable-next-line no-console
    console.log("[WORKER] Binary data written to OPFS");

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
    // eslint-disable-next-line no-console
    console.error(
      "Error details:",
      error instanceof Error ? error.stack : String(error),
    );
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
