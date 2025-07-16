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
    environment: "node",
    include: ["src/**/*.benchmark.test.ts"],
    dir: "./",
    deps: {
      interopDefault: true,
    },
    globals: true,
    setupFiles: ["./test/setup.ts", "./src/__helpers__/feature-flags.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
    testTimeout: 300000,
    hookTimeout: 60000,
    poolOptions: {
      forks: {
        execArgv: ["--expose-gc"],
      },
    },
  },
});
