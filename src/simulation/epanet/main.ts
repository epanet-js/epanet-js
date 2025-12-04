import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import { loadEPSSimulation } from "../eps/eps-store";
import { EpanetBinaryReader, convertTimestepToSimulationResults } from "../eps";

/**
 * Runs a hydraulic simulation and returns results.
 *
 * The worker stores binary results in IndexedDB. This function
 * loads the results and converts the first timestep to SimulationResults.
 */
export const runSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
): Promise<SimulationResult> => {
  // Generate unique simulation ID
  const simulationId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { report, status, metadata } = await webWorker.runSimulation(
    inp,
    simulationId,
    flags,
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
  const record = await loadEPSSimulation(simulationId);
  if (!record) {
    throw new Error(`Failed to load simulation ${simulationId} from IndexedDB`);
  }

  // Convert first timestep to SimulationResults
  const reader = new EpanetBinaryReader(record.binaryData);
  const resultsData = convertTimestepToSimulationResults(reader, 0);
  const results = new EpanetResultsReader(resultsData);

  return { status, report, results };
};
