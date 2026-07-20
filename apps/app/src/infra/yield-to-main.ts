export const yieldToMain = (): Promise<void> => {
  const scheduler = (globalThis as Record<string, unknown>)["scheduler"] as
    | {
        postTask?: (
          cb: () => void,
          opts: { priority: string },
        ) => Promise<void>;
      }
    | undefined;
  if (scheduler?.postTask) {
    return scheduler.postTask(() => {}, { priority: "user-visible" });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
};

const MAIN_THREAD_SLICE_MS = 50;

export const createTimeSlicer = (
  sliceMs: number = MAIN_THREAD_SLICE_MS,
): (() => Promise<void>) => {
  let sliceStart = performance.now();
  return async () => {
    if (performance.now() - sliceStart > sliceMs) {
      await yieldToMain();
      sliceStart = performance.now();
    }
  };
};
