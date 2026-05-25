import * as Comlink from "comlink";
import type { PtsnetLib } from "./worker-entry";
import type {
  PtsnetWorkerInput,
  PtsnetProgressCallback,
  PtsnetWorkerResult,
} from "./worker";

let workerLib: Comlink.Remote<PtsnetLib> | null = null;

const getWorker = (): Comlink.Remote<PtsnetLib> => {
  if (!workerLib) {
    workerLib = Comlink.wrap<PtsnetLib>(
      new Worker(new URL("./worker-entry.ts", import.meta.url), {
        type: "module",
      }),
    );
  }
  return workerLib;
};

export const runPtsnetSimulation = async (
  input: PtsnetWorkerInput,
  onProgress?: PtsnetProgressCallback,
): Promise<PtsnetWorkerResult> => {
  const lib = getWorker();
  return lib.runPtsnet(
    input,
    onProgress ? Comlink.proxy(onProgress) : undefined,
  );
};

export type {
  PtsnetWorkerInput,
  PtsnetWorkerResult,
  PtsnetProgressCallback,
} from "./worker";
