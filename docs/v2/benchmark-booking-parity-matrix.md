# Matrice de parité Booking.com — v2 MyConciergeHotel.com

> Phase 0 — tâche 0.3. Référence contractuelle pour la refonte « Booking-like ».
> Source : [`cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md) §6,
> décision Q29 (structure = Booking ; surface = MCH).
>
> **Légende statut**
>
> - **OK** — parité structurelle atteinte ou planifiée conforme au CDC.
> - **à corriger** — écart identifié, correction requise avant bascule.
> - **écart assumé** — divergence documentée et acceptée (ADR ou décision PO).

**Viewport** : chaque bloc est évalué **desktop** (≥1024px) et **mobile** (375px).
**Cible v2** : `apps/web-v2` + `packages/ui-v2`.

---

## 1. Accueil `/`

| #   | Bloc Booking.com (réf.)                          | Bloc v2 MCH                                                                                     | Desktop   | Mobile                             | Statut     | Notes                                           |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | --------- | ---------------------------------- | ---------- | ----------------------------------------------- |
| H1  | Header 2 rangées (logo, langue, aide, connexion) | Header 2 rangées (logo, FR/EN, Aide, Pour les hôteliers, Connexion / Mon compte + badge membre) | Identique | Burger + icônes utilitaires        | OK         | Q29 — pattern Booking strict                    |
| H2  | Onglets section (Hôtels, Vols, …)                | Onglets : Hôtels · Destinations · Classements · Inspiration · Le Concierge                      | Identique | Scroll horizontal ou menu          | OK         | Pas de « Vols » — écart assumé (OTA hôtel only) |
| H3  | SearchBar héro (destination, dates, occupants)   | SearchBar héro pleine largeur                                                                   | Identique | Stack vertical, CTA pleine largeur | OK         | Jamais caché (CDC §6.1)                         |
| H4  | Bandeau promo / Genius                           | Bandeau membre « Devenez membre, économisez jusqu'à 25 % »                                      | Identique | Bandeau compact                    | OK         | Lien → `/programme-membre`                      |
| H5  | Carrousels « Destinations populaires »           | Rangée horizontale villes (compteurs réels)                                                     | Identique | Swipe horizontal                   | OK         |                                                 |
| H6  | Carrousels thématiques                           | Explorez la France · Par type · Marques · Inspiration/Classements                               | Identique | Swipe                              | OK         |                                                 |
| H7  | « Vos recherches récentes »                      | Recherches récentes + « Encore intéressé ? »                                                    | Identique | Idem                               | à corriger | v1 partiel — persistance localStorage + compte  |
| H8  | Footer longue traîne                             | Footer 5 colonnes (Explorer, Top dest., Catalogue, Services, Légal)                             | Identique | Accordéon                          | OK         | CDC §6.4                                        |

---

## 2. Page résultats `/recherche` (SRP)

| #   | Bloc Booking.com                                               | Bloc v2 MCH                                                                                                    | Desktop   | Mobile                                   | Statut       | Notes                                                 |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------- | ------------ | ----------------------------------------------------- |
| S1  | Barre recherche modifiable sticky                              | SearchBar compact sticky                                                                                       | Identique | Sticky top                               | OK           |                                                       |
| S2  | Sidebar filtres (budget, étoiles, note, équipements, quartier) | Sidebar ~25–30 facettes normalisées + compteurs live                                                           | Identique | Bottom sheet plein écran + compteur live | à corriger   | v1 Algolia facets ≠ gabarit Booking ; index v2 requis |
| S3  | Tri (recommandé, prix, note, distance)                         | Barre tri + « Afficher sur la carte »                                                                          | Identique | Tri + toggle carte                       | OK           |                                                       |
| S4  | Carte Mapbox synchronisée                                      | Mapbox clustering, sync filtres ↔ pins                                                                         | Identique | Plein écran overlay                      | à corriger   | v1 carte absente ou partielle                         |
| S5  | ResultCard dense (photo carrée \| contenu \| note + prix)      | Photo carrée \| nom, étoiles, quartier, points forts, badge éditorial \| note /10 + libellé + PriceSlot + cœur | Identique | Layout vertical, note + prix en ligne    | OK           | PriceSlot mode `concierge` avant Phase 9              |
| S6  | Pagination                                                     | Pagination numérotée                                                                                           | Identique | « Voir plus » ou pagination              | OK           |                                                       |
| S7  | États filtrés noindex                                          | `noindex` + canonical vers SRP non filtrée                                                                     | N/A       | N/A                                      | OK           | Q9                                                    |
| S8  | Indicateurs urgence (« X personnes regardent »)                | **Interdit**                                                                                                   | N/A       | N/A                                      | écart assumé | DSA / DGCCRF — jamais sans preuve API (Phase 9+)      |

---

## 3. Fiche hôtel `/hotel/[slug]`

| #   | Bloc Booking.com                                  | Bloc v2 MCH                                                                                               | Desktop               | Mobile                 | Statut       | Notes                                                    |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------- | ------------ | -------------------------------------------------------- |
| F1  | H1 + étoiles + adresse + breadcrumb               | H1 DFS-grounded, étoiles, badges R&C/Palace, adresse cliquable, breadcrumb Accueil → Pays → Ville → Fiche | Identique             | Breadcrumb condensé    | OK           | URL flat conservée (ADR-0008)                            |
| F2  | Ancres sticky (Aperçu, Infos, Équipements, Avis…) | Aperçu \| Infos & tarifs \| Équipements \| Conditions \| Avis (scroll-spy)                                | Identique             | Tabs scrollables       | à corriger   | v1 TOC éditorial ≠ ancres Booking                        |
| F3  | Mosaïque 5 photos → galerie                       | 1 grande + 4, galerie plein écran par catégories, swipe                                                   | Identique             | Swipe + lightbox       | OK           | Q33 — dégradé si < 5 photos                              |
| F4  | Box sticky (note, carte, CTA réservation)         | Note /10 + libellé, mini-carte, points forts, avantages membres, PriceSlot, CTA devis                     | Colonne droite sticky | Barre fixe bas d'écran | OK           | ADR-0032 pour note /10                                   |
| F5  | Tableau chambres                                  | Type, occupants, taille, lits, conditions, PriceSlot ; lien `/chambres/[room]`                            | Identique             | Cards empilées         | à corriger   | Q11 — audit `rooms` Phase 0 ; fallback dégradé si faible |
| F6  | Grille équipements                                | AmenityGrid par catégories, populaires en tête                                                            | Identique             | Accordéon catégories   | à corriger   | v1 liste libre ≠ grille facettes                         |
| F7  | Bloc avis                                         | Badge /10 + libellé + « Note Google, N avis » (attribution)                                               | Identique             | Idem                   | OK           | Q19 — rien de fabriqué                                   |
| F8  | « À savoir » / conditions                         | HouseRulesTable depuis `policies`                                                                         | Identique             | Idem                   | OK           |                                                          |
| F9  | Environs + carte quartier                         | Carte POI + distances + maillage `/lieux`                                                                 | Identique             | Carte + liste          | OK           |                                                          |
| F10 | Prix live + comparateur OTA                       | PriceSlot `concierge` → Phase 9 `live` + comparateur                                                      | Placeholder honnête   | Idem                   | écart assumé | Phase 9 (Q42, Q43) — pas de prix fabriqué                |
| F11 | Couche éditoriale MCH                             | Long-read 6–8 sections, Conseil du Concierge, FAQ ≥10, EEAT, maillage classements                         | Sous blocs canoniques | Idem, TOC repliable    | écart assumé | Différenciateur MCH — sous, pas à la place               |
| F12 | JSON-LD Offer + prix                              | **Sans Offer** avant Phase 9                                                                              | N/A                   | N/A                    | écart assumé | ADR-0025 / CDC §3                                        |

---

## 4. Espace compte `/compte/*` (noindex)

| #   | Bloc Booking.com                      | Bloc v2 MCH                                                                                                | Desktop         | Mobile                      | Statut       | Notes                                          |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------- | --------------------------- | ------------ | ---------------------------------------------- |
| C1  | Hub tuiles (voyages, listes, profil…) | Hub tuiles : Statut membre, Voyages, Listes, Demandes, Infos perso, Préférences, Sécurité, Confidentialité | Grille 2–3 col. | Liste tuiles pleine largeur | à corriger   | v1 dashboard ≠ tuiles Booking                  |
| C2  | Badge niveau membre (Genius)          | Badge Base / Gold / Platinum + barre progression                                                           | Header compte   | Idem                        | à corriger   | Q41 — config paramétrable, placeholder Genius  |
| C3  | Mes voyages (réservations)            | Mes voyages (devis + futures résa Phase 9)                                                                 | Liste + détail  | Cards                       | à corriger   | Phase 9 pour résa live                         |
| C4  | Listes / favoris nommées              | Listes nommées + cœur SRP/fiche                                                                            | Identique       | Idem                        | à corriger   | v1 `/compte/favoris` mono-liste                |
| C5  | Profil + voyageurs accompagnants      | Infos perso + voyageurs                                                                                    | Formulaire      | Idem                        | à corriger   |                                                |
| C6  | Préférences notification              | Email + WhatsApp opt-in                                                                                    | Identique       | Idem                        | à corriger   | Q21 Brevo conservé                             |
| C7  | Sécurité (MDP, 2FA)                   | Sécurité Supabase Auth                                                                                     | Identique       | Idem                        | OK           |                                                |
| C8  | Confidentialité RGPD                  | Export / suppression                                                                                       | Identique       | Idem                        | à corriger   |                                                |
| C9  | Programme payant Club                 | **Abandonné** → 301                                                                                        | N/A             | N/A                         | écart assumé | Q18 — remplacé par `/programme-membre` gratuit |

---

## 5. Synthèse par template

| Template         | Blocs | OK  | à corriger | écart assumé | Parité globale |
| ---------------- | ----- | --- | ---------- | ------------ | -------------- |
| Accueil          | 8     | 7   | 1          | 0            | ~88 %          |
| SRP `/recherche` | 8     | 4   | 3          | 1            | ~50 %          |
| Fiche hôtel      | 12    | 6   | 4          | 2            | ~50 %          |
| Compte           | 9     | 2   | 6          | 1            | ~22 %          |

> Les pourcentages sont indicatifs Phase 0 (audit visuel v1 vs cible CDC).
> La bascule exige **100 % OK ou écart assumé documenté** sur les blocs **structurels**
> (header, search, ancres, ResultCard, box sticky, hub tuiles).

---

## 6. Anti-patterns interdits (parité + conformité)

| Pattern Booking toxique                         | Statut v2      | Référence               |
| ----------------------------------------------- | -------------- | ----------------------- |
| Faux compteurs urgence (« Plus que 1 chambre ») | **Interdit**   | DSA art. 25, CDC §2.8   |
| Prix barré sans source API                      | **Interdit**   | DGCCRF, Q39             |
| Note /10 sans libellé qualitatif                | **Interdit**   | ADR-0032                |
| JSON-LD `bestRating: 10`                        | **Interdit**   | Hard Rule 11 — reste /5 |
| Dark patterns opt-out newsletter                | **Interdit**   | RGPD                    |
| Filtres sans compteur de résultats              | **à corriger** | Parité Booking SRP      |

---

## 7. Processus de validation

1. **Prototype codé** (E1) — pas de Figma ; chaque bloc validé en navigateur desktop + 375px.
2. **Checklist PR** — toute PR `apps/web-v2` référence la ligne matrice concernée.
3. **Skill** — [`.cursor/skills/booking-parity-ux/SKILL.md`](../../.cursor/skills/booking-parity-ux/SKILL.md).
4. **Revue PO** — statut `à corriger` → `OK` uniquement après walk-through (rule `user-acceptance-before-commit`).

---

## Références

- CDC v2 : [`docs/cdc/cahier-des-charges-v2-booking-like.md`](../cdc/cahier-des-charges-v2-booking-like.md)
- ADR note UI : [`docs/adr/0032-v2-booking-parity-ui-rating.md`](../adr/0032-v2-booking-parity-ui-rating.md)
- ADR URL fiche : [`docs/adr/0008-url-structure-hotel-flat.md`](../adr/0008-url-structure-hotel-flat.md)
- Skill responsive : [`.cursor/skills/responsive-ui-architecture/SKILL.md`](../../.cursor/skills/responsive-ui-architecture/SKILL.md)
- Skill parité : [`.cursor/skills/booking-parity-ux/SKILL.md`](../../.cursor/skills/booking-parity-ux/SKILL.md)
