import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import { EPSSimulationResult } from "./worker-eps";

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

export const runEPSSimulation = async (
  inp: string,
  flags: Record<string, boolean> = {},
): Promise<EPSSimulationResult> => {
  return await webWorker.runEPSSimulation(inp, flags);
};
