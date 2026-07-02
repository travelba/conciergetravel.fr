# ADR-0031 — Editorial route cacheability after JSON-LD nonce removal

- Status: **Accepted — Option C+ (2026-07-02)**. Spike executed; Option A
  (ISR HTML) **rejected on evidence**; decision = keep `force-dynamic`
  site-wide, repair the already-broken `force-static` routes, and move the
  perf lever to the shared Data Cache (`unstable_cache`). See §Spike results.
- Date: 2026-06-28 (proposed) · 2026-07-02 (decided)
- Deciders: senior agent (spike + decision), PO informed via audit remediation
  lane E (playbook 2026-07)
- Supersedes: —
- Superseded by: —
- Related: ADR-0027 (CSP model — CSP-α retained, **governs this question**),
  ADR-0013 (CSP × ISR debt), ADR-0007 (ISR via auth client island — amended by
  ADR-0027), ADR-0026 (rendering strategy — Rejected), `.cursor/rules/security-csp.mdc`

> **This ADR does NOT reverse ADR-0027.** It records a _new fact_ that post-dates
> ADR-0027's decision and lays out the concrete, low-risk validation path to
> re-open the cacheability question through ADR-0027's explicit β-gate. No code
> flip is authorized by this document — only a scoped spike + this plan.

## Context

### The perf problem (audit 2026-06-28)

The high-traffic **editorial** routes are all `export const dynamic =
'force-dynamic'` (hotel fiches `/hotel/[slug]`, rankings `/classement/[slug]`,
destinations `/destination/[citySlug]`, lieux `/lieux/*`, guides `/guide/*`).
Consequence:

- **0 % CDN cache** on the HTML document — `x-vercel-cache: MISS` on every
  request. The `s-maxage` route headers are wired but never take effect because
  `force-dynamic` opts the document out of the shared cache.
- **TTFB 0.7–12 s** — every view is a fresh Fluid Compute render (Supabase +
  Redis-cached Amadeus sentiment + POIs + FAQ + rankings).

### Why the routes are dynamic (root cause, verified)

Two server-side reads of `headers()` pull the per-request CSP nonce:

1. `apps/web/src/app/[locale]/layout.tsx` L100 —
   `const nonce = (await headers()).get('x-nonce') ?? undefined;` forwarded to
   `<SiteSeoJsonLd nonce={nonce} />`.
2. `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` L1283 — same read, forwarded
   to `<SeoJsonLd nonce={nonce} />`.

Reading `headers()` in an RSC trips Next.js' `DYNAMIC_SERVER_USAGE` detection
and forces the whole subtree dynamic. ADR-0013 / ADR-0027 established this and
chose to keep `force-dynamic` permanently (the per-request nonce is a hard rule,
`security-csp.mdc`; a nonce baked into cached HTML reopens the PR #57
header-divergence bug or degrades security — ADR-0027 §"piège nonce × cache").

### The new fact that re-opens the analysis

ADR-0027 was decided **2026-06-03**. On **2026-06-09** — six days later —
`apps/web/src/components/seo/json-ld.tsx` was corrected so that
**`JsonLdScript` no longer applies the nonce at all**:

> _"A `type="application/ld+json"` block is a data island, not executable
> JavaScript: the browser never runs it, so the CSP `script-src` directive does
> not apply and no nonce is required … The `nonce` prop is kept in the interface
> … but intentionally NOT applied to the tag."_

This is correct per the CSP spec (`script-src` only gates _executable_ scripts;
JSON-LD is inert data). **Therefore the two `headers()` reads above now feed a
deprecated no-op prop.** Our own inline markup no longer needs the nonce. The
nonce is now load-bearing for **exactly one** consumer: Next.js' framework
bootstrap inline scripts (`self.__next_f.push(...)`) under
`script-src 'self' 'nonce-{n}' 'strict-dynamic'`.

ADR-0027's decision matrix did not have this fact: it assumed per-page JSON-LD
was a nonce consumer ("Tout script inline … exige le nonce frais par requête").
With JSON-LD off the nonce, the residual blocker is narrower and worth a
measured re-evaluation — **without** weakening the CSP.

## Decision drivers

- **D1** — Do not reverse ADR-0027 unilaterally; honor its β-gate (measured cost
  - explicit security review).
- **D2** — Never add `'unsafe-inline'` / `'unsafe-eval'` to `script-src` (hard
  rule). Avoid `'unsafe-hashes'` unless security review approves (ADR-0027 β).
- **D3** — Next.js 16 hydration must keep working (the `self.__next_f.push`
  bootstrap must execute under the policy).
- **D4** — Reversible, low-blast-radius pilot before any catalogue-wide flip.

## Open question the spike must answer

**Does Next.js stamp its framework inline/loader scripts with the nonce in THIS
codebase, and if so, can a statically-rendered (ISR) editorial page still ship a
working policy without a per-request nonce?**

Nuance specific to this repo: the proxy (`apps/web/src/proxy.ts`) sets the nonce
on the **custom `x-nonce` request header** and the **response** CSP header — it
does **not** set the standard `content-security-policy` _request_ header that
Next.js' automatic nonce propagation keys off. So it is currently **unverified**
whether Next is even applying the nonce to its own scripts, or whether
hydration works today via `'strict-dynamic'` transitive trust from an external
`/_next/static` loader. The spike must capture the real rendered HTML + the
browser's CSP enforcement to know which mechanism is in play. This determines
whether ISR is reachable at all.

## Considered options (for the eventual decision — not decided here)

### Option A — Drop the dead `headers()` reads + flip pilot route to ISR

Remove the now-no-op nonce reads from `layout.tsx` + `hotel/[slug]/page.tsx`,
set `export const revalidate = 3600`, and verify the framework bootstrap still
executes. **Viable only if** the spike proves Next does not need a per-request
nonce for its scripts under the current policy (e.g. it relies on
`'strict-dynamic'` from an allow-listed external loader). Highest reward
(restores CDN/ISR per ADR-0007 original target), lowest CSP change.

### Option B — `'strict-dynamic'` + build-time hash of the Next.js loader

Add `'sha256-<loader-hash>'` for the stable external entry script and keep
`'strict-dynamic'` propagating trust; no nonce, no inline-bootstrap hashing.
Requires the inline bootstrap to be coverable transitively (CSP-γ territory —
ADR-0027 flagged this as hard because the inline bootstrap is per-page). Needs
the spike to confirm whether the inline bootstrap actually requires direct
allow-listing.

### Option C — Keep `force-dynamic`, ship the dead-read cleanup only

Remove the no-op `headers()` reads for hygiene (they mislead the next reader and
the skill doc) but stay dynamic. Zero caching gain; pure clarity. Lowest risk.

## Spike results (2026-07-02) — the open question is ANSWERED

Ground truth captured on production (`scripts/perf/spike-csp-static-check.mjs`,
Playwright Chromium, 2026-07-02):

| Route               | Rendering                                             | HTML nonce                                                | CSP violations | `self.__next_f` executed |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------- | -------------- | ------------------------ |
| `/mentions-legales` | `force-static`, `x-vercel-cache: HIT` (age 247 591 s) | **none** (0 of 59 script tags)                            | **58**         | **false** — zero JS ran  |
| `/lieux`            | `force-dynamic`, MISS                                 | fresh, on 55/58 script tags, matches the CSP header nonce | 0              | true                     |

Mechanics confirmed:

1. Next.js **does** stamp the per-request nonce on every script tag (inline
   `self.__next_f.push` bootstrap AND external `/_next/static` chunks) when the
   route renders dynamically. The proxy's response-header CSP is picked up.
2. When the route is static, the prerendered HTML carries **no nonce at all**,
   while `proxy.ts` still attaches a fresh-nonce CSP header on every response.
   Under `'strict-dynamic'` the host allowlist (`'self'`) is **ignored**, so the
   browser blocks **every** script — inline bootstrap and external chunks alike.
   The page paints (SSR HTML) but hydration, the consent banner, the header
   menus and analytics are all dead. The four `(legal)` `force-static` pages had
   been shipping in this broken state in production.
3. Therefore **any HTML-cached response (SSG, ISR, CDN `s-maxage`) is
   structurally incompatible with the current per-request-nonce CSP**: the
   cached markup can never match the fresh header nonce, and no variant of
   "remove the `headers()` read" changes that. Option A is dead, not because of
   the JSON-LD (which indeed needs no nonce) but because of Next's own scripts.

### Decision — Option C+ (Accepted)

- **Keep `force-dynamic` on every HTML route.** The `headers()` nonce read in
  `[locale]/layout.tsx` is retained and re-documented as the deliberate
  site-wide dynamic anchor (the nonce _value_ is dead; the dynamic _side
  effect_ is load-bearing).
- **Repair the broken static routes**: the 4 `(legal)` pages flip
  `force-static` → `force-dynamic` (they were the only HTML routes serving
  nonce-less cached markup). `robots.txt` / `llms*.txt` / sitemaps stay static —
  they ship no scripts.
- **Move the perf lever to the Data Cache**: the TTFB pain (3-12 s) is data
  work, not render work. The catalogue-wide Supabase scan behind
  `getDestinationBySlug` / `listPublishedCities` / the annuaire / the header
  nav (`server/destinations/cities.ts`) is now wrapped in
  `unstable_cache(..., { revalidate: 3600, tags: ['hotels-catalogue'] })`.
  ⚠ **Cached per 1000-row page, not as one catalogue entry**: the first
  attempt cached the whole catalogue in a single entry (descriptions already
  capped) and it serialised to **3.07 MB > the 2 MB Data Cache limit** — every
  write failed with a log-only warning ("Failed to set Next.js data cache …,
  items over 2MB can not be cached") and the full scan silently kept running
  per-request (home/hub/destination stuck at 2.5-5 s warm). Splitting the
  cache to one entry per page (~1.3 MB each, `page` folded into the key)
  fixed it: home 2 550 ms → **114 ms**, `/destination` hub 5 700 ms →
  **163 ms**, `/destination/paris` 5 000 ms → **113 ms** (local, warm).
  The same wrapper was extended in the same session to
  `listPublishedRankings` (7+ sequential round-trips incl. the entries count
  scan — tag `rankings-catalogue`), `getGuideBySlug` + `listPublishedGuides`
  (tag `editorial-guides`) and `listPublishedPlacesForCity` (tag
  `places-catalogue`), each with the throw-on-error contract so a transient
  outage is never persisted for a TTL window.
- **Future path to HTML caching** (out of scope, requires its own ADR + β-gate
  security review): migrate `script-src` away from per-request nonces, e.g.
  Cache Components/PPR with build-time hashes once Next 16's story covers the
  RSC inline bootstrap. Until then, no route may go static/ISR while the CSP
  carries `'nonce-…' 'strict-dynamic'`.

### Bonus finding — the 12-21 s destination pages were CPU, not I/O

Local `next start` profiling during the POC showed `/destination/paris` at a
constant **21 s TTFB** even with the new data cache warm, while guide-less
destinations sat at 3-4 s. The delta was the guide long-read render:
`<EnrichedText>` compiled the full ~5 000-entry auto-link map into Unicode
lookbehind regexes **per component render** (one per section body) and ran
every regex against every paragraph — O(entries × paragraphs) `.exec` scans.
Fix (same commit): (1) per-link-map `WeakMap` compile cache (one compilation
per page render instead of one per section), (2) lazy per-entry regex
construction, (3) a lowercase `String.includes` pre-filter that skips the
~99 % of the corpus absent from a paragraph before any regex work.

Measured after the full fix set — EnrichedText CPU + per-page catalogue cache

- rankings/guides/places caches (local `next start`, warm data cache):

| Route                                  | Before                         | After                |
| -------------------------------------- | ------------------------------ | -------------------- |
| `/` (home)                             | 2 752 ms (prod baseline)       | **114 ms**           |
| `/destination` (hub)                   | 2 600-5 900 ms                 | **163 ms**           |
| `/destination/paris` (guide long-read) | 20 700-30 000 ms               | **113 ms**           |
| `/destination/biarritz` (guide-less)   | 4 000-5 500 ms                 | **97 ms**            |
| `/classement/meilleurs-palaces-paris`  | 10 623 ms (prod baseline)      | **620 ms**           |
| `/classements` (index)                 | —                              | 85-190 ms            |
| `/hotel/le-meurice`                    | 3 000-4 464 ms (prod baseline) | **1 300 ms**         |
| `/lieux` · `/lieux/paris`              | —                              | 30-105 ms            |
| `/mentions-legales` (now dynamic)      | n/a (static, broken JS)        | 25-75 ms, JS working |

Residual: the hotel fiche (~1.3 s warm) still runs its per-slug single-row
fetches uncached (big payload rows — acceptable, and Vercel-region latency to
Supabase eu-west is far lower than from the local box). `/hotels` TTFB is
30 ms but the response body is **10.4 MB** (2 219 hotels inlined) — flagged
to the front lane for pagination.

**Hard-won lesson (capitalised in `performance-engineering`)**: an
`unstable_cache` write failure is a _silent_ perf regression — the function
result is still returned, the only signal is a server-log line
`Failed to set Next.js data cache … items over 2MB can not be cached`. Any
cache added around a catalogue-scale payload MUST be verified by (a) watching
the server log on a warm hit and (b) measuring that the warm TTFB actually
dropped. Size the entries (per-page/per-slug keys), not just the fields.

## Migration plan (the scoped spike — what was actually run)

1. **Build + capture ground truth.** `SKIP_ENV_VALIDATION=true
NEXT_PUBLIC_SKIP_ENV_VALIDATION=true pnpm build`, serve, and capture the raw
   HTML of one hotel fiche. Inspect: do `<script>` tags carry `nonce="…"`? Is
   the bootstrap inline or external? Load in a real browser and watch the
   console for `script-src` CSP violations.
2. **Pilot, behind a branch, one route only** (`/hotel/[slug]`):
   - Remove the no-op nonce read in `hotel/[slug]/page.tsx` (and, if the spike
     confirms it is the only consumer, in `layout.tsx`).
   - `export const revalidate = 3600;` (drop `force-dynamic`).
   - Rebuild and re-capture HTML. Confirm: (a) the page prerenders (no
     `DYNAMIC_SERVER_USAGE`), (b) hydration works (no CSP console error), (c)
     JSON-LD still emits in the static HTML (crawlable), (d) renders fr + en.
3. **Decide A vs B vs C** on the evidence, then take it to the **β-gate**: PO
   sign-off + security review (per ADR-0027 §"Réévaluation future"). Extend
   `apps/web/src/lib/security/csp.test.ts` to lock any new hash/origin.
4. **Roll out** to the other editorial route families only after the pilot is
   green in a Vercel preview and `x-vercel-cache: HIT` is observed there.

## Rollback

Single-line per route: re-add `export const dynamic = 'force-dynamic'` and the
`headers()` nonce read. No DB / migration / env change. Mirrors ADR-0013's
rollback.

## Consequences

- **If A succeeds**: ADR-0007's original ISR target is restored for editorial
  routes; CDN HIT + sub-second TTFB; ADR-0027 amended (the nonce-×-cache
  incompatibility no longer applies once our inline scripts are nonce-free and
  Next's scripts are proven not to need a per-request nonce).
- **If the spike shows Next's bootstrap DOES need a per-request nonce**: ADR-0027
  stands unchanged; document the negative result and keep `force-dynamic`
  (Option C cleanup optional). The β-gate stays closed.
- **No security regression either way**: this plan never adds `'unsafe-inline'`
  / `'unsafe-eval'`, and any `'unsafe-hashes'` path (Option B variants) remains
  behind explicit security review.

## What ships alongside this ADR (already done, no gate needed)

- **Hero preload reduction** (perf quick win, no CSP impact):
  `EAGER_IMAGE_COUNT` in `apps/web/src/components/hotel/hotel-gallery-lightbox.tsx`
  reduced `5 → 1`, so only the single LCP hero tile is preloaded. The mosaic hero
  is already hard-coded `priority`; the constant only governed the extra eager
  side tiles. Cuts 4 competing `<link rel=preload>` of hero-grade images.

## References

- ADR-0027 — CSP model evolution (CSP-α; β-gate definition)
- ADR-0013 — ISR vs dynamic CSP nonce
- ADR-0007 — ISR via auth client island (amended 2026-06-03)
- `apps/web/src/proxy.ts` — per-request nonce + CSP header wiring
- `apps/web/src/components/seo/json-ld.tsx` — JSON-LD nonce removal (2026-06-09)
- `apps/web/src/lib/security/csp.ts` — `buildCspHeader`, `getCspNonceOrNull`
- `.cursor/rules/security-csp.mdc` — CSP hard rule
- `.cursor/skills/structured-data-schema-org/SKILL.md` §CSP-nonce-contract
- `.cursor/skills/performance-engineering/SKILL.md` — LCP / preload guidance
