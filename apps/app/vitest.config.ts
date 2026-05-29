import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const projectDir = process.cwd();
loadEnvConfig(projectDir);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.benchmark.test.ts", "src/**/*.benchmark.test.tsx"],
    environmentMatchGlobs: [
      ["src/**/*.test.tsx", "jsdom"],
      ["src/**/*.integration.test.ts", "jsdom"],
      ["src/**/*.test.ts", "node"],
    ],
    dir: "./",
    deps: {
      interopDefault: true,
    },
    // @epanet-js/ejsdb is a workspace package that ships raw .ts (with `?raw`
    // SQL imports), so it must be transformed by Vite rather than externalized.
    server: {
      deps: {
        inline: [/@epanet-js\//],
      },
    },
    globals: true,
    setupFiles: [
      "./test/setup.ts",
      "./src/__helpers__/feature-flags.ts",
      "./src/__helpers__/locale.ts",
    ],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
