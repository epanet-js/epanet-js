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
};

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  org: "matrado-pr",
  project: "epanet-app",
  environment: process.env.NODE_ENV,
  release: commitSha,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: false,
  disableLogger: true,
  automaticVercelMonitors: true,
});
