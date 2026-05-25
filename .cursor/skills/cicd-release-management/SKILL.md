---
name: cicd-release-management
description: CI/CD and release management for MyConciergeHotel.com — GitHub Actions, Vercel previews, Supabase migrations, Sentry releases, environment promotion. Use whenever you add or modify CI workflows, release processes, or environment handling.
---

# CI/CD and release management — MyConciergeHotel.com

The pipeline must support **fast iteration**, **safe migrations**, and **one-click rollback**. We use GitHub Actions + Vercel + Supabase CI.

## Triggers

Invoke when:

- Editing `.github/workflows/*.yml`.
- Changing Vercel project settings, environment variables, or build commands.
- Adding a Supabase migration that needs ordered application.
- Setting up Sentry release tracking, source maps, or environment promotion.

## Environments

| Env          | Branch / source        | URL                                |
| ------------ | ---------------------- | ---------------------------------- |
| `dev`        | local + Supabase local | `localhost:3000`, `localhost:3001` |
| `preview`    | every PR               | `<pr>.cct-preview.vercel.app`      |
| `staging`    | `develop` branch       | `staging.myconciergehotel.com`     |
| `production` | `main` branch          | `myconciergehotel.com`             |

Database environments map to **separate Supabase projects** for `staging` and `production`. Preview deployments use the staging DB unless an `e2e/` tag triggers an ephemeral schema (Phase 2 enhancement).

## Workflows

### `ci.yml` — every PR

1. Setup Node 20, pnpm 9, Turborepo cache.
2. `pnpm install --frozen-lockfile`.
3. `pnpm turbo run lint typecheck test:unit` (parallel).
4. `pnpm turbo run build` for `apps/web` and `apps/admin`.
5. Comment Vercel preview URL.

### `e2e.yml` — PR + push to main

- Spin up `apps/web` against staging DB + Algolia staging index.
- Run Playwright with mobile + desktop projects.
- Upload trace on failure.

### `lighthouse.yml` — push to main + weekly

- Run Lighthouse CI against 5 strategic URLs in production.
- Fail on regression beyond thresholds.

### `migrate.yml` — push to main

1. Download Supabase CLI.
2. `supabase db push` against staging first; on success, against production.
3. Tag deployment in Sentry as a release marker.

### `sentry-release.yml` — push to main

- Upload source maps for `apps/web` and `apps/admin`.
- Set `SENTRY_RELEASE = github.sha`.
- Mark deploy.

### Cron / scheduled

- Nightly `e2e-amadeus-smoke.yml` against Amadeus test env.
- Weekly `dependency-audit.yml` (`pnpm audit`, `npm-check-updates`).

## Non-negotiable rules

### Branch protection

- `main` and `develop` protected. Required: PR review (1 approver), passing CI, `lint`, `typecheck`, `test:unit`, `e2e`.
- No force pushes. No direct commits to `main`.

### Migrations

- All schema changes via SQL files in `packages/db/migrations/`. Never via Supabase Studio in non-dev envs.
- Migrations are forward-compatible (additive when possible).
- Backwards-incompatible migrations require an ADR + downtime window.

### Vercel

- `apps/web` and `apps/admin` are separate Vercel projects pointing to the same monorepo with different `rootDirectory`.
- Build command leverages Turborepo cache.
- Env vars per environment in Vercel UI; `.env.example` lists every variable.

### Releases

- SemVer for the monorepo (changesets optional Phase 2).
- Each merge to `main` generates a Sentry release `cct-web@<sha>` and `cct-admin@<sha>`.

### Rollback

- Vercel "Promote previous deployment" for app rollback.
- Supabase backups daily + PITR enabled. Migration rollback via reverse SQL files when feasible.

### Secrets

- Stored in GitHub Actions and Vercel only. Never in repo.
- `gh secret list` audited weekly.

## Anti-patterns to refuse

- Skipping CI with `[skip ci]` on production-bound PRs.
- Long-lived feature branches without rebasing.
- Manual deploys to production from a developer machine.
- Migrations applied manually without going through `migrate.yml`.

## Vercel deploy gotchas (paid in production, capture for next session)

### Rule 1 — Vercel rejects Next.js builds with known CVEs

Since 2026, Vercel post-build step refuses to ship a deploy if the Next.js
version is on its CVE blocklist. The error surfaces only as an opaque

```
Vulnerable version of Next.js detected, please update immediately.
status   ● Error
```

after `Build Completed in /vercel/output`. **The build itself succeeds.**
The blocklist currently rejects Next < `15.2.3` (CVE-2025-29927 — middleware
auth bypass via `x-middleware-subrequest`) and earlier CVEs on the 14.x and
13.x lines. Bump to the latest patch on the same minor when this triggers.
Patch is **not back-ported** to older minors (e.g. 15.1.x stays vulnerable
even at 15.1.12).

### Rule 2 — `withSentryConfig` crashes silently without `SENTRY_AUTH_TOKEN`

Wrapping the Next.js config with `@sentry/nextjs`'s `withSentryConfig` in
production builds always triggers the sourcemap upload pipeline — even when
`authToken` is undefined. The upload step crashes after `Collecting build
traces ...` with no actionable message; Vercel just marks the deploy as
ERROR. **Skip the wrapper entirely** when the token is missing instead of
just stripping the `authToken` option:

```ts
const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN'];
const isDev = process.env['NODE_ENV'] !== 'production';
const shouldWrapSentry =
  !isDev && sentryAuthToken !== undefined && sentryAuthToken.length > 0;

export default shouldWrapSentry
  ? withSentryConfig(baseConfig, { ... authToken: sentryAuthToken })
  : baseConfig;
```

This is documented in `apps/web/next.config.ts` and matters for Vercel
preview branches where Sentry creds are intentionally not provisioned.

### Rule 3 — Vercel encrypted env vars come back **empty** via `vercel env pull`

`vercel env pull --environment=preview --git-branch=...` always writes the
file with empty `=""` values for env vars marked as **Sensitive** /
encrypted in the dashboard. The names are listed but the values are
masked. Conclusion:

- **Don't trust** a successful `vercel env pull` as proof the build will get
  real values. The build pulls them server-side from a different source.
- If you suspect a Vercel env var is empty (build error like
  `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.`), the only way
  to be sure is to `vercel env rm <NAME> <env> [<branch>] --yes` and
  re-add via `vercel env add <NAME> <env> <branch> --value "..." --yes`.
- Branch-scoped overrides (`vercel env add NAME preview <branch>`) take
  precedence over "all preview branches" entries — useful to fix a single
  preview without touching production.

### Rule 4 — `vercel env add` requires a Git branch when targeting `preview`

`vercel env add NEXT_PUBLIC_FOO preview --value "..." --yes` returns
`{ status: "action_required", reason: "git_branch_required" }`. The
documentation hint says "omit branch for all preview branches", but the
CLI in fact rejects it — you **must** pass a branch as the third positional
arg (or use the dashboard for the "all branches" entry).

### Rule 5 — Vercel CLI on PowerShell hangs when piped to `Select-Object`

`vercel env add … 2>&1 | Select-Object -Last 5` looks innocent but
PowerShell's `Select-Object` waits for stdin EOF. The Vercel CLI prints
its success message and then keeps the process alive for ~5 minutes
(probably an HTTP keep-alive on the next-action probe), so the pipe
never closes. Either:

- Drop the `Select-Object` and accept the full output, **or**
- Run the command, capture `Output collected before backgrounding` from
  the tool, and `Stop-Process -Id <pid> -Force` once you see the success
  marker (`Added Environment Variable …` / `Removed Environment Variable`).

This applies to **every** Vercel CLI subcommand that exits with an open
stream (`vercel env add`, `vercel env rm`, `vercel pull`, `vercel link`).

### Rule 6 — OAuth-logged Vercel CLI cannot mint API tokens

`vercel tokens add <name>` returns
`{ "reason": "classic_token_required" }` when the CLI session is OAuth
(the result of `vercel login`). Creating a personal access token requires
either (a) a classic token already set in `VERCEL_TOKEN`, or (b) the
dashboard. Plan accordingly when you need raw REST API access — prefer
`vercel env add/rm`, `vercel deploy`, and the MCP `user-vercel` tools
(which use a separate auth flow) over hand-rolled REST calls.

### Rule 7 — GitHub Actions `Build` needs env placeholders, not secrets

Vercel runs the production build with the **real** env vars stored in
the project, but the GitHub Actions `Build` job does not — and on a fresh
repo nobody wires Supabase / Cloudinary / Algolia secrets there. With
`SKIP_ENV_VALIDATION=true` the t3-env Zod check passes, but vendor
clients still crash at construction time during static prerender:

```
Error occurred prerendering page "/llms.txt".
Error: supabaseUrl is required.
```

The robust fix is **placeholder env vars in the workflow**, not adding
real secrets — every static route that touches a vendor must already
`try/catch` its upstream call (see `nextjs-app-router` rule on
defensive `generateStaticParams`). Pattern:

```yaml
build:
  name: Build
  env:
    NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci-placeholder-anon-key'
    SUPABASE_SERVICE_ROLE_KEY: 'ci-placeholder-service-role-key'
    NEXT_PUBLIC_SITE_URL: 'https://ci.myconciergehotel.com'
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'ci-placeholder'
    NEXT_PUBLIC_ALGOLIA_APP_ID: 'CIPLACEHOLDER'
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: 'ci-placeholder-search-key'
  steps:
    - run: pnpm turbo run build
```

Network calls to the placeholder hosts will fail with DNS / 401 errors,
but the routes degrade to their static skeleton instead of crashing the
build — which is the correct prod behaviour during a real outage.

### Rule 8 — Middleware matcher must list `sitemaps` (no extension) explicitly

The `next-intl` middleware matcher pattern excludes top-level files via
named alternation:

```ts
matcher: [
  '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sitemaps|llms.txt|llms-full.txt|.well-known|monitoring).*)',
];
```

`sitemap.xml` (the index) excludes only the index file. Sub-sitemaps
under `/sitemaps/<name>.xml` need a separate `sitemaps` token in the
alternation — without it, every sub-sitemap (`/sitemaps/hotels.xml`,
`/sitemaps/rankings.xml`, …) is intercepted by next-intl, rewritten to
`/fr/sitemaps/<name>.xml`, and 404s because no app-router page matches.

Symptom: route handler exists, build log shows it as static prerendered
(`○ /sitemaps/rankings.xml`), but production returns 404. Always update
the matcher when you add a new top-level folder that should bypass i18n
routing (e.g. `/api/health`, `/sitemaps/`, `/.well-known/`).

### Rule 9 — Vercel env vars are **scoped per environment**; preview ≠ production

Each env var in the Vercel dashboard has three independent toggles:
**Production**, **Preview**, **Development**. A value set only to
"Production" is **undefined** in every Preview deployment — including
the preview of a long-lived release branch. The build does not fail
because `SKIP_ENV_VALIDATION=true` is the CI default (see Rule 7) and
`@t3-oss/env-nextjs` skips the Zod gate at build time.

At runtime the symptom is silent: any server module that calls a
vendor (Supabase, Algolia, Amadeus) and wraps the call in a defensive
`try/catch → return []` returns an empty result. **The page renders 200
with zero data** — no Sentry, no log, no clue.

How this surfaced (18 May 2026, lost > 1h): the `release/myconciergehotel-2026-05`
preview displayed "0 destinations available" while production
(`wonderplace-travel-travelba.vercel.app/destination`) listed 73.
Same Supabase project, same code paths. A one-shot diagnostic endpoint
that read `process.env` directly (bypassing `env-web` to avoid early
throws) revealed every Supabase variable as `present: false, length: 0`.

Mitigations:

1. **Set release-critical env vars to all three scopes** (Production +
   Preview + Development) at provisioning time. The dashboard's
   "Copy from another environment" button does it in one click.
2. **Surface failures in production** — `apps/web/src/server/destinations/cities.ts`
   was reverted from `if (NODE_ENV !== 'production') console.warn` to
   an unconditional `console.error` so the next env regression shows up
   in Vercel runtime logs within seconds.
3. **Never gate logging on `NODE_ENV` for vendor errors** — the very
   environment where you most need the signal (production / preview) is
   exactly where the gate silences you.
4. **For a one-shot diag**: do not use `_diag/` as the folder name — see
   `nextjs-app-router` Rule on App Router private folders. Use `diag/`
   (no leading underscore) and read `process.env` directly with
   defensive `describe(value)` helpers so a missing var reports as
   `{ present: false }` instead of crashing the route.

### Rule 10 — `turbo-ignore` Ignored Build Step cancels empty / off-scope commits

The Vercel project for `@mch/web` is wired to the
[`turbo-ignore`](https://vercel.com/docs/monorepos/turborepo#skipping-unaffected-projects)
"Ignored Build Step" so unrelated changes in the monorepo (admin-only edits,
package-level scripts, `.cursor/skills/`, `.cursor/rules/`, `docs/`, etc.) do
not waste a production build slot. The trade-off is that **any commit that
does not touch a file in the dependency closure of `@mch/web` is auto-`CANCELED`**
after ~10–12 s with this build log:

```
≫   This project and its dependencies are not affected
⏭ Ignoring the change
The Deployment has been canceled as a result of running the command defined in the "Ignored Build Step" setting.
```

This bites in two recurring situations:

1. **`git commit --allow-empty` to force a rebuild**. The classic "bump the
   buildId to invalidate `unstable_cache`" trick **does not work** here —
   turbo-ignore sees zero affected files and cancels. The empty commit is
   harmless but useless. A real file in the `@mch/web` graph must change.
2. **Docs-only / skills-only PRs**. Commits limited to
   `.cursor/skills/**`, `.cursor/rules/**`, `docs/**`, `AGENTS.md`,
   `README.md`, `EDITORIAL_VOICE.md` are all skipped. Don't expect a preview
   URL — the deployment is created, then immediately cancelled.

**Pattern when you genuinely need to invalidate `unstable_cache` / force
`generateStaticParams` to re-run after a DB-only data change** (e.g.
status-flip from `draft` to `published` via a direct SQL update that
bypasses Payload `afterChange` hooks):

| Approach                                                                                                                                      | When to use                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Make a meaningful code change** in `apps/web/src/**` (e.g. tighten an ISR TTL that was too lax, fix a real bug surfaced by the data change) | Default — the legitimate path, leaves an audit trail.                                                                         |
| **Add or call a `/api/admin/revalidate?tag=…`** endpoint that wraps `revalidateTag()` (auth-gated by the operator role + a short-TTL HMAC).   | Frequent ops: re-publishing, un-archiving, content corrections. Worth a one-time investment if you do this more than monthly. |
| **Trigger a Payload `afterChange` hook** by re-saving the doc in the back-office UI.                                                          | When the DB row is editable from Payload (most editorial collections are).                                                    |
| `git commit --allow-empty` + `git push`                                                                                                       | ❌ NEVER — silently cancels, gives the false impression a build ran.                                                          |

Reference incident (May 2026): the 19 itineraries seeded as
`status = 'draft'` then flipped to `published` via Supabase MCP did not
trigger Payload hooks, so `/itineraires` kept serving the cached
"1 published itinerary" listing. Three deploys in a row got canceled
(commits `3f51274` + the two `docs(skills)` empty pushes before it)
until we shipped the real fix — aligning the hub `revalidate` TTL from
`86400` to `3600` in `apps/web/src/app/[locale]/itineraires/page.tsx`
(commit `196d97e`). That single file change triggered a build and the
hub refreshed with all 20 cards within minutes.

How to detect this happened to you:

- `vercel.com/.../deployments` shows the commit in `CANCELED` state with a
  `bld_…` id but no build output.
- `get_deployment_build_logs` returns a 12-line transcript ending on
  "Ignoring the change" — no `pnpm build`, no static prerender step.

How to recover:

- Push a real change in the `@mch/web` graph (anything under `apps/web/src/`,
  or any `packages/*` that `apps/web` depends on per `pnpm why`).

## References

- CDC v3.0 §13 (phasage), §15 (livrables).
- Vercel + Supabase docs.
- `test-strategy`, `observability-monitoring`, `security-engineering` skills.
- **`windows-dev-environment`** — primary maintainer runs PowerShell;
  local commands (migration runs, CLI scripts) must follow the quoting
  and SSL-strip patterns documented there.
