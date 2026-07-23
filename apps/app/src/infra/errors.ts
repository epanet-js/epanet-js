import { captureError, captureWarning } from "src/infra/error-tracking";

export function enrichError(message: string, cause: unknown): Error {
  return new Error(message, { cause });
}

export const errorName = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === "string" ? name : undefined;
};

export type ErrorMatcher = string | ((error: unknown) => boolean);

const matches = (error: unknown, matchers: ErrorMatcher[]): boolean =>
  matchers.some((matcher) =>
    typeof matcher === "string" ? errorName(error) === matcher : matcher(error),
  );

export type HandleErrorOptions = {
  as: string;
  ignore?: ErrorMatcher[];
  warn?: ErrorMatcher[];
  onUnexpected?: "throw" | "capture" | "warn";
  // Extra Sentry context attached to warn/capture reports (not the throw path).
  contexts?: Record<string, Record<string, unknown>>;
};

// Handles an already-caught error by classification: `ignore` matches are
// swallowed silently, `warn` matches are reported via captureWarning under `as`
// (kept out of the exception feed but visible for a Sentry rate alert), and
// anything else is escalated per `onUnexpected`:
//   - "throw" (default): rethrown enriched with `as`, so it propagates. Used by
//     catchErrors and callers that want an error boundary to catch it.
//   - "capture": reported as an exception and swallowed, for callers that must
//     degrade rather than crash (e.g. returning a fallback in a catch block).
//
//   } catch (error) {
//     handleError(error, { as: "reader: metadata read failed", warn: ["NotFoundError"], onUnexpected: "capture" });
//     return fallback;
//   }
export function handleError(error: unknown, options: HandleErrorOptions): void {
  const {
    as: message,
    ignore = [],
    warn = [],
    onUnexpected = "throw",
    contexts,
  } = options;
  if (matches(error, ignore)) return;
  if (onUnexpected === "warn" || matches(error, warn)) {
    captureWarning(message, error, contexts);
    return;
  }
  if (onUnexpected === "capture") {
    captureError(enrichError(message, error), contexts);
    return;
  }
  throw enrichError(message, error);
}

// Runs `fn` and routes any failure (sync throw or async rejection) through
// handleError: `ignore` matches are swallowed, `warn` matches are reported as
// warnings, the rest are rethrown enriched with `as`. A drop-in replacement for
// a try/catch whose only job is to relabel errors and optionally drop or warn on
// a few; preserves whether `fn` was sync or async.
//
//   await catchErrors(() => this.persist(...), {
//     as: "RecentFilesStore: failed to write to IndexedDB",
//   });
//   catchErrors(() => pick(), { as: msg, ignore: ["AbortError"] });
//   catchErrors(() => read(), { as: msg, warn: ["NotFoundError"] });
//
// `onUnexpected` (see handleError) controls the rest: "throw" (default),
// "capture", or "warn" — the latter two make catchErrors resolve to undefined
// instead of rethrowing.
export function catchErrors<T>(
  fn: () => T,
  options: HandleErrorOptions,
): T | undefined {
  const handle = (cause: unknown): undefined => {
    handleError(cause, options);
    return undefined;
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
