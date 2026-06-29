# Country editorial guides — audit + `guide-*` stub dedup (2026-06-28)

Worker task: finish + publish the country guides; per AGENTS.md Phase 3 the
country-scope `editorial_guides` were believed split into ~10 "clean" rows
(`espagne`, `italie`, `japon`…) and ~35 FR-only `guide-*` stubs needing EN
parity + publish.

**The premise was stale.** The SQL audit (live Supabase `fsmfozxgujskluxakeoq`,
PostgREST path) shows the country-guide surface is already complete; the only
genuine country-scope action was deleting dead duplicate stubs.

## Before (audit — `scope = 'country'`, 45 rows)

| Bucket                                              | Count | State                                                                                                                                    |
| --------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Published clean rows (`sections` + `toc` + full EN) | 28    | Render at `/destination/<slug>` via `<StandaloneGuidePage>`. EN parity = 28/28 (every section has `body_en`, every FAQ has `answer_en`). |
| Hand-built country drafts                           | 4     | `emirats-arabes-unis`, `etats-unis`, `italie`, `japon` — full EN parity in DB but kept `is_published = false` **by design**.             |
| Dead `guide-*` stubs                                | 13    | `sections = []` (scaffold artifacts, `editorial_sections` only). Never served.                                                           |

Catalogue-wide EN-parity scan (all scopes): country 0 missing EN, cluster 0,
region 0, **city 11 rows with missing EN sections** (see Handoff below).

## Why the 4 hand-built drafts stay `is_published = false` (NOT a gap)

`emirats-arabes-unis`, `etats-unis`, `italie`, `japon` (+ `suisse`, `thailande`,
`maroc`, `maldives`) are the **8 hand-built, natively-bilingual `/guide/<slug>`
React pages** — see
[`apps/web/src/lib/destinations/hand-built-country-guides.ts`](../../apps/web/src/lib/destinations/hand-built-country-guides.ts).
The destination route 308-redirects `/destination/<slug>` → `/guide/<slug>` for
these slugs (`isHandBuiltCountrySlug`), so the richer React page is canonical and
the DB row must never compete in the SERP. Publishing the DB rows would be
pointless (redirected away) and contradicts the documented design. They are
**intentionally** left draft and are NOT a completion gap.

Verified live: `/destination/japon` → 308 → `/guide/japon` (200);
`/en/guide/japon` → 307 → `/en/guide/japan` (localized EN slug, 200).

## Action taken — deleted 13 dead `guide-*` stubs

All 13 were scaffold artifacts from
[`scripts/editorial-pilot/src/global-sources/scaffold-guides-rankings-intl.ts`](../../scripts/editorial-pilot/src/global-sources/scaffold-guides-rankings-intl.ts)
(`slug = guide-${slugify(country)}`). Each had `sections = []` and
`is_published = false`. Every one has a canonical surface that already ships full
EN parity, so the stub is a pure duplicate:

| Deleted stub                | Canonical surface (kept)                          |
| --------------------------- | ------------------------------------------------- |
| `guide-allemagne`           | `allemagne` (published, `/destination/allemagne`) |
| `guide-chine`               | `chine` (published)                               |
| `guide-mexique`             | `mexique` (published)                             |
| `guide-royaume-uni`         | `royaume-uni` (published)                         |
| `guide-turquie`             | `turquie` (published)                             |
| `guide-emirats-arabes-unis` | hand-built `/guide/emirats-arabes-unis`           |
| `guide-etats-unis`          | hand-built `/guide/etats-unis`                    |
| `guide-italie`              | hand-built `/guide/italie`                        |
| `guide-japon`               | hand-built `/guide/japon`                         |
| `guide-maroc`               | hand-built `/guide/maroc`                         |
| `guide-maldives`            | hand-built `/guide/maldives`                      |
| `guide-suisse`              | hand-built `/guide/suisse`                        |
| `guide-thailande`           | hand-built `/guide/thailande`                     |

**Zero runtime/SEO impact:** `getGuideBySlug` filters `is_published = true`, the
standalone render gate requires `sections.length > 0`, and the sitemap/llms.txt
enumerate published guides only — so these rows were already dark on every
surface. No redirects needed (the `guide-*` URLs were never public; e.g.
`/destination/guide-maroc` → 404, before and after). No code references the
stub slugs (`apps/`, `scripts/`, `packages/` greps clean apart from the
scaffolder that produced them).

Rollback snapshot (full rows, 13):
[`scripts/editorial-pilot/runs/country-guide-stub-snapshot-2026-06-28.json`](../../scripts/editorial-pilot/runs/country-guide-stub-snapshot-2026-06-28.json).

## After (`scope = 'country'`, 32 rows)

| Bucket                                                       | Count |
| ------------------------------------------------------------ | ----- |
| Published clean rows (full EN parity)                        | 28    |
| Hand-built drafts (intentional, canonical = `/guide/<slug>`) | 4     |
| `guide-*` stubs                                              | **0** |

## Acceptance (prod curl, fr + en)

| URL                                        | Result                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/destination/espagne`                     | 200 · 12×`<h2>` · Article + FAQPage + BreadcrumbList JSON-LD · headline "Guide du Concierge — Espagne" · 0 leak (the lone match is the allow-listed "le dossier de presse" press-kit link) |
| `/en/destination/espagne`                  | 200 · 12×`<h2>` · JSON-LD present · headline "Concierge guide — Spain" · English prose (not FR fallback) · 0 leak                                                                          |
| `/en/destination/mexique`                  | 200 · 12×`<h2>` · full JSON-LD · 0 leak                                                                                                                                                    |
| `/guide/japon` / `/en/guide/japan`         | 200 · hand-built canonical · full JSON-LD · 0 leak                                                                                                                                         |
| `/destination/japon`, `/destination/maroc` | 308 → `/guide/<slug>` (hand-built canonical)                                                                                                                                               |
| `/destination/guide-maroc` (deleted stub)  | 404 (unchanged — always dark)                                                                                                                                                              |

Grounding: no LLM generation was run (no missing country EN to backfill, no
country publishing needed), so no `dfs_paa_coverage` to log this pass. The
DataForSEO grounding wiring on `generate-guide-v2.ts` (2026-06-26) remains
intact for future country/city regen.

## Handoff — residual EN gap is on CITY guides, not country (out of this task's scope)

11 published **city**-scope guides (the Phase 4.A international cities) render a
few sections in FR fallback on `/en` (24 sections total):

`riviera-maya` (5), `amalfi-coast` (3), `lake-como` (3), `algarve` (2), `bali`
(2), `mykonos` (2), `phuket` (2), `tokyo` (2), `marrakech` (1), `new-york` (1),
`santorin` (1).

No targeted guide-section translator exists today (only full `generate-guide-v2`
regen, which AGENTS.md explicitly warns against mass-running). Recommended fix: a
small `scripts/editorial-pilot/src/guides/translate-sections-en.ts` mirroring the
hotel `hotels/translate-sections-en.ts` pattern (faithful FR→EN-GB, numbers /
proper nouns preserved, `hasLeak()` gate, per-section `safeParse`, `--slug` /
`--all`). Tracked as a follow-up; left untouched here to respect the country
scope of this task.

## Follow-up CLOSED — guide-section EN parity backfill (2026-06-29)

The handoff above is resolved. Built the recommended tool
[`scripts/editorial-pilot/src/guides/translate-sections-en.ts`](../../scripts/editorial-pilot/src/guides/translate-sections-en.ts)
(npm: `guides:sections:en` / `:dry` / `:all`) — a faithful FR→EN-GB rewrite of
the missing `title_en`/`body_en` per `editorial_guides.sections` entry, keyed by
`key`, preserving `type` + FR bodies + section order. It mirrors the proven
hotel translator: shared `hasLeak()` gate with **sentence-level salvage**,
per-section `safeParse` (one bad section never sinks the batch),
`SECTIONS_PER_CALL = 4` to avoid 16k-token truncation, Concierge-voice +
≤ 25-word-sentence prompt (EDITORIAL_VOICE.md). Typechecks clean.

**Grounding:** a faithful translation of FR prose already DataForSEO-grounded at
generation (`generate-guide-v2.ts`, 2026-06-26) introduces no new claim and
answers no new intent, so it inherits the FR grounding — no fresh DFS round-trip
(runlog records `grounding=inherited(translation)`), same contract as the hotel
and rankings-table translators.

Run (`--all --scope=city --concurrency=4`):

| Slug         | EN sections filled | Slug      | EN sections filled |
| ------------ | ------------------ | --------- | ------------------ |
| riviera-maya | 5                  | mykonos   | 2                  |
| amalfi-coast | 3                  | phuket    | 2                  |
| lake-como    | 3                  | tokyo     | 2                  |
| bali         | 2                  | new-york  | 1                  |
| algarve      | 2                  | santorin  | 1                  |
|              |                    | marrakech | 1                  |

**11/11 guides, 24 sections translated, 0 leak-dropped.** Post-run DB scan:
**0 published guides (any scope) with a section missing `body_en`/`title_en`** —
full guide-section EN parity across the catalogue.

Acceptance (prod curl, `/en`): `riviera-maya`, `santorin`, `tokyo` all 200 with
the newly-translated English prose rendering live (not FR fallback), Article +
FAQPage JSON-LD present, 0 leak markers. The remaining 8 surface their new EN on
the next ISR revalidation (≤ 3600 s TTL). Pre-existing observation (NOT caused by
this text-only change, identical on FR + EN): `/destination/amalfi-coast` serves
a thin 7-`<h2>` render with no guide JSON-LD — a routing/ISR characteristic of
that one slug, flagged for a separate front-end pass (out of this task's scope).
