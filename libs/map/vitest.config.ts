import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Render primitives are mostly exercised from the app's suite; only the guards
    // the app's engine double can't model are covered here.
    passWithNoTests: true,
  },
});
