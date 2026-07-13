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
  denyUrls: [/chrome-extension:\/\//, /^app:\/\/\/scripts\/inpage\.js/],
  beforeSend: (event, hint) => {
    const privacySettings = readRawPrivacySettings();
    if (privacySettings?.skipErrorReporting === true) return null;

    const error = hint?.originalException;

    const isPosthogNetworkError =
      error instanceof Error &&
      error.message === "Failed to fetch" &&
      event.exception?.values?.some((value) =>
        value.stacktrace?.frames?.some((frame) =>
          frame.filename?.includes("posthog-js"),
        ),
      );
    if (isPosthogNetworkError) return null;

    const isCssChunkLoadError = event.exception?.values?.some((value) =>
      /Loading CSS chunk .* failed/.test(value.value ?? ""),
    );
    if (isCssChunkLoadError) return null;

    if (
      error instanceof Error &&
      "details" in error &&
      typeof (error as { details: unknown }).details === "object" &&
      (error as { details: unknown }).details !== null
    ) {
      event.contexts = {
        ...event.contexts,
        [error.name]: (error as { details: Record<string, unknown> }).details,
      };
    }

    return event;
  },
});
