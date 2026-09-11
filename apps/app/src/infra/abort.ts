// AbortSignal.throwIfAborted() is missing in jsdom, so long loops that want to
// stop cooperatively cannot call it directly.
export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }
};

export const isAbortError = (error: unknown): boolean =>
  (error as Error | undefined)?.name === "AbortError";
