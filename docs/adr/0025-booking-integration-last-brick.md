# ADR 0025 — Booking integration is the last brick (fiche hôtel éditoriale)

- Status: accepted
- Date: 2026-06-01
- Refs:
  - Règle process : [`AGENTS.md §4ter`](../../AGENTS.md) — « Booking API integration is the LAST brick (2026-05-25) » + matrice de phasage
  - Composant : [`apps/web/src/components/hotel/booking-coming-soon.tsx`](../../apps/web/src/components/hotel/booking-coming-soon.tsx)
  - Composant : [`apps/web/src/components/hotel/booking-slot.tsx`](../../apps/web/src/components/hotel/booking-slot.tsx)
  - Composant : [`apps/web/src/components/hotel/hotel-en-bref.tsx`](../../apps/web/src/components/hotel/hotel-en-bref.tsx)
  - Route : [`apps/web/src/app/[locale]/hotel/[slug]/page.tsx`](../../apps/web/src/app/%5Blocale%5D/hotel/%5Bslug%5D/page.tsx)
  - Skills (différés Phase 6) : [`amadeus-gds`](../../.cursor/skills/amadeus-gds/SKILL.md), [`little-hotelier`](../../.cursor/skills/little-hotelier/SKILL.md), [`booking-engine`](../../.cursor/skills/booking-engine/SKILL.md), [`payment-orchestration`](../../.cursor/skills/payment-orchestration/SKILL.md)
  - Décision liée : [ADR-0007](0007-isr-via-auth-client-island.md) (ISR via auth client island)

## Décision

Jusqu'à la **Phase 6** du projet, la fiche hôtel (et toutes les surfaces
publiques) **n'expose aucun moteur de réservation, aucun prix temps
réel, aucune disponibilité live**. Le site est livré comme une propriété
**éditoriale** : sélection du Concierge, contenu CDC §2, Conseil du
Concierge, EEAT, affiliations vérifiées.

Concrètement, sur la fiche `/hotel/[slug]` :

1. Le slot de conversion du rail droit rend un **placeholder neutre**
   `<BookingComingSoon>` (« Réservation bientôt disponible »). Le
   wrapper `<BookingSlot>` rend `null` sur la surface `mobilebar`
   (barre fixe réservée à la Phase 6, inerte d'ici là).
2. **Aucun `Offer` JSON-LD**, aucun `priceValidUntil`, aucun
   `searchParams` de booking. Le JSON-LD `Hotel` émet uniquement
   `Hotel` + `Place` + `BreadcrumbList` + `FAQPage` +
   `AggregateRating` (si avis réels) + `Review[]` + `ImageObject[]` +
   `Award[]` + `brand` (affiliations vérifiées — cf. ADR-0023).
3. Le bloc `<HotelEnBref>` ne porte **pas** de hint `bookingMode` — le
   point de conversion vit dans le rail, pas dans le résumé factuel.

## Contexte

Décision produit du 2026-05-25 (formalisée dans `AGENTS.md §4ter`) :
**toutes les données de réservation / tarification / disponibilité
proviennent d'APIs (Amadeus GDS, Little Hotelier, Makcorps/Apify,
Amadeus Payments) qui ne seront câblées qu'à la toute fin du projet.**
Le chantier prioritaire est la complétude éditoriale du catalogue
(2219 fiches), les guides, classements, itinéraires, le maillage
interne, l'EEAT et les photos — pas la tuyauterie booking.

Avant cette décision, la fiche hôtel embarquait un `BookingWidget` +
des `Offer` JSON-LD spéculatifs. Les laisser en place produisait deux
risques : (a) afficher des CTA « Réserver » sans backend, donnant une
promesse non tenue à l'utilisateur ; (b) indexer des `Offer` sans
`priceValidUntil` réel — exactement ce que `hotel-detail-page.mdc`
Hard Rule 5 interdit.

Cet ADR existe parce que trois composants
(`booking-slot.tsx`, `booking-coming-soon.tsx`, `hotel-en-bref.tsx`)
référençaient par erreur **ADR-0024** (qui traite du _transform photo
signature_) comme source de la décision « éditorial d'abord ». La
décision n'avait pas d'ADR dédié — seulement `AGENTS.md §4ter`. Cet
ADR comble ce trou et devient la référence canonique.

## Conséquences

### Produit / UX

- ✅ Promesse honnête : aucun bouton « Réserver » qui mènerait à un
  cul-de-sac. Le placeholder annonce clairement « bientôt disponible ».
- ✅ Le CTA éditorial « Réserver via le Concierge » (header) reste, mais
  pointe vers un flux de contact statique — pas un round-trip GDS.

### SEO / GEO

- ✅ Pas d'`Offer` sans `priceValidUntil` indexé (conforme Hard Rule 5
  - DSA art. 25 sur les pratiques trompeuses).
- ✅ Le JSON-LD reste riche (Hotel/Place/FAQ/Review/Award/brand) — la
  valeur SEO/GEO ne dépend pas du booking.

### Implémentation

- ✅ Aucune dépendance Amadeus/Little/Makcorps n'est importée dans une
  route publique. Les routes ne sont `force-dynamic` que si une autre
  raison l'exige (cf. ADR-0007 — auth client island réactive l'ISR).
- ✅ Bascule Phase 6 localisée : remplacer la branche `rail` de
  `<BookingSlot>` par le widget live + restaurer la barre `mobilebar`.

## Hors scope jusqu'à Phase 6 (ne pas proposer, ne pas implémenter)

Voir la liste exhaustive dans `AGENTS.md §4ter` :

| Élément différé                                          | Raison                                        |
| -------------------------------------------------------- | --------------------------------------------- |
| `Offer` + `priceValidUntil` JSON-LD                      | Dépend des offres Amadeus                     |
| Booking widget dans la fiche                             | Pas de backend GDS avant Phase 6              |
| Funnel `/recherche → /results → /offer → /checkout` live | Idem                                          |
| Comparateur Makcorps / Apify                             | Idem                                          |
| Enrichissement sentiments Amadeus dans `ReviewsBlock`    | Idem                                          |
| Indicateurs urgence (`LimitedAvailability`, stock)       | Non-applicable + interdit hors preuve Amadeus |
| Iframe paiement (Amadeus Payments, 3DS2, Apple Pay)      | Idem                                          |
| `idempotencyKey` des actions booking                     | Idem                                          |

## Si la décision doit être révisée plus tard

Le seul contexte qui rouvre cet ADR : **le démarrage effectif de la
Phase 6** (catalogue éditorial livré, multilingue V2/V3 en place). À ce
moment, écrire un ADR successeur qui décrit l'architecture booking
réelle (offer lock, idempotency, paiement) et qui remplace le
placeholder `<BookingComingSoon>` par le widget live. Les skills
`amadeus-gds`, `little-hotelier`, `booking-engine`,
`payment-orchestration` décrivent déjà l'architecture cible.
