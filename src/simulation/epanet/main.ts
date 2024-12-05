import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResults } from "./epanet-results";

export const runSimulation = async (inp: string): Promise<SimulationResult> => {
  const { report, status, nodeResults, linkResults } =
    await webWorker.runSimulation(inp);

  const results = new EpanetResults(nodeResults, linkResults);

  return { status, report, results };
};
