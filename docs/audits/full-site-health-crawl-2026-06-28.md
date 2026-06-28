# Full-site health crawl — 2026-06-28

> Exhaustive L3 crawl of the **entire sitemap (8 198 URLs)** via
> `scripts/site-audit` (skill [`site-audit-crawler`](../../.cursor/skills/site-audit-crawler/SKILL.md)),
> run after the PO asked to "corrige tout et pousse le diagnostic à tout le site".
> Command: `pnpm --filter @mch/site-audit crawl -- --full --budget-only --concurrency=12`.

## Result

|          | Initial full crawl | After fixes (re-crawl of flagged URLs)              |
| -------- | ------------------ | --------------------------------------------------- |
| Total    | 8 198              | —                                                   |
| OK       | 5 117              | —                                                   |
| Warn     | 3 009              | (title/meta length — editorial-judgment, unchanged) |
| **Fail** | **72**             | **0** (all resolved or expected-transient)          |

Fail breakdown + resolution:

| Check                 | Count | Root cause                                                                         | Resolution                                                |
| --------------------- | ----- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `scaffolding-leak`    | 56    | mix of real content leaks + crawler false positives                                | **fixed** (see below) → re-crawl 54→0                     |
| `jsonld-offer-frozen` | 3     | crawler FP (Concierge Club MemberProgram tiers ≠ booking Offer)                    | **crawler fixed** → 0                                     |
| `http-status`         | 7     | the 7 nonsensical rankings I unpublished (404) still in `rankings.xml` (ISR ≤ 1 h) | **expected/transient** — sitemap drops them on revalidate |
| `fetch`               | 6     | transient timeouts under crawl load (concurrency 12)                               | **transient** — all 200 on re-test                        |

## Real content leaks fixed (DB, via Supabase MCP)

The 56 `scaffolding-leak` flags were a mix. The **real** leaks (pipeline "le
brief" / "the brief" narration in live prose) were neutralised at the source
with a deterministic, agreement-preserving transform (`dans le brief` → `par nos
soins`, `le/du/au/ce brief` → `notre sélection`, EN `listed in the brief` → `we
selected`, etc. — never touches legit English "a brief stroll"):

| Surface              | Field                                                                  | Rows fixed                                                                                                              |
| -------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `editorial_guides`   | `tables` / `sections` / `faq` notes                                    | 12 (new-york, mykonos, madeira, bali, bresil, cambodge, hongrie, mexique, philippines, royaume-uni, singapour, vietnam) |
| `editorial_rankings` | `intro/outro/sections/faq/tables/factual_summary`                      | 39                                                                                                                      |
| `hotels`             | **`signature_experiences`** ("Moment signature … Le brief souligne …") | 29                                                                                                                      |

Post-fix DB scan: **0** `le/du/au/ce brief` + 0 other markers across guides,
rankings, hotels. The `hotels.signature_experiences` field was the previously
un-scanned leak surface (the AGENTS de-leak waves 5-14 covered description /
long_description_sections / concierge_advice / faq, not signature_experiences).

## Crawler false positives fixed (precision — keep the tool trusted)

A health crawler is only useful if its FAILs are real. The full crawl exposed
4 false-positive marker classes in `page-leak.ts` / `checks.ts`; all fixed +
unit-tested (78 cases):

1. **Bare `(le|ce|du|au) dossier`** matched the rankings boilerplate "la lecture
   humaine **du dossier**" (= the customer's booking case, not the data dossier)
   → 29 ranking FPs. Dropped from the page detector; only narration forms kept
   (`dossier incomplet/lacunaire/mince`, `le dossier reste incomplet`, EN `the
dossier confirms/remains`).
2. **`non document[ée]`** matched the adjectival "un programme spécifique non
   documenté" in legit prose. Dropped from the page detector.
3. **`niveau de confiance`** matched the legit "ajoute un niveau de confiance
   utile" / "niveau de confiance élevé". Tightened to require the pipeline score
   token (`niveau de confiance low|medium|high`).
4. **`jsonld-offer-frozen`** flagged ANY `Offer`, including the live Concierge
   Club `MemberProgram` membership tiers (`OfferCatalog` with
   `eligibleCustomerType` on `/le-concierge/*`). Tightened to flag only
   hotel-booking Offers — on a `/hotel/` or `/chambres/` surface, OR carrying
   booking fields (`priceValidUntil` / `availability`) — never membership tiers.

**Lesson (capitalised in `site-audit-crawler`):** a marker inherited from the
editorial DB gate (single-field context) over-fires on whole rendered pages,
which legitimately carry "du dossier" (booking case), "non documenté"
(adjective), "niveau de confiance utile" (prose) and `MemberProgram` Offers. The
page detector must be calibrated to the **rendered-page surface**, not the DB
field. Verify every new page-marker against real rendered chrome before shipping.

## Code fixes (committed on the branch — live after deploy)

- **`/classements/saison/[valeur]` (printemps)**: `isKnownTaxonomyValue` was
  missing the `saison` case → empty saisons fell through to `notFound()` (200,
  no `<h1>`, generic title) that the menu linked to. Added the case → renders the
  proper empty-state (h1 + `noindex,follow` + same-axis cross-links).
- **`/categorie/[slug]` emptiness check**: read only the first **200** published
  hotels (`listPublishedHotelsForIndex()` default) → categories whose hotels sit
  beyond row 200 (boutique-hotels, chalets-luxe) were wrongly judged empty →
  `noindex` while `hubs.xml` (reads 2500) listed them → sitemap↔noindex
  contradiction. Bumped to 3000 (full catalogue).

## Remaining (warns — editorial-judgment, unchanged)

3 009 warns: ~1 857 meta-description + ~1 608 title outside the SEO band. These
are copy-length judgment calls (keyword copy across thousands of pages) tracked
in `rankings-health-crawl-2026-06-26.md` §Editorial-judgment warns — not
breakages, left for a PO/SEO copy pass.
