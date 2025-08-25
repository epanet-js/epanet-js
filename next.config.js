/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * @type {import('next').NextConfig}
 */
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || "development";

const nextConfig = {
  productionBrowserSourceMaps: true,
  compress: false,
  swcMinify: true,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    SENTRY_RELEASE: commitSha,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
  /* eslint-disable require-await */
  async rewrites() {
    return process.env.NEXT_PUBLIC_POSTHOG_HOST !== undefined
      ? [
          {
            source: "/ingest/:path*",
            destination: `${process.env.NEXT_PUBLIC_POSTHOG_HOST}/:path*`,
          },
        ]
      : [];
  },
  skipTrailingSlashRedirect: true,
};

const { withSentryConfig } = require("@sentry/nextjs");

const sentryConfig = {
  org: "iterating",
  project: "epanet-js",
  environment: process.env.NODE_ENV,
  release: commitSha,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: false,
  disableLogger: true,
  automaticVercelMonitors: true,
};

if (process.env.NEXT_PUBLIC_SENTRY_PROXY === "true") {
  sentryConfig.tunnelRoute = "/monitoring";
}

module.exports = withSentryConfig(nextConfig, sentryConfig);
