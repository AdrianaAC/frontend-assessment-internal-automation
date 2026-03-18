import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: true,
    clearMocks: true,
    exclude: ["tests/e2e/**", "playwright.config.ts"],
  },
});
