# ADR-0031 — Editorial route cacheability after JSON-LD nonce removal

- Status: **Proposed** (migration plan — requires PO + security sign-off before any flip)
- Date: 2026-06-28
- Deciders: TBD — PO (travelba) arbitrage + security review (β-gate of ADR-0027)
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

## Migration plan (the scoped spike — what to actually run next)

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
