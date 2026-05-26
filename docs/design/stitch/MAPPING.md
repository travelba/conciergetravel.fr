# Stitch screen ↔ Next.js route mapping

Initial pass after the 2026-05-26 first pull. **9 screens** found in project
`11149337623414320821`. Each row's "Stitch screen title" was inferred from
the rendered screenshot — open the original in the Stitch UI to confirm and
overwrite if needed.

> ⚠ **Major brand-level findings** (open questions, see chat 2026-05-26):
>
> 1. The Stitch designs use the brand name **"ConciergeTravel.fr"**, not
>    "MyConciergeHotel.com". The footer reads "© 2024 ConciergeTravel.fr —
>    Le confident des palaces de France. Agence agréée IATA - Affiliée AAVF".
>    → Decision needed: full rebrand, partial rebrand (keep current domain),
>    or align Stitch designs back to the existing brand before any code work.
> 2. The dashboard exposes a **"Privilège" loyalty tier with points
>    (24 500 pts)** instead of the current Club (free) + Prestige (paid)
>    architecture defined in [ADR-0019](../../adr/0019-le-concierge-club-architecture.md).
>    → Decision needed: redesign the loyalty domain, or keep the existing
>    domain and re-skin only.

## Mapping

| Stitch screen ID                   | Inferred title                                     | Target Next.js route                             | Status                       |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------ | ---------------------------- |
| `8e5c5a99bf1a4fc9829525b1aa2ebc8f` | Homepage — hero château + search                   | `/`                                              | ⏳                           |
| `1335ff1e9ff44a57b6a68f16afc172e7` | Search results — list + interactive map            | `/recherche`                                     | ⏳                           |
| `eb47749c89c54be19472b3ec1eaec68c` | Hotel detail (desktop) — Le Bristol Paris          | `/hotel/[slug]`                                  | ✅ Phase 2b shell + CDC body |
| `e732529b3bb04ada8158073b4aad0c85` | Hotel detail (mobile/compact) — Le Bristol         | `/hotel/[slug]` (mobile variant)                 | ✅ flat nav mobile panel     |
| `b64819396ca144ae96dc3003d6fee11c` | Hotel detail (variant) — Le Bristol                | `/hotel/[slug]` (alt layout)                     | 🔶 same route as desktop     |
| `7a7e885544d24fc6821db5100501dc5f` | Booking funnel step 1 — room selection             | `/reservation/start` or `/hotel/[slug]/reserver` | ⏳                           |
| `582fdb8e25504b72bd34e6c1a57136f6` | Member dashboard — "Privilège" tier + Carnet       | `/compte`                                        | ⏳ ⚠ loyalty model mismatch  |
| `2de148f26e604f5da6b505b5f5ead4f7` | Editorial guide — "Paris : Au-delà des Apparences" | `/guide/[citySlug]` or `/destination/[citySlug]` | ⏳                           |
| `dc7e15e1d901496ba3c16b2f0941c59f` | Legal — Mentions légales (with TOC sidebar)        | `/mentions-legales`                              | ⏳                           |

## Visual design tokens (inferred from screenshots — to confirm in Stitch UI)

- **Brand wordmark**: serif italic-ish "ConciergeTravel.fr" — likely Cormorant Garamond, Playfair Display, or Tenor Sans
- **Background**: warm off-white / cream (~`#f8f5f0`)
- **Primary text**: near-black, no pure `#000`
- **Accent**: muted gold / bronze for the wordmark and CTAs (~`#b48e4c`)
- **Secondary CTA**: deep forest green (~`#2f4a3a`) on "Voir la fiche", "Continuer", "Rechercher"
- **Body typography**: clean modern sans-serif (Inter, IBM Plex Sans, or similar)
- **Composition**: very airy, generous whitespace, no decorative noise
- **Iconography**: thin-stroke line icons (heart, globe, chat, profile)
- **Navigation**: top bar — `[wordmark] | Destinations | Guides | Classements | Concierge | [♡ 👤 🌐 💬]`

## Routes present in code but missing from Stitch (gap audit)

The current app ships **56 public routes** under `apps/web/src/app/[locale]/`.
The 9 Stitch screens cover roughly the "discovery → conversion" funnel, but
many surfaces have no equivalent yet:

| Route family in code                        | Stitch coverage                      |
| ------------------------------------------- | ------------------------------------ |
| `/hotel/[slug]/chambres/[roomSlug]`         | ❌ no Stitch screen                  |
| `/itineraire/[slug]`                        | ❌                                   |
| `/classement/[slug]`                        | ❌                                   |
| `/destination/[citySlug]`                   | partial (one editorial guide screen) |
| `/le-concierge-club*`                       | ❌ (and loyalty model diverges)      |
| `/le-concierge/*` (institutional)           | ❌                                   |
| `/reservation/{recap,payment,confirmation}` | ❌ (only step 1 designed)            |
| `/(legal)/{cgv,confidentialite,cookies}`    | partial (only mentions-légales)      |

## Next steps

1. **Validate the brand decision** (rebrand to ConciergeTravel.fr or re-skin only) — blocks everything else.
2. **Validate the loyalty model decision** (keep Club/Prestige or move to Privilège/points).
3. Refresh this mapping when more Stitch screens are added (re-run `pnpm --filter @mch/design-import pull`, then update the table).
4. Once the brand + loyalty calls are made, generate the Phase B Canvas: per-route effort estimate + sequencing for the redesign work.
