import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { SimulationResult } from "../result";
import { EpanetResultsReader } from "./epanet-results";
import { EPSSimulationResult, ProgressCallback } from "./worker-eps";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";

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

export const runEPSSimulation = withDebugInstrumentation(
  async (
    inp: string,
    appId: string,
    flags: Record<string, boolean> = {},
    onProgress?: ProgressCallback,
  ): Promise<EPSSimulationResult> => {
    const proxiedCallback = onProgress ? Comlink.proxy(onProgress) : undefined;
    return await webWorker.runEPSSimulation(inp, appId, flags, proxiedCallback);
  },
  { name: "SIMULATION:RUN", maxDurationMs: 5000 },
);
