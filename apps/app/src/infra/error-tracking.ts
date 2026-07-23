import * as Sentry from "@sentry/nextjs";
import { Plan } from "src/lib/account-plans";

const isDebugMode = (): boolean => process.env.NODE_ENV === "development";

export const captureError = (
  error: Error,
  contexts?: Record<string, Record<string, unknown>>,
) => {
  // eslint-disable-next-line no-console
  if (isDebugMode()) console.error(error);

  Sentry.captureException(error, contexts ? { contexts } : undefined);
};

// Describes any thrown value for Sentry's `extra`. A DOMException (e.g.
// NotFoundError from OPFS) is not `instanceof Error` but still carries a
// name/message, so match on shape rather than the Error prototype.
const describeError = (error: unknown): Record<string, unknown> | undefined => {
  if (error == null) return undefined;
  if (error instanceof Error) {
    return { name: error.name, error: error.message, stack: error.stack };
  }
  if (typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown; stack?: unknown };
    if (typeof e.name === "string" || typeof e.message === "string") {
      return {
        name: typeof e.name === "string" ? e.name : undefined,
        error: typeof e.message === "string" ? e.message : String(error),
        stack: typeof e.stack === "string" ? e.stack : undefined,
      };
    }
  }
  return { error: String(error) };
};

export const captureWarning = (
  message: string,
  error?: unknown,
  contexts?: Record<string, Record<string, unknown>>,
) => {
  // eslint-disable-next-line no-console
  if (isDebugMode()) console.warn(message, error, contexts);

  Sentry.captureMessage(message, {
    level: "warning",
    extra: describeError(error),
    contexts,
  });
};

export const captureInfo = (
  message: string,
  extra?: Record<string, unknown>,
) => {
  // eslint-disable-next-line no-console
  if (isDebugMode()) console.info(message, extra);

  Sentry.captureMessage(message, { level: "info", extra });
};

export const addToErrorLog = (breadcrumbs: Sentry.Breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumbs);
};

type UserData = {
  id: string;
  email: string;
  plan: Plan;
};

export const setUserContext = (user: UserData | null) => {
  Sentry.setUser(user);
  Sentry.setTag("plan", user ? user.plan : null);
};

export const setFlagsContext = (flagsEnabled: string[]) => {
  Sentry.setContext(
    "Feature Flags",
    flagsEnabled.reduce(
      (acc, name: string) => {
        acc[name] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  );
  Sentry.setTags(
    flagsEnabled.reduce(
      (acc, name: string) => {
        acc["flags." + name] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  );
};

export const setErrorContext = (
  name: string,
  context: Parameters<typeof Sentry.setContext>[1],
) => {
  Sentry.setContext(name, context);
};

export const ErrorBoundary = Sentry.ErrorBoundary;
