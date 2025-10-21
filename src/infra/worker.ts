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
