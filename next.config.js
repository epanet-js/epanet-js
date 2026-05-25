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
  transpilePackages: ["echarts", "zrender"],

  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    SENTRY_RELEASE: commitSha,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack(config, { webpack }) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      // ptsnet has a dynamic `import("node:worker_threads")` for its Node worker
      // backend. The browser never hits that branch (it uses blob workers), but
      // webpack still tries to resolve it. Strip the `node:` scheme (below) and
      // resolve the bare module to an empty one here.
      worker_threads: false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
    );
    config.module.rules.push({
      test: /\.sql$/,
      resourceQuery: /raw/,
      type: "asset/source",
    });

    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
      generator: {
        filename: "static/wasm/[name].[contenthash][ext]",
      },
    });

    return config;
  },
  /* eslint-disable require-await */
  // Cross-origin isolation is required for ptsnet (SharedArrayBuffer).
  // `credentialless` minimises breakage of third-party content (map tiles,
  // PostHog, Sentry, fonts) compared to `require-corp`.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  async rewrites() {
    return process.env.NEXT_PUBLIC_POSTHOG_HOST !== undefined
      ? [
          {
            source: "/i/:path*",
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
  sentryConfig.tunnelRoute = "/m";
}

module.exports = withSentryConfig(nextConfig, sentryConfig);
