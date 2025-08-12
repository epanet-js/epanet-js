import * as Sentry from "@sentry/nextjs";

const tunnel =
  process.env.NEXT_PUBLIC_SENTRY_PROXY === "true" ? "/monitoring" : undefined;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: 1,
  debug: false,
  tunnel,
});
