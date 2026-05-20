import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "./apps/user-pwa/vitest.config.ts",
  "./apps/ops/vitest.config.ts",
  "./apps/garage-pwa/vitest.config.ts",
]);
