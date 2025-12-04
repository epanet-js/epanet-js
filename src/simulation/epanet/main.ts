import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import { loadEPSSimulation } from "../eps/eps-store";
import { EpanetBinaryReader, convertTimestepToSimulationResults } from "../eps";
import type { ProgressCallback, SimulationProgress } from "./worker";

export type { SimulationProgress };

/**
 * Runs a hydraulic simulation and returns results.
 *
 * The worker stores binary results in IndexedDB. This function
 * loads the results and converts the first timestep to SimulationResults.
 *
 * @param inp - The EPANET INP file content
 * @param flags - Optional flags for the simulation
 * @param onProgress - Optional callback for progress updates during simulation
 */
export const runSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
  onProgress?: ProgressCallback,
): Promise<SimulationResult> => {
  // Generate unique simulation ID
  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Wrap callback with Comlink.proxy for cross-worker communication
  const wrappedProgress: ProgressCallback | undefined = onProgress
    ? (progress) => {
        const percent =
          progress.totalDuration > 0
            ? Math.round((progress.currentTime / progress.totalDuration) * 100)
            : null;
        // eslint-disable-next-line no-console
        console.log(
          `Simulation progress: ${progress.currentTime}s / ${progress.totalDuration}s${percent !== null ? ` (${percent}%)` : ""}`,
        );
        onProgress(progress);
      }
    : undefined;
  const progressProxy = wrappedProgress
    ? Comlink.proxy(wrappedProgress)
    : undefined;

  const { report, status, metadata } = await webWorker.runSimulation(
    inp,
    simulationId,
    flags,
    progressProxy,
  );

  // If simulation failed, return empty results
  if (status === "failure" || metadata.timestepCount === 0) {
    return {
      status,
      report,
      results: new EpanetResultsReader(new Map()),
    };
  }

  // Load binary data from IndexedDB
  // TODO: Consider partial reading optimization for large EPS simulations.
  // Currently loads entire binary file to read a single timestep.
  // Options: store timesteps separately, or use File System Access API.
  const record = await loadEPSSimulation(simulationId);
  if (!record) {
    throw new Error(`Failed to load simulation ${simulationId} from IndexedDB`);
  }

  // Convert first timestep to SimulationResults
  const reader = new EpanetBinaryReader(record.binaryData);
  const resultsData = convertTimestepToSimulationResults(
    reader,
    0,
    record.tankData,
  );
  const results = new EpanetResultsReader(resultsData);

  return { status, report, results };
};
