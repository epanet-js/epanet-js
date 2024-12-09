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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.nothreads-test.tsx"],
    environmentMatchGlobs: [
      ["src/map/elevations/**/*", "jsdom"],
      ["src/components/**/*", "jsdom"],
      ["src/**/**", "node"],
    ],
    environmentOptions: {
      jsdom: { resources: "usable" },
    },
    dir: "./",
    deps: {
      interopDefault: true,
      inline: ["vitest-canvas-mock"],
    },
    globals: true,
    setupFiles: ["./test/setup.ts", "./src/__helpers__/feature-flags.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
