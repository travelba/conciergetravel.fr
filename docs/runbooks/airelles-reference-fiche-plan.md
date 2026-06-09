# Fiche de référence Airelles Gordes — conformité au template hôtel

> Statut : **validé PO (2026-06-09)**. Source de vérité design :
> `design/html-kit` + `template-hotel.html` (Homepage 2) + `apps/web/src/styles/kit.css`.
> Objectif : rendre `/hotel/les-airelles-gordes` (FR + EN) **exactement** conforme
> au template (sections + données), puis généraliser à toutes les fiches.

## Principe directeur

- **Cible unique** : `les-airelles-gordes`. Aucune autre fiche/surface n'avance
  tant que cette fiche n'est pas validée.
- La **structure** vit dans un seul composant (`apps/web/src/app/[locale]/hotel/[slug]/page.tsx`).
  Quand Airelles est conforme, **toutes** les fiches héritent de la structure.
  La généralisation = surtout **remplir les données** par hôtel + QA visuelle.
- **Garde-fous non négociables** : 1 seul `FAQPage`, `#factual-summary` (+ `data-aeo`),
  fact-sheet GEO `#en-bref`, ConciergeAdvice avant la FAQ, note /5 + source,
  **aucune donnée fabriquée**, photos **légales uniquement** (skill `photo-pipeline`).

## Décisions actées (D1–D6)

| #   | Décision                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| D1  | Organigramme **9 sections du template** = canonique (remplace l'ordre « golden » PO).                                        |
| D2  | Regrouper les composants épars sous 3 H2 conteneurs : **L'hôtel en bref**, **Ils en parlent**, **Autour de l'hôtel**.        |
| D3  | Mini-galerie par chambre : câbler `hotel_rooms.images[]` + sourcer les photos chambre.                                       |
| D4  | **Kid Club** = entrée typée `signature_experiences` (`kind: kid_club`), pas de nouvelle table.                               |
| D5  | **Le Concierge Club** = composant statique partagé (skill `membership-program`).                                             |
| D6  | Conflit d'ancre : garder le fact-sheet GEO sous `#en-bref` ; le cluster services du template prend l'ancre `#hotel-en-bref`. |

## Audit données Airelles (Phase 0 — 2026-06-09, Supabase prod)

| Donnée                                                                                                            | État                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `gallery_images`                                                                                                  | 12 ✅ · hero `cct/hotels/les-airelles-gordes/press-1`                                               |
| `highlights` 6 · `amenities` 29 · `faq_content` 12 · `awards` 3                                                   | ✅                                                                                                  |
| `signature_experiences`                                                                                           | 6 ✅ — **pas de Kid Club**                                                                          |
| `featured_reviews`                                                                                                | 3 ✅ — **toutes presse** (MICHELIN, Forbes, The Hotel Journal), 0 avec note                         |
| `points_of_interest`                                                                                              | 16 ✅ — visit=5 / do=7 / shop=4 (**pas de bucket « restos autour »**)                               |
| `upcoming_events`                                                                                                 | 5 ✅                                                                                                |
| `restaurant_info` / `spa_info` / `policies` / `concierge_advice` / `concierge_hook` / `long_description_sections` | ✅                                                                                                  |
| `hotel_rooms`                                                                                                     | 8 — **4 avec 1 photo (hero), 4 sans photo** ; `images[]` vide ; pas de prix ; aucune `is_signature` |

**Manques = données (Phase 3), pas structure** : photos par chambre, Kid Club, « restaurants autour ».

## Organigramme cible (9 sections)

| #   | Ancre            | Section                                                                | Composants                                                     |
| --- | ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| —   | —                | Galerie mosaïque (pleine largeur, en tête)                             | `HotelGallery`                                                 |
| —   | —                | Tête (eyebrow, H1, étoiles, loc, note) + `htl-feats`                   | `HotelHero` + feats                                            |
| 1   | `#apropos`       | Le mot du Concierge (`.concierge-quote`) + prose SEO dépliable         | `conciergeHook` + `HotelStory` + `FactualSummary` (GEO)        |
| 2   | `#chambres`      | Chambres & suites — carrousel + mini-galerie/chambre                   | `HotelRoomsGrid` → carrousel                                   |
| 3   | `#hotel-en-bref` | L'hôtel en bref : Services / Expérience / Restaurants / Spa / Kid Club | Amenities + SignatureExperiences + Restaurants + Spa + KidClub |
| 4   | `#presse`        | Ils en parlent : Presse / Distinctions / Instagram / classement        | Press(split reviews) + Awards + Instagram + FeaturedInRankings |
| 5   | `#acces`         | Emplacement & accès + Avis voyageurs                                   | `HotelLocation` + `HotelPolicies` + avis notés                 |
| 6   | `#autour`        | Autour de l'hôtel : visiter / faire / pendant / restos / commerces     | `HotelNeighbourhoodBuckets` + `HotelEvents`                    |
| 7   | `#faq`           | Questions fréquentes (groupées par thème)                              | `HotelFaq`                                                     |
| 8   | `#club`          | Le Concierge Club (inline)                                             | **nouveau** `HotelClubInline`                                  |
| 9   | `#proximite`     | Les hôtes à proximité                                                  | `RelatedHotels`                                                |
| —   | `#resa`          | Aside : `.resa-card` + `.resa-compare`                                 | `BookingSlot` + `PriceComparator`                              |
| —   | `#en-bref`       | Fact-sheet GEO (clôt la page)                                          | `HotelEnBref`                                                  |

JSON-LD : `Hotel` + **`Restaurant`** (nouveau, depuis `restaurant_info`) + `BreadcrumbList` + `FAQPage`.

## Phases

- **Phase 0** ✅ audit données Airelles.
- **Phase 1** structure : refonte du corps `page.tsx` en 9 sections (ordre/ancres/classes + regroupements).
- **Phase 2** composants : carrousel chambres (2.1), split presse (2.2), Kid Club (2.3), Concierge Club inline (2.4), JSON-LD Restaurant (2.5).
- **Phase 3** données Airelles : photos chambre (pipeline Tavily légal), Kid Club, restos autour, prose.
- **Phase 4** validation : DoD ci-dessous.
- **Phase 5** généralisation (après « validé » PO).

## Definition of Done — Airelles

- [ ] 9 sections présentes, ordre + design conformes (screenshots FR + EN vs template).
- [ ] Chambres en carrousel + mini-galeries (réelles ou 1 photo + placeholder propre).
- [ ] « L'hôtel en bref » regroupe Services/Expérience/Restaurants/Spa/Kid Club.
- [ ] « Ils en parlent » regroupe Presse/Distinctions/Instagram/classement.
- [ ] « Autour » : sous-blocs visiter/faire/pendant/(restos)/commerces.
- [ ] Aside : carte résa + comparateur (données réelles ou « sélectionnez vos dates »).
- [ ] Garde-fous : 1 `FAQPage`, `#factual-summary`, `#en-bref`, JSON-LD Hotel+Restaurant+Breadcrumb+FAQ valides, axe clean.
- [ ] Aucune donnée fabriquée ; aucun hotlink illégal.
- [ ] **PO : « validé »**.
