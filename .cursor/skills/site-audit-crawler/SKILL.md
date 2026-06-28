---
name: site-audit-crawler
description: Site-wide health crawler/auditor (L3) for MyConciergeHotel.com. Walks the sitemap and asserts every published URL (HTTP 200, single h1, title/meta/canonical, hreflang parity, no scaffolding leak in prose, valid JSON-LD with no frozen Offer + AggregateRating on /5, live internal links + images, anti "0 hôtels" list value). Use when you need to verify the WHOLE site works/clicks/is coherent at catalogue scale (8000+ URLs), not just a sampled set, or to gate a Vercel preview / monitor prod.
---

# Site-audit crawler (L3) — exhaustive page health

The package `scripts/site-audit` (`@mch/site-audit`) is the **L3** layer of the
QA pyramid: between functional E2E (L2, "does it click") and visual / perf
(L4/L5). It answers the question _"does **every** published page work, click,
and stay coherent?"_ — at the real catalogue scale (~8 200 URLs), which the
sampled `apps/web/e2e/menu-no-404.spec.ts` (~21 routes) cannot.

It is a **read-only HTTP crawler** — no DB, no creds. It runs against prod, a
Vercel preview, or any base URL.

## Triggers

Invoke when:

- You need to prove the whole site is healthy (links/images/SEO/coherence),
  not a hand-picked sample.
- A "ghost" bug shipped to prod that green CI missed (e.g. a listing rendering
  "0 hôtels", a renamed route 404ing from the nav, a broken Cloudinary tile, a
  scaffolding sentence leaking into rendered prose).
- Gating a PR's Vercel preview, or running a scheduled prod health check (L6).
- Extending the per-URL checks (add a new `Finding` in `src/checks.ts`).

## How to run

The script is **`crawl`**, NOT `audit` — `pnpm audit` is a pnpm built-in that
shadows a script of that name (the `--` args become pnpm flags → cryptic
`Unknown option: 'recursive'`).

```bash
# Fast budget pass (status + h1 + SEO only, no link/image probing):
pnpm --filter @mch/site-audit crawl -- --budget-only --sample=200

# Full audit of a sample (links + images live):
pnpm --filter @mch/site-audit crawl -- --sample=50

# A whole group, capped:
pnpm --filter @mch/site-audit crawl -- --only=hotels,rankings --limit=300

# Explicit URLs (bypass sitemap), report-only (never exit non-zero):
pnpm --filter @mch/site-audit crawl -- --urls=/,/hotel/le-meurice --fail-on=none

# Against a preview build:
pnpm --filter @mch/site-audit crawl -- --base=https://<preview>.vercel.app --sample=80
```

Flags: `--base` (default `$NEXT_PUBLIC_SITE_URL` → prod), `--only=g1,g2`,
`--limit=N` (per group), `--sample=N` (random across all), `--max-urls=N`,
`--urls=a,b`, `--budget-only`, `--no-links`, `--no-images`, `--concurrency=N`,
`--fail-on=fail|warn|none` (default `fail` → exit 1 on any fail). Reports land
in `scripts/site-audit/runs/site-audit-<ts>.{json,html}` (git-ignored).

## What it checks (per URL)

| Check                        | Severity             | Catches                                               |
| ---------------------------- | -------------------- | ----------------------------------------------------- |
| `http-status`                | fail                 | 404 / 500 / unexpected redirect                       |
| `h1`                         | fail (0) / warn (>1) | missing or duplicate H1                               |
| `title` / `meta-description` | warn                 | missing / out-of-band SEO copy                        |
| `canonical`                  | warn                 | missing / non-self-referential                        |
| `hreflang`                   | warn                 | alternates present but fr/en missing                  |
| `noindex`                    | warn                 | sitemap'd page emits robots `noindex` (contradiction) |
| `scaffolding-leak`           | fail                 | pipeline/brief prose leaked live                      |
| `jsonld-parse`               | fail                 | malformed JSON-LD                                     |
| `jsonld-offer-frozen`        | fail                 | `Offer` emitted (Phase 6 frozen)                      |
| `jsonld-rating-scale`        | fail                 | `AggregateRating.bestRating ≠ "5"` (Hard Rule 11)     |
| `broken-links`               | fail                 | internal `<a>` → 4xx/5xx                              |
| `broken-images`              | fail                 | `<img>` / srcset → 4xx/5xx                            |
| `unreachable-{links,images}` | warn                 | probe failed twice (flaky/WAF, not a hard breakage)   |
| `list-value`                 | fail                 | listing renders "0 hôtels" (anti the 2026-06-23 bug)  |

## Hard-won lessons (false-positive traps — keep the tool trusted)

A health crawler is only useful if its FAILs are real. Three traps were fixed
on the first prod run; do not regress them:

1. **Decode `&amp;` in extracted URLs.** HTML serialises `&` as `&amp;`, so a
   raw `<img src>` extraction yields `/_next/image?url=…&amp;w=1920`, which
   **400s** when requested verbatim (Next reads `amp;w` instead of `w`).
   `extractAnchorHrefs` / `extractImageUrls` run `decodeEntities` on every URL.
   Tested in `lib/html.test.ts`.

2. **Bound asset-probe concurrency + retry once, and class `null` as WARN.**
   A page-fetch pool of C with L links + I images per page fires `C×(L+I)`
   sockets to one origin; undici queues + times them out, yielding spurious
   `null` ("ERR") on healthy URLs (`/marque/aman` returns 200 to curl but ERR'd
   under a ~320-socket flood). Fix = a shared `Semaphore` (default 16) in
   `createAssetProber`, one retry on `null`, and reporting a post-retry `null`
   as a soft **`unreachable-*` warn** (likely flaky/WAF) — only a real 4xx/5xx
   is a hard `broken-* fail`. Never fail a crawl on probe jitter.

3. **Leak detection on a RENDERED PAGE needs its own marker set.** The shared
   editorial gate (`scaffolding-gate.ts`) flags lexical tokens — `wikidata`,
   Wikidata `Q…` ids, backtick code — that must never appear in DB editorial
   prose. But a rendered page legitimately shows them as **EEAT source
   attributions** (`<HotelExternalSourcesFooter>` renders "Wikidata" /
   "Wikipédia" + links to `…/wiki/Q123`). Running the full gate on whole-page
   text false-positived on every fiche with the (correct) provenance footer.
   `src/page-leak.ts` keeps only the **high-precision PROSE** signatures
   (brief/dossier narration, "non renseigné", "vérification manuelle",
   word-count bookkeeping, AUTO*DRAFT…) and drops the lexical/source tokens.
   Both detectors share intent; they differ because their \_input context*
   differs (DB field vs rendered DOM). Tested both directions in
   `page-leak.test.ts` (Wikidata footer = clean; "le brief confirme" = leak).

   **Generalise:** any reuse of a write-gate regex against a _different input
   surface_ (rendered HTML, search snippet, email body) must re-evaluate which
   markers are legitimate in that surface — a gate calibrated for one context
   silently false-fails another.

4. **Marker precision on rendered pages (2026-06-28 full-site crawl).** The
   editorial-gate markers over-fire on whole rendered pages, which legitimately
   carry phrases the single-DB-field gate never sees. Four FP classes fixed in
   `page-leak.ts` / `checks.ts` (re-validate before re-adding any):
   - bare `(le|ce|du|au) dossier` → rankings boilerplate "la lecture humaine **du
     dossier**" (= the customer's _booking case_). Keep only narration forms
     (`dossier incomplet/lacunaire`, `le dossier reste incomplet`).
   - `non document[ée]` → adjectival "un programme non documenté" in prose. Drop.
   - `niveau de confiance` → legit "un niveau de confiance **utile/élevé**".
     Require the pipeline score token (`niveau de confiance low|medium|high`).
   - `jsonld-offer-frozen` flagging ANY `Offer` → the **live** Concierge Club
     `MemberProgram` tiers (`OfferCatalog` + `eligibleCustomerType` on
     `/le-concierge/*`). Flag only hotel-booking Offers: on a `/hotel/` ·
     `/chambres/` surface OR carrying `priceValidUntil` / `availability`.

   The crawl also found the previously un-scanned leak field
   **`hotels.signature_experiences`** ("Moment signature … Le brief souligne …")
   — the AGENTS de-leak waves covered description / sections / concierge_advice /
   faq, not this one. Full write-up: `docs/audits/full-site-health-crawl-2026-06-28.md`.

## Real bugs it caught on day one

- `/classements` and `/classements/lieu/ile-de-france` render **"Classement
  éditorial de 0 hôtels à la montagne"** — a genuine empty-listing leak (the
  exact class of bug the `user-acceptance-loop` §Assert VALUES note warns about,
  now caught automatically at scale).
- The sitemap walk surfaced `guides=0` in `guides.xml` (0 `<loc>`) while 99
  editorial guides are published — a coverage gap worth a follow-up.

## Architecture (where to extend)

- `src/lib/html.ts` — pure extractors (h1/title/meta/canonical/alternates/
  links/images/json-ld/visibleText). Regex-based, dependency-free.
- `src/lib/sitemap.ts` — `extractLocs` (pure) + `loadSitemapUrls` (walk index →
  sub-sitemaps).
- `src/lib/http.ts` — `fetchPage`, `fetchText`, `createAssetProber` (semaphore +
  cache + retry).
- `src/checks.ts` — `runStaticChecks` (pure, the per-URL verdicts). **Add new
  checks here**; return a `Finding` with the right severity.
- `src/page-leak.ts` — page-scoped leak detector (see lesson 3).
- `src/crawl.ts` — bounded worker pool + link/image probing.
- `src/report.ts` — JSON + HTML + text digest builders.
- `src/run.ts` — CLI.

All pure modules are unit-tested (`*.test.ts`, 56 cases). Network code is
validated end-to-end against prod.

## References

- [`test-strategy`](../test-strategy/SKILL.md) — the QA pyramid; this crawler is
  its L3 (exhaustive page health) layer between E2E and Lighthouse.
- [`user-acceptance-loop`](../user-acceptance-loop/SKILL.md) — §Assert VALUES is
  the manual analogue of the `list-value` check; the crawler automates it.
- [`concierge-voice-pipeline`](../concierge-voice-pipeline/SKILL.md) — owns the
  shared `scaffolding-gate.ts` whose markers the page-leak detector derives.
- [`structured-data-schema-org`](../structured-data-schema-org/SKILL.md) — the
  JSON-LD contracts the crawler verifies (no Offer, AggregateRating on /5).
- [`editorial-rankings-matrix`](../editorial-rankings-matrix/SKILL.md) — §Rule 9
  (publish-gate) is the root-cause fix for the "0 hôtels" rankings this crawler
  surfaced (`docs/audits/rankings-health-crawl-2026-06-26.md`).
