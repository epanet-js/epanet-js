import * as Comlink from "comlink";
import { lib as webWorker } from "src/lib/worker";
import { EPSSimulationResult, ProgressCallback } from "./worker-eps";
import { withDebugInstrumentation } from "src/infra/with-instrumentation";
import { captureError } from "src/infra/error-tracking";

export const runSimulation = withDebugInstrumentation(
  async (
    inp: string,
    appId: string,
    flags: Record<string, boolean> = {},
    onProgress?: ProgressCallback,
  ): Promise<EPSSimulationResult> => {
    const proxiedCallback = onProgress ? Comlink.proxy(onProgress) : undefined;
    const result = await webWorker.runSimulation(
      inp,
      appId,
      flags,
      proxiedCallback,
    );
    if (result.jsError) {
      captureError(new Error(`Simulation JS error: ${result.jsError}`));
    }
    return result;
  },
  { name: "SIMULATION:RUN", maxDurationMs: 5000 },
);
