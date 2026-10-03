import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@stcn100/core": path.resolve(process.cwd(), "packages/core/src/index.ts"),
      "@stcn100/rules": path.resolve(process.cwd(), "packages/rules/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/test/**/*.test.ts"]
  }
});
