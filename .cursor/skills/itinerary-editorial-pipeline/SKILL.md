---
name: itinerary-editorial-pipeline
description: >-
  Pipeline de génération de contenu pour les pages itinéraires SEO/GEO de
  MyConciergeHotel.com. Use when working on /itineraire routes, seeding
  itinerary content, generating AEO blocks or sections for itineraries, or
  configuring the bidirectional internal-linking mesh between itineraries,
  hotels, rankings, and destination guides.
---

# Skill : itinerary-editorial-pipeline

Génère des pages itinéraires 5★ optimisées simultanément pour Google SEO,
les LLM (GEO), et la conversion vers les fiches hôtels réservables du catalogue.

## Triggers

Invoquer quand :

- Travail sur `apps/web/src/app/**/itineraire*/**`
- Seed SQL d'itinéraires dans `scripts/editorial-pilot/itineraries/`
- Génération de `aeo_question/answer`, `sections`, `faq_content` pour la table `itineraries`
- Configuration du maillage bidirectionnel itinéraires ↔ hôtels ↔ classements ↔ guides
- Ajout des skills `get-itinerary` / `list-itineraries` dans `agent-skills.ts`

---

## Rule 1 — Voix éditoriale Concierge

Se référer à `.cursor/rules/editorial-voice.mdc` + `EDITORIAL_VOICE.md`. Résumé :

- **Expert complice** — pas journaliste, pas vendeur. Insider partageant des secrets opérationnels.
- **Jamais de superlatifs vides** : `magnifique`, `incroyable`, `sublime` → remplacer par des faits mesurables ("à 3 min à pied du Colisée", "spa primé Forbes Travel Guide").
- **Phrases ≤ 25 mots** (cf. C2 `editorial-voice.mdc`).
- **Fraîcheur** : mentionner saison + événements locaux si pertinent.
- **Concision opérationnelle** : chaque étape = durée conseillée + 1 POI nommé + 1 hôtel recommandé (si catalogue).

---

## Rule 2 — Pipeline en 6 passes

### Passe 1 — Brief destination

Requêtes Supabase avant génération :

```sql
-- Hôtels disponibles pour la destination
select id, slug, name, city, region, booking_mode, priority
from public.hotels
where is_published = true
  and booking_mode != 'display_only'
  and (city ilike $dest or region ilike $dest or destination_country ilike $dest);

-- Guides existants à lier
select slug_fr, title_fr from public.editorial_guides
where scope = 'country' and destination_country = $country and is_published = true;

-- Classements existants à lier
select slug, title_fr from public.editorial_rankings
where is_published = true and (destination_tags @> array[$dest]);

-- Itinéraires existants (anti-cannibalisation)
select slug_fr, title_fr from public.itineraries
where status = 'published' and destination_country = $country;
```

### Passe 2 — Slug & Meta

```
slug_fr   → [destination]-[style]-[durée-jours]  ex: paris-luxe-3-jours
slug_en   → [destination]-[style]-[duration]      ex: paris-luxury-3-days
meta_title_fr → "Itinéraire [Destination] [Durée] — Palaces & Hôtels 5★ | MyConciergeHotel"
meta_desc_fr  → 140-160 chars, inclure destination + durée + 1 USP
```

### Passe 3 — AEO Block FR

- **Question** : "Quel est le meilleur itinéraire pour [destination] en [N] jours ?"
- **Réponse** : 40-80 mots validés par `buildAeoBlock`
- Format : affirmation directe → 2-3 étapes clés → 1 hôtel nommé → signal fraîcheur
- Exemple (58 mots) : _"Pour 14 jours au Japon, votre Concierge recommande Tokyo (4 nuits, Aman Tokyo, quartier Otemachi) puis Kyoto (4 nuits, Park Hyatt Kyoto, colline Higashiyama) avant Hakone (2 nuits, vue Fuji). Incontournables : Asakusa, Arashiyama en tuk-tuk, kaiseki au Kikunoi. Période idéale : avril (cerisiers) ou novembre (momiji). Mis à jour mai 2026."_

### Passe 4 — AEO Block EN

- **Ne pas traduire littéralement** le bloc FR — ajouter 1 détail opérationnel unique EN
  (chambre alternative, fenêtre saisonnière, variante d'étape, fallback restaurant)
- Même contrainte 40-80 mots `buildAeoBlock`
- Cf. rule 10 `concierge-voice-pipeline` (patch anti-traduction littérale, +14 mots médians)

### Passe 5 — Sections (corps JSONB)

```json
[
  {
    "step": 1,
    "title_fr": "Jour 1-2 : Tokyo — Immersion dans la mégapole",
    "title_en": "Day 1-2: Tokyo — Immersion in the megacity",
    "body_fr": "[>= 150 mots, voix Concierge, POIs nommés, conseil pratique]",
    "body_en": "[>= 150 mots, PAS une traduction littérale]",
    "hotel_id": "uuid-aman-tokyo",
    "duration_days": 2,
    "city": "Tokyo",
    "poi": ["Senso-ji", "Shibuya Crossing", "TeamLab Borderless"]
  }
]
```

Contraintes :

- `body_fr` ≥ 150 mots, `body_en` ≥ 150 mots
- ≥ 1 POI réel nommé par step
- Si `hotel_id` présent : nommer l'hôtel + 1 USP concrète dans le body
- **Jamais coller `description_fr` de la fiche hôtel** — contextualiser uniquement

### Passe 6 — FAQ (8-15 Q&A)

Couvrir obligatoirement :

1. "Quelle est la meilleure période pour visiter [destination] ?"
2. "Combien de jours faut-il pour [destination] ?"
3. "Quel hôtel 5★ choisir pour un itinéraire [destination] ?"
4. "Quel est le budget pour un itinéraire luxe à [destination] ?"
5. "Comment se déplacer pendant un itinéraire [destination] ?"
6. "[Destination] en famille : itinéraire adapté ?"
7. "Y a-t-il des événements saisonniers à prévoir ?"
8. "MyConciergeHotel sélectionne quels hôtels pour [destination] ?"

Format : `a_fr` = 50-100 mots (plus dense que AEO, optimisé LLM citation verbatim).

---

## Rule 3 — Critères de sélection des hôtels

1. `is_published = true` dans `public.hotels`
2. Localisation cohérente avec l'étape (même ville ou région)
3. Priorité : P0 > P1 > P2
4. `booking_mode != 'display_only'` (préférer Amadeus ou Little → conversion)
5. Diversité : 1 Palace + 1-2 hôtels 5★ par itinéraire
6. **Maximum 1 hôtel par étape géographique**

---

## Rule 4 — Contrat de maillage bidirectionnel

```
Itinéraire [slug]
  ↓ (liens sortants — dans la page)
  ├── /hotel/[slug] × N       (1 par étape, via <ItineraryHotelCard>)
  ├── /classement/[slug] × ≥ 2 (via <RelatedRankings>, related_ranking_ids[])
  ├── /guide/[slug] × ≥ 1     (via <RelatedGuides>, related_guide_slugs[])
  └── /itineraire/[slug] × ≥ 2 (via <RelatedItineraries>, related_itinerary_slugs[])

  ↑ (liens entrants — à déclencher post-publish)
  ├── /guide/[destination-slug] → ajouter bloc "Nos itinéraires pour [Pays]"
  └── /hotel/[slug]            → widget "Cet hôtel dans nos itinéraires" si hotel_id présent
```

Vérifier après chaque seed :

```ts
assert(itinerary.related_ranking_ids.length >= 2, 'Min 2 classements liés');
assert(itinerary.related_guide_slugs.length >= 1, 'Min 1 guide lié');
assert(itinerary.related_itinerary_slugs.length >= 2, 'Min 2 itinéraires similaires');
```

---

## Rule 5 — Longue traîne FAQ à couvrir

| Catégorie   | Patterns à couvrir                                                                |
| ----------- | --------------------------------------------------------------------------------- |
| Durée       | "[N] jours [destination] suffisant", "combien de temps [destination]"             |
| Hébergement | "meilleur hôtel luxe [destination] itinéraire", "palace [destination] bien situé" |
| Style       | "[destination] lune de miel", "[destination] en famille", "[destination] solo"    |
| Saison      | "[destination] [mois] météo", "éviter [destination] en [période]"                 |
| Budget      | "itinéraire [destination] luxe budget", "prix séjour [destination] 5 étoiles"     |
| Logistique  | "se déplacer [destination]", "transports [destination]"                           |

---

## Anti-patterns

| Erreur                                    | Impact                                        | Fix                                                                          |
| ----------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Traduire littéralement FR → EN sur AEO    | EN < 40 mots → rejeté `buildAeoBlock`         | Ajouter 1 détail opérationnel unique EN (rule 10 `concierge-voice-pipeline`) |
| Coller `description_fr` de la fiche hôtel | Contenu dupliqué → pénalité SEO               | Contextualiser uniquement, ≥ 50 mots originaux                               |
| `hotel_ids[]` avec hôtels `display_only`  | 0 CTA réservation = 0 conversion              | Filtrer `booking_mode != 'display_only'`                                     |
| AEO > 80 mots                             | Rejeté par `buildAeoBlock` → build crash      | Compter avant de shipper                                                     |
| `unstable_cache` retournant un `Map`      | 500 sur cache hit (cf. hotfix 4d02187)        | Retourner `Record<string, …>` uniquement                                     |
| Sections sans POI nommé                   | Contenu vague → non cité par LLM              | ≥ 1 POI nommé par step                                                       |
| 0 lien entrant depuis guides/classements  | Island de maillage → SEO faible               | Déclencher mise à jour guides post-publish                                   |
| AEO answer sans signal de fraîcheur       | LLM ne cite pas la date → perd en crédibilité | Inclure "Mis à jour [mois année]"                                            |

---

## Checklist audit post-génération

```
PASS si :
  ✓ aeo_answer_fr word count ∈ [40, 80]
  ✓ aeo_answer_en word count ∈ [40, 80]
  ✓ sections[].body_fr word count ≥ 150 (tous)
  ✓ sections[].hotel_id résout un hôtel is_published = true (si non-null)
  ✓ related_ranking_ids.length ≥ 2
  ✓ related_guide_slugs.length ≥ 1
  ✓ related_itinerary_slugs.length ≥ 2
  ✓ faq_content.length ≥ 8
  ✓ meta_desc_fr.length ∈ [140, 160]
  ✓ slug_fr ~ /^[a-z0-9]+(?:-[a-z0-9]+)*$/

NEEDS_REGEN si :
  ✗ aeo_answer word count < 40 ou > 80
  ✗ body_fr < 150 mots sur ≥ 1 step
  ✗ 0 hotel_id résolvable dans le catalogue
  ✗ related_ranking_ids.length < 2
  ✗ faq_content.length < 8
```

---

## References

- `.cursor/rules/itinerary-page.mdc` — règles Next.js, maillage, checklist PR
- `.cursor/rules/seo-geo.mdc` — règles SEO/GEO transversales (AEO, llms.txt, JSON-LD)
- `.cursor/rules/editorial-voice.mdc` + `EDITORIAL_VOICE.md` — voix Concierge
- `.cursor/skills/concierge-voice-pipeline/SKILL.md` — pipeline 8 passes, rule 10 anti-traduction EN
- `.cursor/skills/geo-llm-optimization/SKILL.md` — stratégie GEO complète
- `.cursor/skills/structured-data-schema-org/SKILL.md` — JSON-LD rules
- `.cursor/skills/llm-output-robustness/SKILL.md` — multi-call pipelines, schema drift
- `packages/seo/src/jsonld/howto.ts` — builder HowTo (réutiliser tel quel)
- `packages/seo/src/aeo.ts` — `buildAeoBlock` (40-80 mots, Zod validé)
- `docs/cdc-itineraires.md` — spec complète avec migration SQL, matrice 50 itinéraires P0/P1
