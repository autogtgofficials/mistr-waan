import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local additions
    "**/.netlify/**", // Netlify build artifacts (bundled output) — trips
    // @next/next/no-assign-module-variable and no-unused-expressions rules.
    "apps/**", // we sometimes get a nested apps/user-pwa/apps/user-pwa/ copy
    // from a stray build; ignore it wholesale.
  ]),
]);

export default eslintConfig;
