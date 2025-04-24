import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";

export const runSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
): Promise<SimulationResult> => {
  const {
    report,
    status,
    results: resultsData,
  } = await webWorker.runSimulation(inp, flags);

  const results = new EpanetResultsReader(resultsData);

  return { status, report, results };
};
