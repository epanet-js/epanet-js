export type ArrayBufferType = "shared" | "array";

export const canUseWorker = () => {
  try {
    return window.Worker !== undefined;
  } catch {
    return false;
  }
};

export const canUseWorkers = (bufferType: string = "array") =>
  canUseWorker() && bufferType === "shared";

export function enrichWorkerError(workerName: string, e: unknown): Error {
  if (e instanceof DOMException && e.name === "AbortError") return e;
  const message = e instanceof Error ? e.message : String(e);
  return new Error(`[worker:${workerName}] ${message}`, { cause: e });
}
