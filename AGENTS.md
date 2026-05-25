# AGENTS.md — MyConciergeHotel.com

> Hi 👋. This file is for **AI coding agents** (Cursor, Claude, Codex CLI, …) that land in this repo.
> Read it once at the start of a session, then jump to the relevant skills/rules for the task.

## 1. What this project is

MyConciergeHotel.com is an **IATA-accredited online travel agency** for 5-star hotels and Palaces in France.
The product is split into:

- **`apps/web`** — the public Next.js 15 site (booking, search, editorial, account).
- **`apps/admin`** — the Payload CMS back-office.
- **`packages/`** — shared domain, integrations, SEO, emails, DB, observability, UI primitives.

The monorepo is **pnpm + Turborepo**. TypeScript is **strict** (no `any`, no `as` casts, no `!`).

## 2. Layering — the only architecture diagram you need

```
┌──────────────────────────────────────────────────────────────┐
│  apps/web         apps/admin                                 │
│       ↘             ↙                                        │
│   packages/seo, /emails, /ui, /db, /observability, /config   │
│                       ↑                                      │
│        packages/integrations/<vendor>/  ← Zod, HTTP, Redis   │
│                       ↑                                      │
│              packages/domain/  ← pure TS, no I/O             │
└──────────────────────────────────────────────────────────────┘
```

Lower layers **never** import from higher layers. See `.cursor/rules/architecture-layers.mdc`.

## 3. Where to look first

| Task                                                                                       | Start here                                                                                                           |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Add a business rule                                                                        | `packages/domain/` + `.cursor/rules/architecture-layers.mdc`                                                         |
| **Editorial voice / brand tone / FR-EN copy**                                              | [`EDITORIAL_VOICE.md`](EDITORIAL_VOICE.md) (root) + [`docs/editorial/style-guide.md`](docs/editorial/style-guide.md) |
| New vendor integration                                                                     | `.cursor/skills/api-integration/SKILL.md` + `.cursor/rules/integrations-api.mdc`                                     |
| **LLM pipeline (editorial, AEO, content)**                                                 | `.cursor/skills/llm-output-robustness/SKILL.md`                                                                      |
| **Voix du Concierge** (ADR-0011, pass 8, `<ConciergeAdvice>`, shortener phrases > 25 mots) | `.cursor/skills/concierge-voice-pipeline/SKILL.md`                                                                   |
| **LLM extraction from web content (Tavily)**                                               | `.cursor/skills/content-enrichment-pipeline/SKILL.md` + `llm-output-robustness` §rule-9                              |
| **Multi-source factual enrichment**                                                        | `.cursor/skills/content-enrichment-pipeline/SKILL.md`                                                                |
| **Photo pipeline / hero / alt enrichment / Pinterest hotlink risk**                        | `.cursor/skills/photo-pipeline/SKILL.md`                                                                             |
| **Zod schema → React props**                                                               | `.cursor/skills/typescript-strict-zod-interop/SKILL.md`                                                              |
| **PowerShell / Windows dev commands**                                                      | `.cursor/skills/windows-dev-environment/SKILL.md`                                                                    |
| New public route                                                                           | `apps/web/src/app/[locale]/` + `.cursor/rules/nextjs-app-router.mdc`                                                 |
| **JSON-LD page → must be `force-dynamic`**                                                 | `.cursor/skills/structured-data-schema-org/SKILL.md` §CSP-nonce-contract                                             |
| **Hotel detail page** (15 blocks)                                                          | `.cursor/rules/hotel-detail-page.mdc` (CDC §2 checklist + ADR-0007/0008/0009)                                        |
| Room sub-page `/hotel/[slug]/chambres/[room]`                                              | `.cursor/rules/hotel-detail-page.mdc` + ADR-0009                                                                     |
| **Editorial guide / ranking page**                                                         | `.cursor/skills/editorial-long-read-rendering/SKILL.md` + `llm-output-robustness`                                    |
| **Rankings matrice** (combinator, axes, `slugOverride`, Paris arrdt, Yonder bridging)      | `.cursor/skills/editorial-rankings-matrix/SKILL.md`                                                                  |
| **TOC sidebar / EnrichedText / auto-link**                                                 | `.cursor/skills/editorial-long-read-rendering/SKILL.md`                                                              |
| New Supabase table / RLS policy                                                            | `packages/db/migrations/` + `.cursor/rules/supabase-rls.mdc`                                                         |
| JSON-LD / robots / llms.txt                                                                | `packages/seo/` + `.cursor/rules/seo-geo.mdc`                                                                        |
| Payload collection / back-office hook                                                      | `apps/admin/` + `.cursor/skills/backoffice-cms/SKILL.md`                                                             |
| E2E for a new journey                                                                      | `apps/web/e2e/` + `.cursor/rules/e2e-testing.mdc`                                                                    |
| Security / CSP / auth                                                                      | `.cursor/rules/security-csp.mdc`                                                                                     |
| Perf, Sentry, logs                                                                         | `.cursor/rules/observability-perf.mdc`                                                                               |

### Structural decisions already taken (don't relitigate without an ADR)

| Decision                                                                                                  | Reference                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Hotel URL = `/hotel/<slug>` (flat slug, against CDC §3.3)                                                 | [ADR-0008](docs/adr/0008-url-structure-hotel-flat.md)                                                       |
| Room sub-pages `/hotel/<slug>/chambres/<room-slug>` indexable                                             | [ADR-0009](docs/adr/0009-hotel-room-subpages-indexable.md)                                                  |
| ISR via auth client island (hotel + destination = `revalidate = 3600`)                                    | [ADR-0007](docs/adr/0007-isr-via-auth-client-island.md)                                                     |
| Locales V1 = `fr` + `en` ; V2 = +es/de/it ; V3 = +ar/zh/ja                                                | `.cursor/skills/seo-technical/SKILL.md`                                                                     |
| International hotels (`country_code != 'FR'`, `region` nullable, `luxury_tier` CHECK on 19 awards/brands) | `packages/db/migrations/0033_hotels_country_support.sql` + `docs/editorial/yonder-intl-expansion-wakeup.md` |

## 4. Hard rules (non-negotiable)

### Code

1. **No `any`, no `as Foo`, no non-null `!`.** Narrow with Zod or type guards.
2. **No `dangerouslySetInnerHTML`** outside the `JsonLdScript` Server Component.
3. **No PII in logs.** Hash, omit, or summarise. Never email/phone/full name/payment.
4. **No new layer-crossing imports.** Domain never imports `fetch`, `next/*`, `@supabase/*`.
5. **Migrations are forward-only.** Don't edit applied SQL. Don't reorder filenames.
6. **i18n keys, not hard-coded strings.** Even error messages.
7. **Server Components by default.** `'use client'` requires real interactivity.
8. **One `Sentry.init` per runtime.** Use the existing `instrumentation*.ts` files.

### Hotel detail page (CDC §2 — `.cursor/rules/hotel-detail-page.mdc`)

9. **≥ 30 photos catégorisées** (10 categories required) avant publication. Validation Payload bloque.
10. **≥ 10 FAQ Q&A** (les 10 questions canoniques obligatoires). Validation Payload bloque.
11. **`AggregateRating.bestRating: '5'`** dans le JSON-LD. Jamais `'10'` (Google Rich Results affiche /5 quoi qu'il arrive).
12. **`Offer.priceValidUntil`** obligatoire (CDC §2.8).
13. **Indicateurs d'urgence** ("X personnes consultent", "stock restant") **interdits** sauf preuve Amadeus (`offer.availability: 'LimitedAvailability'` réelle) — DSA art. 25, DGCCRF.
14. **Awards** rendus en JSON-LD uniquement si `verified: true` côté Payload.
15. **Room sub-page canonical** strict vers elle-même, jamais vers la fiche parent.
16. **Alt enrichi** mots-clés + contexte sur toute image hôtel (`alt="piscine extérieure chauffée Hôtel X Nice"`).

## 4bis. Content completion order (2026-05-25 audit — written content first, photos last)

Product-owner decision (2026-05-25): **finish the written content layer
across the full catalogue before touching photos** (`.cursor/skills/photo-pipeline/SKILL.md`
§Sequencing decision documents the rationale). When you face a choice
between a written-content chantier and a photo chantier, **pick the
written one**.

Catalogue snapshot at the time of the decision:

| Surface              | Total | Published | Draft |
| -------------------- | ----- | --------- | ----- |
| `hotels`             | 949   | 443       | 506   |
| `editorial_rankings` | 216   | 131       | 85    |
| `editorial_guides`   | 86    | 50        | 36    |
| `itineraries`        | 20    | 20        | 0     |

Field-by-field completeness on the **443 published hotels** (chase
these gaps in this order — top of the list is the most painful trade-off
between effort and impact):

> ⚠ **Audit metric ≠ production validator.** Two thresholds coexist for
> every text field: (a) the **production envelope** baked into the Zod
> schema that gates publish (e.g. `factual_summary` = 110-165 chars in
> `scripts/editorial-pilot/src/hotels/factual-summary-generator.ts`),
> and (b) the **CDC ideal** documented in the spec (e.g. 130-150 chars
> in CDC §2.3). The first is the real blocker; the second is
> aspirational. Always cite the production envelope when reporting gaps
> — otherwise we over-count work and burn tokens re-generating already-
> passing rows. See the dedicated section in
> [`editorial-pilot/SKILL.md`](.cursor/skills/editorial-pilot/SKILL.md)
> §"Audit metric vs production validator".

| Rank | Field                                                                | Envelope conforming (prod Zod)                 | CDC ideal conforming     | Pipeline outillé ?                                                   |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| 1    | `policies` (CDC §2.9 hard rule — check-in / pets / cancel / taxes)   | 86 / 443 (19%)                                 | (same)                   | ❌ to build                                                          |
| 2    | `factual_summary_fr/en` (envelope 110-165 chars; CDC §2.3 = 130-150) | **443 / 443 (100%)** since 2026-05-25 backfill | 200 FR / 208 EN (≈ 46%)  | ✅ `scripts/editorial-pilot/src/hotels/run-hotel-factual-summary.ts` |
| 3    | `meta_desc_fr/en` (envelope TBD; CDC = 140-170 chars)                | 164 (37%) — measured on CDC band               | (same)                   | ❌ to build                                                          |
| 4    | `description_fr` (envelope ≥ 200 chars baked-in; CDC §2.4 ≥ 600)     | 434 / 443 (98%) at ≥ 200 chars                 | 337 / 443 (76%) at ≥ 600 | ❌ to build (some upstream extension would also do it)               |
| ✅   | `long_description_sections` ≥ 3                                      | 443 (100%)                                     | (same)                   | already done                                                         |
| ✅   | `faq_content` ≥ 10                                                   | 443 (100%)                                     | (same)                   | already done                                                         |
| ✅   | `concierge_advice`                                                   | 443 (100%)                                     | (same)                   | already done                                                         |

Then the 506 draft hotels need the same 4 blocks (they already have
long_description_sections + faq + concierge_advice → only #1-4 separate
them from publish). Then editorial guides drafts (36), then rankings
drafts (85). Itineraries are 20/20 published — done.

**Phase 1 = chase the 4 gaps on published hotels** at the **production
envelope** level (the real blocker). With `factual_summary` closed
2026-05-25, the remaining envelope gaps are #1 `policies` (357),
#3 `meta_desc` (279), #4 `description_fr ≥ 200` (9). Tightening to the
CDC ideal is an optional Phase 1.5 once envelope-level is 100 %. Once
published-quality is conformant, Phase 2 promotes the 506 drafts.
Phase 3 finishes editorial guides + rankings. Phase 4 is the photo
migration.

## 5. Operational essentials

- **Database**: live Supabase project ID `fsmfozxgujskluxakeoq` (region eu-west). Populated catalogue as of 2026-05-25: 949 hotels (443 published), 216 rankings, 86 editorial guides, 20 itineraries. Migrations applied via the Supabase MCP (`apply_migration`).
- **Vercel**: previews per PR, production = `main`. Sentry source maps uploaded on prod builds only (`SENTRY_AUTH_TOKEN`).
- **CI**: GitHub Actions runs lint → typecheck → unit → build → e2e. Husky `pre-commit` runs `lint-staged`, `pre-push` runs `tsc --noEmit`.
- **MCP servers** wired up locally (status as of 2026-05-25):
  - ✅ **Operational**: `user-supabase` (DB schema + SQL exec), `plugin-vercel-vercel` (deployments + build logs), `plugin-sanity-Sanity` (CMS docs, OAuth `contact@travelba.fr`), `plugin-cloudinary-cloudinary-asset-mgmt` (27 tools — upload, search, transform), `plugin-cloudinary-cloudinary-env-config` (26 tools — presets, transformations, triggers), `plugin-cloudinary-cloudinary-smd` (11 tools — Structured Metadata fields + rules), `cursor-app-control`, `cursor-backend-control`, `cursor-ide-browser`.
  - ⚠️ **Auth claimed but tools not yet exposed**: `plugin-cloudinary-cloudinary-analysis` — `mcp_auth` returned success but no tools surface in the available list. Possibly a lazy-load quirk. Retry `mcp_auth` if the next call still fails.
  - ⚠️ **Needs OAuth click** (only expose `mcp_auth`): `plugin-opsera-devsecops-opsera`. Authenticate when the task actually needs it — the OAuth popup must be clicked in the IDE within 2 min.
  - ❌ **Broken credentials**: `plugin-tavily-tavily` (token expired — "Not connected"; reconnect via Cursor → Settings → Tools & Integrations → MCP → Tavily → Reconnect), `plugin-resend-resend` ("API key is invalid" — regenerate at `resend.com/api-keys` with Full Access then paste in Cursor MCP settings).
  - 🚫 **Mentioned in past sessions but NOT configured on this machine**: Datadog, GitHub, Superhuman, shadcn — either install them or stop referencing them in agent prompts.

  **Gotcha — Cloudinary is exposed as 5 separate MCPs in Cursor**:
  `asset-mgmt`, `env-config`, `smd` (Structured Metadata), `analysis` (AI vision),
  `mediaflows` (workflow automation). **Each has its own OAuth** even though the
  vendor dashboard groups them under one Cloudinary login. Clicking "Connect" on
  the Cursor plugin row covers `asset-mgmt + env-config` only; the other three
  require an extra `mcp_auth` round-trip per MCP. **Auth them lazily** when a
  workflow actually needs them — don't bulk-auth upfront.

  Prefer MCP tools to manual shell when the task fits, but always check the MCP descriptor (`mcps/<server>/tools/<tool>.json`) before calling — schema drift is the #1 source of `Invalid arguments` errors.

## 6. Commit / PR hygiene

- Conventional Commits: see `.cursor/rules/commit-conventions.mdc`.
- One concern per PR. Prefer 5 small PRs over a 60-file giant.
- Always update or add a test alongside a business-rule change.
- Reference an ADR (`docs/adr/0000-*.md`) when you change a layer boundary or rendering strategy.

## 7. When in doubt

- Check `.cursor/skills/<topic>/SKILL.md` — there are 35+ skills covering every vertical. Browse the catalogue: [`.cursor/skills/README.md`](.cursor/skills/README.md).
- Open `docs/adr/` for past decisions.
- Ask a human before disabling a CI check, lowering a Supabase RLS policy, or removing a Sentry init.

## 8. Capitalisation continue — if you discover a new pattern, capture it

The agent who follows you should not pay the cost of a lesson you already
paid. **When you hit a non-obvious gotcha during a session, before closing
the task:**

1. Decide if it's reusable (will another agent or session hit this?).
2. Pick the closest existing skill and add a short subsection, OR create a
   new skill via `.cursor/skills/<new-skill>/SKILL.md` (see
   `~/.cursor/skills-cursor/create-skill/SKILL.md` for the template).
3. Cross-link it from the related skills' "References" section so it's
   discoverable from multiple angles.
4. Update [`.cursor/skills/README.md`](.cursor/skills/README.md) — both
   the catalogue and the "problem → skill" matrix.

Patterns worth capturing: vendor API quirks, schema validation traps,
shell/env gotchas, prompt-engineering tactics that worked, type-level
interop oddities. Anything that took you more than one iteration to fix.

Welcome aboard.

## Cursor Cloud specific instructions

### Environment basics

- **Node 20.19.4** (from `.nvmrc`) via nvm; **pnpm 10.33.2** via corepack.
- The update script handles `nvm install`, `corepack prepare`, and `pnpm install --frozen-lockfile`.
- After install, pnpm warns about ignored build scripts (esbuild, sharp, msw, etc.). The platform-specific binaries (`@esbuild+linux-x64`, `@next/swc-linux-x64-gnu`) are installed as separate packages so **no manual `pnpm approve-builds` or `pnpm rebuild` is needed** — the dev server and build work without running postinstall scripts.

### Running the web app (`apps/web`)

- Create `apps/web/.env.local` (not just workspace root) with `SKIP_ENV_VALIDATION=true` and `NEXT_PUBLIC_SKIP_ENV_VALIDATION=true`. The `@t3-oss/env-nextjs` loader in the middleware will crash without this flag when real credentials are absent.
- The `pnpm dev:web` script uses `--turbopack`, which is **incompatible** with `experimental.typedRoutes` in `next.config.ts`. Run the dev server without Turbopack: `cd apps/web && npx next dev --port 3000`.
- First page compile takes ~15–19 s (webpack mode); subsequent HMR is fast.
- The app degrades gracefully without real Supabase/Redis/Algolia/Amadeus credentials — pages render but data-dependent sections return empty/null.

### Running lint / typecheck / tests

- `pnpm lint` — runs ESLint on `@mch/web` and `@mch/admin` (2 packages have lint scripts).
- `pnpm typecheck` — runs `tsc --noEmit` across all 11 workspace packages.
- `pnpm test:unit` — runs Vitest in `@mch/domain`, `@mch/web`, `@mch/integrations`.
- All three commands work out of the box with no external services.

### Build

- `SKIP_ENV_VALIDATION=true NEXT_PUBLIC_SKIP_ENV_VALIDATION=true pnpm build` succeeds without real credentials (~90 s).
- Sentry wrapper is automatically skipped when `SENTRY_AUTH_TOKEN` is absent.

### Key gotchas

- `.env.local` must live in `apps/web/` (not just the monorepo root) because `next dev` reads env from its CWD.
- The `pre-push` hook runs `pnpm turbo run typecheck` and `pnpm validate:skills` — ensure both pass before pushing.
