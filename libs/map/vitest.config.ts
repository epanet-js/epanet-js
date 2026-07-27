import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // No tests yet (render primitives are exercised from the app's suite).
    passWithNoTests: true,
  },
});
