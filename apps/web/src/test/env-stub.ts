/**
 * Vitest setup — skip the env validation in tests.
 *
 * `@/lib/env` runs `@t3-oss/env-nextjs` at module init, which Zod-
 * validates every required key. Tests don't actually call any vendor;
 * the `SKIP_ENV_VALIDATION` flag (built into the t3-env contract) tells
 * the loader to short-circuit validation and treat every value as
 * provided.
 *
 * Production builds and dev `next dev` never read this file — Vitest
 * picks it up via the `setupFiles` config in `apps/web/vitest.config.ts`.
 *
 * Skill: typescript-strict-zod-interop, test-strategy.
 */
process.env['SKIP_ENV_VALIDATION'] = 'true';
process.env['NEXT_PUBLIC_SKIP_ENV_VALIDATION'] = 'true';
