/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  productionBrowserSourceMaps: true,
  compress: false,
  swcMinify: true,

  // TODO: it would be nice if this worked, but cross-origin
  // workers are not a thing yet.
  // assetPrefix: isProduction ? "https://static.placemark.io" : "", // "http://0.0.0.0:8787",

  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: false,
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
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: false,
  disableLogger: true,
  automaticVercelMonitors: true,
});
