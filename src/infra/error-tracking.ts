import * as Sentry from "@sentry/nextjs";

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

export const ErrorBoundary = Sentry.ErrorBoundary;
