import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { EPSSimulationResult, ProgressCallback } from "./worker";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { captureError } from "src/infra/error-tracking";

let cancelRequested = false;

export const cancelSimulation = () => {
  cancelRequested = true;
};

export const runSimulation = withDebugInstrumentation(
  async (
    inp: string,
    appId: string,
    onProgress?: ProgressCallback,
    flags: Record<string, boolean> = {},
    scenarioKey?: string,
    runId?: string,
  ): Promise<EPSSimulationResult> => {
    cancelRequested = false;
    const proxiedCallback = Comlink.proxy(
      (progress: Parameters<ProgressCallback>[0]) => {
        onProgress?.(progress);
        return cancelRequested ? false : undefined;
      },
    );
    const result = await webWorker.runSimulation(
      inp,
      appId,
      proxiedCallback,
      flags,
      scenarioKey,
      runId,
    );
    if (result.jsError) {
      captureError(new Error(`Simulation JS error: ${result.jsError}`));
    }
    return result;
  },
  { name: "SIMULATION:RUN", maxDurationMs: 5000 },
);
