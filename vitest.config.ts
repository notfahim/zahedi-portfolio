import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs", "shared/**/*.test.mjs", "*.test.ts"],
    passWithNoTests: true,
  },
});
