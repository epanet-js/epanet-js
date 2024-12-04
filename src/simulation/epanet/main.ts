import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";

export const runSimulation = async (inp: string): Promise<SimulationResult> => {
  const { report, status } = await webWorker.runSimulation(inp);

  return { status, report };
};
