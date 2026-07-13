---
name: booking-parity-ux
description: >-
  Enforces Booking.com structural UX parity for the MCH v2 refonte — home,
  SRP, hotel detail, and account templates. Use when building or reviewing
  apps/web-v2 UI, packages/ui-v2 components, mobile-first layouts, the parity
  matrix, PriceSlot, or when validating that v2 matches Booking interaction
  patterns without dark patterns.
---

# Booking parity UX — MyConciergeHotel.com v2

Structural parity with Booking.com is a **product requirement** (CDC v2 Q29):
users must not re-learn navigation. Surface styling stays MCH (tokens, Concierge
voice, editorial depth). This skill is the enforcement manual for that split.

Architecture: [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../../docs/cdc/cahier-des-charges-v2-booking-like.md)
Matrix: [`docs/v2/benchmark-booking-parity-matrix.md`](../../docs/v2/benchmark-booking-parity-matrix.md)

## Triggers

Invoke when:

- Adding or changing any route in `apps/web-v2/`.
- Creating components in `packages/ui-v2/` (SearchBar, ResultCard, BookingBox…).
- Reviewing a PR for « Booking-like » acceptance.
- Deciding whether an interaction is **OK**, **à corriger**, or **écart assumé**.
- Implementing mobile sticky bars, filter bottom sheets, or anchor scroll-spy.

## Rule 1 — Structure before surface

Booking owns **order, density, and interaction**. MCH owns **typography, color,
copy, editorial blocks below the fold**.

| Layer  | Booking owns                                 | MCH owns                              |
| ------ | -------------------------------------------- | ------------------------------------- |
| Header | 2 rows, tabs, search always visible          | Logo, Concierge tabs, gold accent     |
| SRP    | Sidebar filter order, card tripartite layout | Badge éditorial, Concierge highlights |
| Fiche  | Anchors, mosaic, sticky box, room table      | Long-read, ConciergeAdvice, FAQ PAA   |
| Compte | Tile hub, trip list pattern                  | Member tier Base/Gold/Platinum        |

If structure diverges, fix structure first — never compensate with visual polish.

## Rule 2 — Mobile-first, 375px first

Every v2 component is designed at **375px width** before desktop.

- Touch targets ≥ **44×44 px** (buttons, hearts, filter chips).
- SRP filters → **full-screen bottom sheet** with live result count on the CTA.
- Fiche → **fixed bottom booking bar** (PriceSlot + primary CTA), not a floating
  FAB lost in the scroll.
- Carousels → horizontal swipe; no hover-only affordances.

See [`responsive-ui-architecture`](../responsive-ui-architecture/SKILL.md) for
tokens and Server Component dropdown patterns.

## Rule 3 — Matrice de parité obligatoire

Before marking a template « done »:

1. Open [`benchmark-booking-parity-matrix.md`](../../docs/v2/benchmark-booking-parity-matrix.md).
2. Walk **desktop + mobile** for every row of the template.
3. Set status per row: **OK** | **à corriger** | **écart assumé** (with ADR link).
4. Bascule gate: **100 % OK or écart assumé** on structural rows (header, search,
   ResultCard, sticky box, account tiles).

PR description must cite matrix row IDs (e.g. `SRP-S2`, `F4`).

## Rule 4 — SearchBar omnipresent

The search block (destination + dates + occupants) is **never hidden**:

- **Home** — hero full-width.
- **SRP, fiche, annuaire, destination** — compact sticky variant, always editable.
- Dates/occupants travel as context to quote/devis — **never simulate availability**
  (Q13).

Component contract: `SearchBar` props shared across surfaces via
`packages/ui-v2/search-bar.tsx` + Zod `SearchContextSchema`.

## Rule 5 — PriceSlot modes (no fabricated prices)

Single component, two modes — see CDC §7:

| Mode        | When                | Renders                                              |
| ----------- | ------------------- | ---------------------------------------------------- |
| `concierge` | v2 launch → Phase 9 | « Prix via le Concierge » + devis CTA + member tease |
| `live`      | Phase 9+            | Public TTC + member price + comparator row           |

**Never** show a numeric price in `concierge` mode. **Never** strikethrough without
API-sourced comparison (DGCCRF).

## Rule 6 — Rating display /10 ; JSON-LD /5

UI shows **/10 + qualitative label** derived from source /5. Structured data stays
`bestRating: '5'`. See [ADR-0032](../../docs/adr/0032-v2-booking-parity-ui-rating.md).

```typescript
// Display only — packages/domain or ui-v2 helper
const displayTen = Math.round(ratingOutOfFive * 2 * 10) / 10;
// JSON-LD: ratingValue = ratingOutOfFive, bestRating = '5'
```

Do not store /10 in the database.

## Rule 7 — Anti-dark-patterns (hard bans)

| Pattern                                                  | Verdict                                   |
| -------------------------------------------------------- | ----------------------------------------- |
| « X people viewing this hotel »                          | **Ban** — unless real API flag (Phase 9+) |
| « Only 1 room left » without `LimitedAvailability` proof | **Ban**                                   |
| Pre-checked marketing consent                            | **Ban** — RGPD opt-in                     |
| Fake countdown timers on PriceSlot                       | **Ban**                                   |
| Member discount % without config source                  | **Ban** — use programme config Zod        |
| Filter apply without result count                        | **Fix** — Booking shows count on button   |

These align with DSA art. 25 and [`hotel-detail-page.mdc`](../../.cursor/rules/hotel-detail-page.mdc) Hard Rule 13.

## Rule 8 — Account hub = Booking tiles

`/compte` renders a **tile grid** (not a prose dashboard):

- Mon statut membre (tier badge + progress)
- Mes voyages
- Mes listes (named wishlists — not single `/favoris` only)
- Mes demandes
- Informations personnelles
- Préférences
- Sécurité
- Confidentialité

`robots: noindex`. Member programme marketing lives on **`/programme-membre`**
(indexable), not buried in account.

Le Concierge Club routes → **301** to `/programme-membre` (Q18).

## Rule 9 — Editorial layer is subordinate

Long-read sections, ConciergeAdvice, FAQ, EEAT render **below** canonical Booking
blocks (anchors, mosaic, room table, amenities, reviews summary). Never replace
the sticky booking box with editorial CTA above the fold.

JSON-LD richness is a MCH advantage over Booking — keep ItemList, FAQPage,
Speakable on rankings; **no Offer** until Phase 9 ([ADR-0025](../../docs/adr/0025-booking-integration-last-brick.md)).

## Rule 10 — User acceptance before ship

Any user-visible v2 change requires walk-through per
[`user-acceptance-loop`](../user-acceptance-loop/SKILL.md):

- Entry URLs: `/`, `/recherche`, `/hotel/le-meurice`, `/compte`, `/programme-membre`.
- Desktop + mobile (375px).
- FR + EN.
- Discoverability: reach feature in ≤ 2 clicks from `/`.

## Rule 11 — Query-family ownership per template (ADR-0034)

Each v2 template owns ONE query family — never cross-target
(PO decision 2026-07-07, [`docs/adr/0034-v2-keyword-targeting-model.md`](../../docs/adr/0034-v2-keyword-targeting-model.md)):

| Template                                   | Query family                                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `/hotel/[slug]`                            | `Hôtel {Nom}` · `… tarif` · `… promo`                                                                      |
| `/hotels/[pays]` + `/hotels/[pays]/[zone]` | `Hôtel {Pays\|Ville\|Région}`                                                                              |
| `/classement/[slug]`                       | `Meilleur hôtel de luxe à {Ville}` · `Meilleur hôtel 5 étoiles en {Pays}` · `Les plus beaux hôtels {Pays}` |

Enforcement:

- All title/H1/meta come from `apps/web-v2/src/lib/seo/keyword-templates.ts`
  — never hard-code a SEO title in a page.
- Hotel fiche MUST render anchored `#tarifs` + `#promos` sections
  (`HOTEL_DETAIL_ANCHORS`) — they capture the tarif/promo long tail.
- The annuaire zone segment accepts city OR region
  (`resolveDemoZone` / read-model equivalent).
- Superlative lexicon (« meilleur », « plus beaux ») is FORBIDDEN in
  fiche and annuaire titles — rankings own it.
- Ranking slugs follow the 3 canonical patterns detected by
  `detectRankingPattern()`.

## Anti-patterns

| Anti-pattern                      | Why it fails                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| « We'll add mobile later »        | Booking parity is mobile-majority traffic                                            |
| Figma-only sign-off (E1)          | Prototypes must be coded in browser                                                  |
| Copying Booking hex colors        | Surface = MCH tokens, not blue clone                                                 |
| Skipping matrix update            | Drift undetected until PO rejection                                                  |
| `bestRating: '10'` for « parity » | Breaks Rich Results — ADR-0032                                                       |
| New feature only in `apps/web`    | v1 frozen — [`v2-migration-freeze.mdc`](../../.cursor/rules/v2-migration-freeze.mdc) |

## Acceptance checklist (PR)

```
- [ ] Matrix rows cited and status updated
- [ ] 375px screenshot attached for changed template
- [ ] No banned dark patterns introduced
- [ ] PriceSlot mode correct (concierge vs live)
- [ ] Rating /10 in DOM, /5 in JSON-LD view-source
- [ ] SearchBar visible on affected routes
- [ ] i18n keys — no hard-coded French in components
```

## References

- Matrice : [`docs/v2/benchmark-booking-parity-matrix.md`](../../docs/v2/benchmark-booking-parity-matrix.md)
- URL mapping : [`docs/v2/url-mapping-v1-v2.md`](../../docs/v2/url-mapping-v1-v2.md)
- ADR rating : [`docs/adr/0032-v2-booking-parity-ui-rating.md`](../../docs/adr/0032-v2-booking-parity-ui-rating.md)
- ADR SQL `v2` : [`docs/adr/0033-v2-sql-schema-isolation.md`](../../docs/adr/0033-v2-sql-schema-isolation.md)
- Responsive : [`responsive-ui-architecture`](../responsive-ui-architecture/SKILL.md)
- Structured data : [`structured-data-schema-org`](../structured-data-schema-org/SKILL.md)
- Yonder benchmark : [`.cursor/rules/competitor-benchmark-yonder.mdc`](../../.cursor/rules/competitor-benchmark-yonder.mdc)
- v1 freeze : [`.cursor/rules/v2-migration-freeze.mdc`](../../.cursor/rules/v2-migration-freeze.mdc)
