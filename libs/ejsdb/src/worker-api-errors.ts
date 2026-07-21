// Comlink only serializes {name, message, stack} for values that are
// instanceof Error. A DOMException is not, so it crosses the worker boundary
// through structured clone, which drops the stack. Rebuilding the throw as a
// real Error keeps all three fields on the way to the main thread.
export const normalizeError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  const source = value as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
  } | null;
  const error = new Error(
    typeof source?.message === "string" ? source.message : String(value),
  );
  if (typeof source?.name === "string") error.name = source.name;
  if (typeof source?.stack === "string") error.stack = source.stack;
  return error;
};

export const withErrorNormalization = <T extends object>(api: T): T => {
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(api)) {
    if (typeof value !== "function") {
      wrapped[key] = value;
      continue;
    }
    const fn = value as (...fnArgs: unknown[]) => unknown;
    wrapped[key] = (...args: unknown[]) => {
      try {
        const result = fn.apply(api, args);
        return result instanceof Promise
          ? result.catch((e: unknown) => {
              throw normalizeError(e);
            })
          : result;
      } catch (e) {
        throw normalizeError(e);
      }
    };
  }
  return wrapped as T;
};
