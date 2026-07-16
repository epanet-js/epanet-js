/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * @type {import('next').NextConfig}
 */
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || "development";

const nextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  compress: false,
  swcMinify: true,
  poweredByHeader: false,
  transpilePackages: [
    "echarts",
    "zrender",
    "@epanet-js/ejsdb",
    "@epanet-js/i18n",
    "@epanet-js/ui-kit",
  ],

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
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
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

    // Append ?dpl=<deploymentId> to chunk URLs loaded inside Web Workers.
    // Next.js only patches __webpack_require__.u in the main-thread runtime;
    // workers get their own runtime and miss the deployment ID, causing
    // importScripts to hit the latest deployment where old chunks don't exist.
    const deploymentId = process.env.NEXT_DEPLOYMENT_ID;
    if (deploymentId) {
      const { RuntimeModule, RuntimeGlobals } = webpack;

      class WorkerDeploymentIdRuntimeModule extends RuntimeModule {
        constructor() {
          super("worker-deployment-id", RuntimeModule.STAGE_ATTACH);
        }
        generate() {
          return [
            "(function() {",
            `  var orig = ${RuntimeGlobals.getChunkScriptFilename};`,
            "  if (orig) {",
            `    ${RuntimeGlobals.getChunkScriptFilename} = function(chunkId) {`,
            `      return orig(chunkId) + ${JSON.stringify("?dpl=" + deploymentId)};`,
            "    };",
            "  }",
            "})();",
          ].join("\n");
        }
      }

      config.plugins.push({
        apply(compiler) {
          compiler.hooks.thisCompilation.tap(
            "WorkerDeploymentIdPlugin",
            (compilation) => {
              compilation.hooks.runtimeRequirementInTree
                .for(RuntimeGlobals.ensureChunkHandlers)
                .tap("WorkerDeploymentIdPlugin", (chunk) => {
                  const opts = chunk.getEntryOptions();
                  if (opts && opts.chunkLoading === "import-scripts") {
                    compilation.addRuntimeModule(
                      chunk,
                      new WorkerDeploymentIdRuntimeModule(),
                    );
                  }
                });
            },
          );
        },
      });
    }

    return config;
  },
  /* eslint-disable require-await */
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

const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

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
  sourcemaps: { disable: !hasSentryAuthToken },
};

if (process.env.NEXT_PUBLIC_SENTRY_PROXY === "true") {
  sentryConfig.tunnelRoute = "/m";
}

module.exports = withSentryConfig(nextConfig, sentryConfig);
