import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config (apps/web).
 *
 * The bulk of `apps/web` coverage lives at the package boundary
 * (skill: test-strategy), but we do ship a handful of pure-data reader
 * tests that need to import from `src/server/**` modules. Those modules
 * top-load `import 'server-only'`, which Next.js intercepts and replaces
 * with a runtime that throws inside non-RSC bundlers — including Vitest.
 *
 * The alias below points `server-only` at an empty stub file so the
 * import is a no-op in the test environment. Production builds and
 * dev-mode Next.js are unaffected (they resolve `server-only` from
 * `node_modules`).
 *
 * Env contract
 * ------------
 * Several src/server/** modules transitively import `@/lib/env`, which
 * Zod-validates the full env at module init. Tests don't actually hit
 * any vendor — but the validation runs at import time. We pre-populate
 * placeholder values for the required keys in a setup file so the
 * tests don't need a real `.env.local`. See `windows-dev-environment`
 * skill §pnpm test envs.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    passWithNoTests: true,
    setupFiles: [path.resolve(__dirname, 'src/test/env-stub.ts')],
    alias: {
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
