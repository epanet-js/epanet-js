const SLICE_MS = 16; // Guarantee the host frame size of 16.7ms

// Whether the host slices this on its main thread or runs it in a worker is not
// ours to know, so it says when to stop rather than us inferring it.
export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
};

const yieldToHost = (): Promise<void> => {
  const scheduler = (globalThis as Record<string, unknown>)["scheduler"] as
    | {
        postTask?: (
          callback: () => void,
          options: { priority: string },
        ) => Promise<void>;
      }
    | undefined;

  if (scheduler?.postTask) {
    return scheduler.postTask(() => {}, { priority: "user-visible" });
  }

  // A macrotask, deliberately: a microtask resumes before the host gets to
  // paint, which would make the batching invisible.
  return new Promise((resolve) => setTimeout(resolve, 0));
};

export const createTimeSlicer = (
  sliceMs: number = SLICE_MS,
): (() => Promise<void>) => {
  let sliceStart = performance.now();

  return async () => {
    if (performance.now() - sliceStart <= sliceMs) return;

    await yieldToHost();
    sliceStart = performance.now();
  };
};
