# Skills catalogue — MyConciergeHotel.com

> 36 agent skills covering every vertical. Each skill is a `SKILL.md` file
> with YAML frontmatter (`name`, `description`) that Cursor reads at session
> start; the body is loaded into context only when the agent decides the
> skill is relevant to the current task.
>
> **Convention** : SKILL.md ≤ 500 lines, third person, concrete code
> examples, explicit "Triggers" section.

## 1. How to use this file

| You are…                            | Read…                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| A new agent landing on the repo     | [`AGENTS.md`](../../AGENTS.md) first, then this catalogue. |
| About to work on a specific feature | The "Problem → skill" matrix below.                        |
| Designing cross-cutting infra       | The "Categories" section.                                  |
| Capturing a new pattern             | Section 4 — capitalisation workflow.                       |

## 2. Problem → skill matrix

Use this when you don't know where to start.

| Problem / Feature                                                                                                      | Skill                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Booking tunnel (search → offer → payment → confirmation)                                                               | [`booking-engine`](booking-engine/SKILL.md)                                                                    |
| Hotel detail page, room sub-pages, editorial fiches                                                                    | [`content-modeling`](content-modeling/SKILL.md)                                                                |
| Long-read editorial guides / rankings — **matrice architecture** (combinator, axes, slugOverride, postal_code)         | [`editorial-rankings-matrix`](editorial-rankings-matrix/SKILL.md) ⭐ NEW                                       |
| Long-read editorial guides / rankings — **LLM pipeline**                                                               | [`llm-output-robustness`](llm-output-robustness/SKILL.md) ⭐                                                   |
| Long-read editorial guides / rankings — **rendering** (TOC, auto-link, callouts)                                       | [`editorial-long-read-rendering`](editorial-long-read-rendering/SKILL.md) ⭐ NEW                               |
| **Voix du Concierge** (pass 8, concierge_advice, shortener phrases > 25 mots)                                          | [`concierge-voice-pipeline`](concierge-voice-pipeline/SKILL.md) ⭐ NEW                                         |
| **Humanizer POI / events / FAQ** (batch, retry harness, clampFeatured, audits cross-blocks)                            | [`concierge-voice-pipeline` §Rule 6](concierge-voice-pipeline/SKILL.md) ✏️                                     |
| **`nearbyAttraction` enrichi + `ItemList` POI visit** (description, schema_type, geo, openingHours)                    | [`structured-data-schema-org` §Place](structured-data-schema-org/SKILL.md) ✏️                                  |
| **FAQ Top 5 visible + FAQPage 10-15** (ADR-0011 C1, `<TopConciergeFaq>` Server Component, pas de doublon JSON-LD)      | [`geo-llm-optimization` §FAQ extraction](geo-llm-optimization/SKILL.md) ✏️                                     |
| **Factual enrichment** (DATAtourisme + Wikidata + Wikipedia + Tavily)                                                  | [`content-enrichment-pipeline`](content-enrichment-pipeline/SKILL.md) ⭐ NEW                                   |
| **Itinéraires éditoriaux** (6-pass pipeline, maillage interne, long-tail par catégorie)                                | [`itinerary-editorial-pipeline`](itinerary-editorial-pipeline/SKILL.md) ⭐ NEW                                 |
| **Hotel/itinerary photos** (Pinterest hotlink legal risk, Wikimedia → Cloudinary migration, SMD fields, hero fallback) | [`photo-pipeline`](photo-pipeline/SKILL.md) ⭐ NEW                                                             |
| Amadeus Hotels API (search, offers, booking, PNR)                                                                      | [`amadeus-gds`](amadeus-gds/SKILL.md)                                                                          |
| Little Hotelier API (loyalty FREE tier eligibility)                                                                    | [`little-hotelier`](little-hotelier/SKILL.md)                                                                  |
| Price comparator widget (Makcorps + Apify, no affiliate links)                                                         | [`competitive-pricing-comparison`](competitive-pricing-comparison/SKILL.md)                                    |
| Algolia search (autocomplete, facets, indexing)                                                                        | [`search-engineering`](search-engineering/SKILL.md)                                                            |
| **Any vendor / LLM integration** (HTTP, Zod, retries, errors)                                                          | [`api-integration`](api-integration/SKILL.md)                                                                  |
| Amadeus Payments iframe, 3DS2, Apple/Google Pay                                                                        | [`payment-orchestration`](payment-orchestration/SKILL.md)                                                      |
| Brevo transactional emails + lifecycle automations                                                                     | [`email-workflow-automation`](email-workflow-automation/SKILL.md)                                              |
| Le Concierge Club — domain tier rules + `hotel_member_benefits` + Stripe billing (Phase 6)                             | [`loyalty-program`](loyalty-program/SKILL.md)                                                                  |
| Le Concierge Club — funnel + UI + JSON-LD `MemberProgram` + Sentry events + SEA / Brevo briefs                         | [`membership-program`](membership-program/SKILL.md)                                                            |
| Supabase Auth (customer / editor / operator / admin / seo)                                                             | [`auth-role-management`](auth-role-management/SKILL.md)                                                        |
| Payload CMS 3 collections, hooks, ISR revalidation                                                                     | [`backoffice-cms`](backoffice-cms/SKILL.md)                                                                    |
| Next.js 15 App Router (routes, metadata, caching, middleware) + **force-dynamic for JSON-LD**                          | [`nextjs-app-router`](nextjs-app-router/SKILL.md) ✏️                                                           |
| **Zod schemas ↔ React props** under `exactOptionalPropertyTypes`                                                       | [`typescript-strict-zod-interop`](typescript-strict-zod-interop/SKILL.md) ⭐ NEW                               |
| TypeScript strict baseline (no `any`, no `as`, no `!`)                                                                 | [`typescript-strict`](typescript-strict/SKILL.md)                                                              |
| Pure domain logic, branded types, bounded contexts                                                                     | [`domain-driven-design`](domain-driven-design/SKILL.md)                                                        |
| Supabase Postgres schema, migrations, RLS                                                                              | [`supabase-postgres-rls`](supabase-postgres-rls/SKILL.md)                                                      |
| Upstash Redis (ARI cache, comparator cache, rate limit, idempotency)                                                   | [`redis-caching`](redis-caching/SKILL.md)                                                                      |
| RLS, secrets, **CSP nonce + JSON-LD wrapper**, GDPR, rate limiting                                                     | [`security-engineering`](security-engineering/SKILL.md) ✏️                                                     |
| WCAG 2.2 AA — forms, modals, dialogs, color contrasts                                                                  | [`accessibility`](accessibility/SKILL.md)                                                                      |
| Mobile-first responsive UI (Tailwind + shadcn + tokens)                                                                | [`responsive-ui-architecture`](responsive-ui-architecture/SKILL.md)                                            |
| **CSS-only dropdown / menu** that keeps the host as a Server Component (hover + focus-within, no `'use client'`)       | [`responsive-ui-architecture` §CSS-only dropdowns](responsive-ui-architecture/SKILL.md) ✏️                     |
| **`unstable_cache` returning a `Map`/`Set`/`Date`** silently 500s on cache hit (JSON round-trip → `{}`)                | [`nextjs-app-router` §`unstable_cache` return values MUST be JSON-serialisable](nextjs-app-router/SKILL.md) ✏️ |
| Metadata, hreflang, sitemaps, robots, anti-cannibalisation                                                             | [`seo-technical`](seo-technical/SKILL.md)                                                                      |
| llms.txt, AEO blocks, JSON-LD agent-skills, FAQ extraction                                                             | [`geo-llm-optimization`](geo-llm-optimization/SKILL.md)                                                        |
| JSON-LD builders (Hotel, Article, FAQ, ItemList, BreadcrumbList) + **CSP nonce contract**                              | [`structured-data-schema-org`](structured-data-schema-org/SKILL.md) ✏️                                         |
| Core Web Vitals, image / font optim, code splitting, edge runtime                                                      | [`performance-engineering`](performance-engineering/SKILL.md)                                                  |
| Sentry, structured logs, Web Vitals, alerts, dashboards                                                                | [`observability-monitoring`](observability-monitoring/SKILL.md)                                                |
| Unit (Vitest) + integration (MSW) + E2E (Playwright) + axe + Lighthouse                                                | [`test-strategy`](test-strategy/SKILL.md)                                                                      |
| GitHub Actions, Vercel previews, Supabase migrations, release flow                                                     | [`cicd-release-management`](cicd-release-management/SKILL.md)                                                  |
| **Vercel env vars scoped per environment** (Production / Preview / Development trap)                                   | [`cicd-release-management` §Rule 9](cicd-release-management/SKILL.md)                                          |
| **`turbo-ignore` cancels empty commits / off-scope changes** — `--allow-empty` can't force a rebuild                   | [`cicd-release-management` §Rule 10](cicd-release-management/SKILL.md) ✏️                                      |
| **Direct SQL update bypasses Payload `afterChange`** — cache stays stale on publish via Supabase MCP                   | [`backoffice-cms` §Direct SQL updates](backoffice-cms/SKILL.md) ✏️                                             |
| **Publish itinerary seed from `draft` → `published`** — 2-phase flow, cache invalidation patterns                      | [`itinerary-editorial-pipeline` §Rule 6](itinerary-editorial-pipeline/SKILL.md) ✏️                             |
| **Next.js App Router `_folder` private convention** (route silently 404s)                                              | [`nextjs-app-router` §Private folders](nextjs-app-router/SKILL.md)                                             |
| **`next-intl` namespace nested under another → raw keys at runtime, prod 500** (PR #71 → #72)                          | [`nextjs-app-router` §Internationalization](nextjs-app-router/SKILL.md) ✏️                                     |
| **PowerShell / Windows dev commands, Supabase SSL strip, `commit -F` for special chars, mystery-commit recovery**      | [`windows-dev-environment`](windows-dev-environment/SKILL.md) ✏️                                               |
| README, ADRs, runbooks, integration docs                                                                               | [`technical-documentation`](technical-documentation/SKILL.md)                                                  |
| Layer boundaries, rendering strategy, new bounded context                                                              | [`product-architecture`](product-architecture/SKILL.md)                                                        |

## 3. Categories

### Foundations (apply everywhere)

- [`typescript-strict`](typescript-strict/SKILL.md) — base TS strict rules.
- [`typescript-strict-zod-interop`](typescript-strict-zod-interop/SKILL.md) ⭐ — Zod ↔ React props under `exactOptionalPropertyTypes`.
- [`domain-driven-design`](domain-driven-design/SKILL.md) — bounded contexts, pure domain.
- [`product-architecture`](product-architecture/SKILL.md) — layer boundaries, rendering strategy.
- [`api-integration`](api-integration/SKILL.md) — vendor / LLM HTTP client pattern.
- [`llm-output-robustness`](llm-output-robustness/SKILL.md) ⭐ — multi-call pipelines, schema drift tolerance, extraction patterns, pilot→scale workflow.
- [`content-enrichment-pipeline`](content-enrichment-pipeline/SKILL.md) ⭐ — multi-source factual enrichment (DATAtourisme + Wikidata + Wikipedia + Tavily).
- [`concierge-voice-pipeline`](concierge-voice-pipeline/SKILL.md) ⭐ — pass 8 voix Concierge, bloc ConciergeAdvice, shortener legacy, contraintes ADR-0011.

### Vendor integrations

- [`amadeus-gds`](amadeus-gds/SKILL.md), [`little-hotelier`](little-hotelier/SKILL.md), [`competitive-pricing-comparison`](competitive-pricing-comparison/SKILL.md), [`search-engineering`](search-engineering/SKILL.md), [`payment-orchestration`](payment-orchestration/SKILL.md), [`email-workflow-automation`](email-workflow-automation/SKILL.md).

### Data & persistence

- [`supabase-postgres-rls`](supabase-postgres-rls/SKILL.md), [`redis-caching`](redis-caching/SKILL.md), [`content-modeling`](content-modeling/SKILL.md), [`auth-role-management`](auth-role-management/SKILL.md), [`backoffice-cms`](backoffice-cms/SKILL.md).

### Front-end & UX

- [`nextjs-app-router`](nextjs-app-router/SKILL.md), [`responsive-ui-architecture`](responsive-ui-architecture/SKILL.md), [`accessibility`](accessibility/SKILL.md), [`performance-engineering`](performance-engineering/SKILL.md), [`editorial-long-read-rendering`](editorial-long-read-rendering/SKILL.md) ⭐.

### Editorial / rankings / guides pipeline

- [`editorial-rankings-matrix`](editorial-rankings-matrix/SKILL.md) ⭐ — combinator architecture, axes, `slugOverride`, `postalCodePrefixes`, deterministic vs LLM classifier.
- [`editorial-long-read-rendering`](editorial-long-read-rendering/SKILL.md) ⭐ — sticky TOC, auto-link, callouts, EEAT footer.
- [`llm-output-robustness`](llm-output-robustness/SKILL.md) ⭐ — multi-call pipelines, schema drift tolerance.
- [`concierge-voice-pipeline`](concierge-voice-pipeline/SKILL.md) ⭐ — pass 8, ConciergeAdvice, shortener.
- [`content-enrichment-pipeline`](content-enrichment-pipeline/SKILL.md) ⭐ — DATAtourisme + Wikidata + Wikipedia + Tavily.

### SEO, GEO, structured data

- [`seo-technical`](seo-technical/SKILL.md), [`geo-llm-optimization`](geo-llm-optimization/SKILL.md), [`structured-data-schema-org`](structured-data-schema-org/SKILL.md).

### Quality, security, ops

- [`security-engineering`](security-engineering/SKILL.md), [`test-strategy`](test-strategy/SKILL.md), [`observability-monitoring`](observability-monitoring/SKILL.md), [`cicd-release-management`](cicd-release-management/SKILL.md), [`windows-dev-environment`](windows-dev-environment/SKILL.md) ⭐.

### Documentation

- [`technical-documentation`](technical-documentation/SKILL.md).

### Business verticals

- [`booking-engine`](booking-engine/SKILL.md), [`loyalty-program`](loyalty-program/SKILL.md), [`membership-program`](membership-program/SKILL.md).

## 4. Capitalisation workflow — every session adds value

The system improves only if each agent contributes the lesson they paid
for. **At the end of any non-trivial task, before closing it:**

### When to update an existing skill

Add a subsection to an existing skill when:

- You found a new edge case in a covered topic (vendor returned an
  unexpected shape, schema needed a new alias, etc.).
- You discovered a new anti-pattern.
- You found a better default value (timeouts, concurrency caps, retry
  windows).

### When to create a new skill

Create a new skill when:

- You discovered an entire new topic that took multiple iterations to
  solve and isn't covered by any existing skill.
- The pattern crosses ≥ 3 existing skills (sign that it's a foundation,
  not a detail).

### Creation checklist

```
Task progress:
- [ ] Pick the right scope: project (`.cursor/skills/`) vs personal (`~/.cursor/skills/`)
- [ ] Name: lowercase, hyphens, ≤ 64 chars, specific (not "helper" or "utils")
- [ ] Description: third person, includes WHAT + WHEN, ≤ 1024 chars
- [ ] Body ≤ 500 lines, "Triggers" section explicit
- [ ] Concrete code examples from the repo (path references)
- [ ] Anti-patterns explicit ("don't do X" with reason)
- [ ] References section cross-links related skills
- [ ] Reverse-link: add to the related skills' "References" section too
- [ ] Update this README — matrix + categories
- [ ] Update AGENTS.md "Where to look first" table if the topic is new
```

### Template

Use `~/.cursor/skills-cursor/create-skill/SKILL.md` as the authoring guide.
Each project skill in `.cursor/skills/` follows the same pattern:

```markdown
---
name: skill-name
description: >-
  One-line WHAT + WHEN. Use when <trigger 1>, <trigger 2>, or
  <user mention of X / Y / Z>.
---

# Skill name — MyConciergeHotel.com

[One paragraph: what problem this solves, why it exists.]

## Triggers

Invoke when:

- …

## Rule 1 — [Pattern name]

[Concrete code, ≤ 30 lines.]

## Rule 2 — …

## Anti-patterns

- ❌ …

## References

- Related skill 1, related skill 2.
- Reference impls: `path/to/file.ts`.
```

## 5. Discovery mechanics (for the curious)

When a Cursor session starts, the agent receives:

- **Always-applied rules** (`.cursor/rules/*.mdc` with `alwaysApply: true`)
  injected verbatim into the system prompt.
- **Skill frontmatter** (name + description only) for every `SKILL.md` in
  `.cursor/skills/`. The body is **not** loaded yet.
- **AGENTS.md** mentioned as a top-level file to read first.

The agent then decides — based on the user's task — which skill bodies to
read in full via the `Read` tool. **A good description is therefore the
single most important field**: it determines whether the skill is ever
discovered or not.

Cross-references inside skill bodies act as a discovery graph: an agent
reading `api-integration` learns about `llm-output-robustness`, which
links to `typescript-strict-zod-interop`, etc.

---

**Legend** : ⭐ = added in May 2026 sessions ; ✏️ = significantly extended in May 2026.

## 6. May 2026 — capitalisation log

This batch capitalised the editorial v2 launch:

| Pattern paid for                                                                                                           | Capture                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| LLM truncation on multi-faceted prompts → multi-call architecture                                                          | `llm-output-robustness`                                                                      |
| LLM extraction vs generation (temperature 0, gpt-4o-mini, evidence_quote)                                                  | `llm-output-robustness` rule 9                                                               |
| `AUTO_DRAFT` sentinels for missing facts                                                                                   | `llm-output-robustness` rule 10                                                              |
| Pilot → validate → scale workflow                                                                                          | `llm-output-robustness` rule 11                                                              |
| Word-count gates as warnings, not blockers                                                                                 | `llm-output-robustness` rule 12                                                              |
| `exactOptionalPropertyTypes` ↔ Zod ↔ React props interop                                                                   | `typescript-strict-zod-interop`                                                              |
| PowerShell quoting, Supabase SSL strip, Unix commands                                                                      | `windows-dev-environment`                                                                    |
| DATAtourisme + Wikidata + Wikipedia + Tavily cascade                                                                       | `content-enrichment-pipeline` ⭐                                                             |
| DATAtourisme **events** (gotchas: `takesPlaceAt` nested, silent 0 on subtype filters, swapped dates)                       | `content-enrichment-pipeline` §Rule 11                                                       |
| **Hotel photo audit + Pinterest hotlink risk** (214 illegal hotlinks detected 2026-05-25)                                  | `photo-pipeline` ⭐                                                                          |
| Itinerary hero **fallback** to first-hotel `hero_image` (unblocks 5/20 without data migration)                             | `photo-pipeline` §fallback                                                                   |
| Wikimedia → Cloudinary bulk migration pipeline                                                                             | `photo-pipeline` §Migration priorities                                                       |
| Cloudinary **Structured Metadata fields** for hotel photos (hotel_slug, photo_category, alt_text_fr/en, credit, licence)   | `photo-pipeline` §canonical-shape                                                            |
| TOC sidebar + EnrichedText auto-link + callouts + sources footer                                                           | `editorial-long-read-rendering` ⭐                                                           |
| **CSP nonce ↔ `JsonLdScript` ↔ `force-dynamic` contract** (PR #56 / #57)                                                   | `structured-data-schema-org`, `nextjs-app-router`, `security-engineering` (all extended)     |
| **`next-intl` namespace nesting silently 500s `force-dynamic` pages** (PR #71 → hotfix PR #72)                             | `nextjs-app-router` §Internationalization (extended) + smoke contract in `e2e/smoke.spec.ts` |
| **PowerShell `git commit -m` mangles `>`, `&`, `\|`, newlines → use `git commit -F`** (PR #71)                             | `windows-dev-environment` §Rule 9 ter                                                        |
| **"Mystery commit" on local `main` recovery without `--force` to origin** (commit `49953e2`)                               | `windows-dev-environment` §Rule 9 quater                                                     |
| **MCP tool-call args drift on ≥ 10 KB opaque payloads** (lost JSONB sections on reims, 2026-05-24)                         | `llm-output-robustness` rule 13                                                              |
| **Audit metric mirrors the production Zod envelope, not the CDC ideal** (factual_summary "239 gap" → really 1, 2026-05-25) | `llm-output-robustness` rule 14 + `AGENTS.md` §4bis                                          |
| **`pg_net` async + transactional**: enqueue inside SECURITY DEFINER + loop-wait + raise = dead loop                        | `supabase-postgres-rls` §Async HTTP from Postgres                                            |
| **`commit;` inside procedure fails under PostgREST/MCP** (`2D000 invalid transaction termination`)                         | `supabase-postgres-rls` §Async HTTP from Postgres                                            |
| **DDL guard regex must require SQL object keyword** to avoid matching "car drop at the foot of..."                         | `supabase-postgres-rls` §DDL/DML guard regex                                                 |
| **`turbo-ignore` cancels `--allow-empty` commits → no buildId bump, no `unstable_cache` invalidation** (2026-05-25)        | `cicd-release-management` Rule 10 ✏️                                                         |
| **Direct SQL `update set status='published'` bypasses Payload `afterChange` hooks → hub cache stale** (2026-05-25)         | `backoffice-cms` §Direct SQL updates ✏️ + `itinerary-editorial-pipeline` Rule 6 ✏️           |
