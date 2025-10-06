export type ArrayBufferType = "shared" | "array";

const hasWebWorker = () => {
  try {
    return window.Worker !== undefined;
  } catch {
    return false;
  }
};

export const canUseWorkers = (bufferType: string = "array") =>
  hasWebWorker() && bufferType === "shared";
