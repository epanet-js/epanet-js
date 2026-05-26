import * as Sentry from "@sentry/nextjs";
import { readRawPrivacySettings } from "src/hooks/use-privacy-settings";

const tunnel =
  process.env.NEXT_PUBLIC_SENTRY_PROXY === "true" ? "/m" : undefined;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: 1,
  debug: false,
  tunnel,
  beforeSend: (event) => {
    const privacySettings = readRawPrivacySettings();
    if (privacySettings?.skipErrorReporting === true) return null;

    return event;
  },
});
