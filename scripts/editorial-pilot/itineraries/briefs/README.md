# Briefs P0 Itinéraires — MyConciergeHotel

Ce dossier contient les 20 briefs JSON correspondant aux itinéraires de priorité P0 définis dans le Sprint 4 du plan d'intégration [`docs/itineraires-integration-plan.md`](../../../../docs/itineraires-integration-plan.md) et dans le cahier des charges [`docs/cdc-itineraires.md`](../../../../docs/cdc-itineraires.md) §7.

Ces briefs sont les **inputs** du pipeline de génération de contenu GPT-4o. Ils ne contiennent pas de contenu éditorial final — uniquement des indications structurées que le pipeline transforme en pages publiables.

---

## Structure d'un brief

Chaque fichier JSON suit ce schéma :

| Champ                                     | Type    | Description                                                                                                                     |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `slug_fr`                                 | string  | Slug URL français (kebab-case)                                                                                                  |
| `slug_en`                                 | string  | Slug URL anglais (kebab-case)                                                                                                   |
| `priority`                                | string  | Niveau de priorité (`P0`, `P1`…)                                                                                                |
| `destination_country`                     | string  | Pays de destination                                                                                                             |
| `destination_region`                      | string  | Région ou état                                                                                                                  |
| `destination_city`                        | string  | Ville(s) couverte(s)                                                                                                            |
| `themes`                                  | array   | Thématiques : `luxe`, `culture`, `gastronomie`, `mer`, `ski`, `bien-etre`, `couple`, `aventure`, `nature`, `vignobles`, `train` |
| `duration_min_days` / `duration_max_days` | integer | Durée du séjour                                                                                                                 |
| `travel_style`                            | string  | Style dominant (`luxe`, `culture`, `aventure`…)                                                                                 |
| `season`                                  | string  | Saison recommandée ou `toute-saison`                                                                                            |
| `target_word_count`                       | integer | Nombre de mots cible pour le contenu généré                                                                                     |
| `meta_title_fr_hint`                      | string  | Suggestion de balise `<title>` FR                                                                                               |
| `meta_desc_fr_hint`                       | string  | Suggestion de meta description FR (≤155 car.)                                                                                   |
| `hotel_slugs_target`                      | array   | Slugs des hôtels à intégrer (matching table `hotels`)                                                                           |
| `hotel_fallback_note`                     | string  | Règle de fallback si hôtels cibles absents en DB                                                                                |
| `related_guide_slugs_target`              | array   | Guides de destination liés                                                                                                      |
| `related_ranking_slugs_target`            | array   | Classements liés                                                                                                                |
| `related_itinerary_slugs_target`          | array   | Itinéraires croisés pour le maillage interne                                                                                    |
| `steps_outline`                           | array   | Découpage en étapes (2 à 6 steps)                                                                                               |
| `steps_outline[].step`                    | integer | Numéro d'étape                                                                                                                  |
| `steps_outline[].duration_days`           | integer | Durée de l'étape en jours                                                                                                       |
| `steps_outline[].city`                    | string  | Ville ou zone de l'étape                                                                                                        |
| `steps_outline[].hotel_slug_hint`         | string  | Hôtel recommandé pour cette étape                                                                                               |
| `steps_outline[].key_pois`                | array   | Points d'intérêt nommés                                                                                                         |
| `steps_outline[].step_angle`              | string  | Angle éditorial opérationnel de l'étape                                                                                         |
| `steps_outline[].title_fr_hint`           | string  | Suggestion de titre FR pour l'étape                                                                                             |
| `steps_outline[].title_en_hint`           | string  | Suggestion de titre EN pour l'étape                                                                                             |
| `aeo_question_fr_hint`                    | string  | Question AEO principale (featured snippet)                                                                                      |
| `aeo_answer_fr_hint`                      | string  | Réponse AEO 40-80 mots, terminée par "Mis à jour mai 2026."                                                                     |
| `faq_questions_to_cover`                  | array   | 8 à 12 questions FAQ à traiter dans l'article                                                                                   |
| `concierge_secret_hint`                   | string  | Conseil opérationnel propriétaire (chambre, table, timing)                                                                      |
| `anti_cannibalisation_notes`              | string  | Angle unique vs guides/classements existants                                                                                    |
| `sources_to_cite`                         | array   | 2-4 sources fiables à citer dans l'article                                                                                      |

---

## Les 20 itinéraires P0

### France (10 itinéraires)

| #   | Fichier                                       | Destination                                 | Durée    | Style                 | Saison              |
| --- | --------------------------------------------- | ------------------------------------------- | -------- | --------------------- | ------------------- |
| 1   | `paris-luxe-3-jours.json`                     | Paris                                       | 3 jours  | Luxe                  | Toute saison        |
| 2   | `cote-d-azur-luxe-7-jours.json`               | Cannes, Cap Ferrat, Èze, Monaco             | 7 jours  | Luxe                  | Été                 |
| 3   | `provence-culture-gastronomie-10-jours.json`  | Aix-en-Provence, Les Baux, Avignon, Lubéron | 10 jours | Gastronomie & culture | Printemps / Automne |
| 4   | `bordeaux-vignobles-gastronomie-5-jours.json` | Bordeaux, Saint-Émilion, Sauternes, Médoc   | 5 jours  | Gastronomie           | Automne (vendanges) |
| 5   | `megeve-ski-luxe-5-jours.json`                | Megève                                      | 5 jours  | Ski luxe              | Hiver               |
| 6   | `saint-tropez-ete-5-jours.json`               | Saint-Tropez                                | 5 jours  | Luxe balnéaire        | Été                 |
| 7   | `reims-champagne-week-end.json`               | Reims, Épernay, Hautvillers                 | 2 jours  | Gastronomie           | Toute saison        |
| 8   | `paris-lune-de-miel.json`                     | Paris                                       | 4 jours  | Luxe couple           | Toute saison        |
| 9   | `lyon-gastronomie-3-jours.json`               | Lyon                                        | 3 jours  | Gastronomie           | Toute saison        |
| 10  | `biarritz-pays-basque-5-jours.json`           | Biarritz, Saint-Jean-de-Luz, San Sebastian  | 5 jours  | Culture & mer         | Été / Automne       |

### International (10 itinéraires)

| #   | Fichier                                  | Destination                               | Durée    | Style              | Saison              |
| --- | ---------------------------------------- | ----------------------------------------- | -------- | ------------------ | ------------------- |
| 11  | `japon-culture-2-semaines.json`          | Tokyo, Kyoto, Hakone, Hiroshima, Naoshima | 14 jours | Culture            | Printemps / Automne |
| 12  | `japon-luxe-7-jours.json`                | Tokyo, Kyoto, Hakone                      | 7 jours  | Luxe               | Printemps           |
| 13  | `bali-lune-de-miel-10-jours.json`        | Ubud, Jimbaran, Nusa Dua                  | 10 jours | Couple & bien-être | Avril–Octobre       |
| 14  | `maldives-luxe-7-jours.json`             | Atolls Noonu, Baa, Nord Malé              | 7 jours  | Luxe couple & mer  | Novembre–Avril      |
| 15  | `toscane-gastronomie-7-jours.json`       | Florence, Chianti, Val d'Orcia, Sienne    | 7 jours  | Gastronomie        | Printemps / Automne |
| 16  | `maroc-culture-10-jours.json`            | Marrakech, Fès, Merzouga, Essaouira       | 10 jours | Culture & luxe     | Automne / Printemps |
| 17  | `safari-kenya-afrique-du-sud.json`       | Masai Mara, Sabi Sands, Cape Town         | 12 jours | Aventure & nature  | Juin–Octobre        |
| 18  | `new-york-luxe-5-jours.json`             | New York                                  | 5 jours  | Luxe & culture     | Automne / Printemps |
| 19  | `dubai-luxe-week-end.json`               | Dubaï                                     | 3 jours  | Luxe & désert      | Novembre–Mars       |
| 20  | `train-orient-express-paris-venise.json` | Paris → Venise                            | 5 jours  | Luxe & train       | Printemps / Automne |

---

## Lancer le pipeline de génération

Le pipeline de génération de contenu utilise chaque brief JSON comme input pour produire un article itinéraire complet (FR + EN), insérer les hôtels en base, et générer le balisage SEO/AEO.

**Commande :**

```bash
node scripts/editorial-pilot/itineraries/generate-itinerary.mjs --brief <slug>
```

**Exemples :**

```bash
# Générer l'itinéraire Japon 7 jours luxe
node scripts/editorial-pilot/itineraries/generate-itinerary.mjs --brief japon-luxe-7-jours

# Générer tous les P0
node scripts/editorial-pilot/itineraries/generate-itinerary.mjs --all-p0

# Générer en dry-run (sans écriture en base)
node scripts/editorial-pilot/itineraries/generate-itinerary.mjs --brief paris-luxe-3-jours --dry-run
```

**Options disponibles (preview) :**

| Option                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `--brief <slug>`        | Slug du brief JSON à traiter                     |
| `--all-p0`              | Traite tous les briefs de priorité `P0`          |
| `--dry-run`             | Génère le contenu sans écriture en base Supabase |
| `--lang <fr\|en\|both>` | Langue(s) cible (défaut : `both`)                |
| `--force`               | Écrase une page existante même si déjà publiée   |

**Prérequis :**

- Variables d'environnement : `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Table `hotels` peuplée avec au minimum les hôtels P0 (ou fallback actif)
- Payload CMS configuré pour les collections `itineraries`

---

## Référence Sprint 4

Ces briefs correspondent au **Sprint 4** du plan d'intégration `docs/itineraires-integration-plan.md` :

- Sprint 4 — Génération contenu P0 (20 itinéraires)
- Entrée : fichiers JSON `briefs/`
- Sortie : pages publiées dans Payload CMS + entrées Supabase table `itineraries`
- Validation : score SEO ≥ 80, mot count ≥ `target_word_count`, AEO answer présente

Pour toute question sur le schéma ou le pipeline, consulter le CDC `docs/cdc-itineraires.md` §7 (structure des briefs) et §8 (catégories FAQ).
