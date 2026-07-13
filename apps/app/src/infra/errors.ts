export function enrichError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

// Matches a caught error: either an exact `error.name` (e.g. "AbortError") or a
// custom predicate for anything richer (message, instanceof, ...).
export type ErrorMatcher = string | ((error: unknown) => boolean);

const matches = (error: unknown, matchers: ErrorMatcher[]): boolean =>
  matchers.some((matcher) =>
    typeof matcher === "string"
      ? error instanceof Error && error.name === matcher
      : matcher(error),
  );

// Runs `fn` and intercepts its failures (sync throws and async rejections):
// non-ignored errors are rethrown enriched with `as`, ignored ones are
// swallowed. A drop-in replacement for a try/catch whose only job is to relabel
// errors and optionally drop a few; preserves whether `fn` was sync or async.
//
//   await catchErrors(() => this.persist(...), {
//     as: "RecentFilesStore: failed to write to IndexedDB",
//   });
//
// Errors matching `ignore` are swallowed — not enriched, not rethrown — so they
// don't propagate or get reported (returns/resolves `undefined`). Useful for
// expected, non-actionable failures like AbortError:
//
//   catchErrors(() => pick(), { as: msg, ignore: ["AbortError"] });
export function catchErrors<T>(
  fn: () => T,
  options: { as: string; ignore?: ErrorMatcher[] },
): T | undefined {
  const { as: message, ignore = [] } = options;

  const handle = (cause: unknown): undefined => {
    if (matches(cause, ignore)) return undefined;
    throw enrichError(message, cause);
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result.catch(handle) as T;
    }
    return result;
  } catch (cause) {
    return handle(cause);
  }
}
