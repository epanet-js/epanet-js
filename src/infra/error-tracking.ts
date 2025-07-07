import * as Sentry from "@sentry/nextjs";
import { Plan } from "src/user-plan";

const isDebugMode = (): boolean => process.env.NODE_ENV === "development";

export const captureError = (error: Error) => {
  // eslint-disable-next-line no-console
  if (isDebugMode()) console.error(error);

  Sentry.captureException(error);
};

export const captureWarning = (message: string) => {
  // eslint-disable-next-line no-console
  if (isDebugMode()) console.warn(message);

  Sentry.captureMessage(message, "warning");
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
  const flagsObject = flagsEnabled.reduce(
    (acc, name: string) => {
      acc["flags." + name] = true;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  Sentry.setContext("Flags", flagsObject);
  Sentry.setTags(flagsObject);
};

export const ErrorBoundary = Sentry.ErrorBoundary;
