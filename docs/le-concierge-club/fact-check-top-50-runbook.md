# Fact-check humain — Top 50 hôtels stratégiques

**Statut**: Runbook Sprint 4 — Le Concierge Club.
**Owner**: Éditorial + Conformité.
**Outils**: Payload back-office (`_editorial_review_status`), Tavily, Google
Search, sources éditeur (Guide Michelin, Forbes Travel Guide,
Atout France, Relais & Châteaux).

Ce runbook décrit le **processus de fact-check humain** appliqué aux
50 hôtels stratégiques (palaces parisiens, Relais & Châteaux, gros
volume SEA prévisible) avant l'ouverture publique de la phase 1 du
Concierge Club. Ces fiches portent le poids du programme : 80% du trafic
SEA + 60% du trafic organique sur le premier trimestre.

## 1. Sélection des 50 hôtels

La liste est extraite par SQL dans Supabase. Les critères, ordonnés :

1. `priority = 'P0'` (top 20 éditoriaux).
2. `is_palace = true` + `country_code = 'FR'` (palaces parisiens et provinces).
3. `luxury_tier IN ('relais_chateaux', 'leading_hotels_world', 'oetker',
'rosewood', 'four_seasons')`.
4. SEA brief : top 30 en volume de recherche estimé (Semrush + Ahrefs).

Snapshot produit par :

```sql
WITH p0 AS (
  SELECT id FROM hotels WHERE priority = 'P0' AND published = true LIMIT 20
),
palaces AS (
  SELECT id FROM hotels
  WHERE is_palace = true AND country_code = 'FR' AND published = true
  ORDER BY editorial_score DESC LIMIT 20
),
luxury AS (
  SELECT id FROM hotels
  WHERE luxury_tier IN ('relais_chateaux','leading_hotels_world','oetker','rosewood','four_seasons')
    AND country_code = 'FR' AND published = true
  ORDER BY editorial_score DESC LIMIT 20
)
SELECT DISTINCT id FROM (
  SELECT id FROM p0
  UNION SELECT id FROM palaces
  UNION SELECT id FROM luxury
) t LIMIT 50;
```

Liste exportée puis collée dans la colonne A de
`docs/le-concierge-club/fact-check-top-50-tracker.csv` (gitignored —
contient des données opérationnelles internes).

## 2. Périmètre du fact-check par fiche

Pour chaque hôtel, valider **5 dimensions** (script ci-dessous). Une
dimension non conforme bloque la promotion `_editorial_review_status →
approved` jusqu'à correction.

### Dimension 1 — Identité légale et géographie (Atout France)

- Vérifier le nom officiel de l'hôtel via le registre Atout France
  (`https://www.classement.atout-france.fr`). Toute mention "Palace"
  doit correspondre à la distinction réelle (jamais plus de 32 hôtels
  classés Palace en France).
- Vérifier le nombre d'étoiles (`stars`) sur le même registre.
- Vérifier la commune + le code postal.
- Vérifier les coordonnées GPS (`lat`, `lng`) via Google Maps : marge
  d'erreur < 50 m.

### Dimension 2 — Distinctions externes (Michelin, Forbes, R&C)

- Étoiles Michelin restaurant : croiser avec
  `https://guide.michelin.com/fr/fr/restaurants` (toujours préciser
  l'année — Michelin est annuelle).
- Forbes Travel Guide rating : croiser avec
  `https://www.forbestravelguide.com/award-winners` (5-Star /
  4-Star).
- Relais & Châteaux : croiser avec `https://www.relaischateaux.com`
  - vérifier l'année d'adhésion.
- Pour chaque distinction emise en JSON-LD ou dans le copy : `verified
= true` dans Payload + champ `source_url` rempli.

### Dimension 3 — Conseil enrichi (`conseil_enrichi`)

- Lire le `body_fr` du JSON `conseil_enrichi` (200-300 mots).
- Vérifier que chaque mention factuelle est sourçable :
  - Numéro de chambre signature → croiser avec le site officiel de
    l'hôtel + une source secondaire (article presse récent).
  - Restaurant nommé → croiser avec Guide Michelin ou TheFork.
  - Distance / accès → croiser avec Google Maps (en heures de pointe).
- Pas de mention fabriquée. Si une affirmation n'est pas vérifiable
  en < 5 min, marquer le champ `_editorial_review_status =
needs_correction` et signaler dans le tracker CSV.

### Dimension 4 — Sections quartier / gastronomie / timing-accès

- `quartier_concierge` (200-300 mots) : 3-5 adresses nommées
  vérifiables (commerces, restaurants, monuments). Aucun pluriel
  vague type "des restaurants". Toujours nominer.
- `gastronomie_concierge` (200-300 mots) : étoiles Michelin
  sourçables, mention année. Pas de Bib Gourmand confondu avec une
  étoile.
- `timing_acces_concierge` (150-200 mots) : timings réalistes
  (transferts aéroport, check-in tardif, navette gare). Croiser
  avec les pages "Plan your visit" du site officiel.

### Dimension 5 — Voix Concierge (ADR-0011)

- Phrases ≤ 25 mots (audit visuel ; outil de comptage disponible
  dans Sprint 5 via `scripts/editorial-pilot/src/utils/sentence-length-audit.ts`).
- Aucun superlatif générique de la liste banned (`incroyable`,
  `magnifique`, `exceptionnel` sauf Atout France, `magique`, `sublime`)
  — voir `docs/editorial/style-guide.md` §4-5.
- Subject lines / titres : aucune urgence fabriquée.
- Cohérence FR ↔ EN : les chiffres, adresses, distances doivent être
  rigoureusement identiques. Pas de traduction littérale.

## 3. Workflow Payload

1. Ouvrir la fiche dans `apps/admin` → `Hotels` → filtrer
   `_editorial_review_status = pending`.
2. Reviewer la section dans cet ordre :
   - `factual_summary_fr/en`
   - `description_fr/en`
   - `policies` (CDC §2.9)
   - `conseil_enrichi`, `quartier_concierge`, `gastronomie_concierge`,
     `timing_acces_concierge`
   - `faq_content` (≥ 10 Q&A — voir Hard rule 10 dans
     `hotel-detail-page.mdc`).
3. Cocher les checkboxes audit dans le panel "Review log" (à
   instrumenter Sprint 4.2). À défaut, écrire un commentaire texte
   `[YYYY-MM-DD][initiales] OK` dans le champ `editorial_notes`.
4. Passer `_editorial_review_status → approved` quand toutes les
   dimensions sont validées.
5. Mettre à jour le tracker CSV (colonnes : `hotel_id`, `slug`,
   `reviewer`, `validated_at`, `dimensions_passed`, `blocker`).

## 4. Gate Go/No-Go (Sprint 4 livrable)

Pré-conditions pour ouvrir le programme au trafic SEA :

- [ ] ≥ 40 des 50 hôtels passés en `_editorial_review_status = approved`.
- [ ] 100% des hôtels en P0 validés (top 20 — sinon retarder la SEA P0).
- [ ] 0 erreur factuelle bloquante restante dans le tracker (colonne
      `blocker = null`).
- [ ] 100% des `awards` JSON-LD : `verified = true`.
- [ ] Sample audit qualité 10% des 443 hôtels publiés (sprint 3a
      playbook).
- [ ] Sample audit visuel rendu page (chrome desktop + Safari iOS) sur
      les 50 hôtels — pas de placeholder, pas de section vide.

Si l'un des items est rouge, l'équipe SEA bloque le lancement
campagne 1 (`Search Brand`) jusqu'à correction. La campagne 4
(`YouTube Demand Gen`) peut démarrer en parallèle puisqu'elle
n'enverra que sur le canonical `/le-concierge-club` (page éditoriale
sans dépendance hôtel).

## 5. Post-go-live — fact-check incrémental

- Pendant les 8 premières semaines : audit hebdomadaire de 5 hôtels
  tirés au sort dans le top 50.
- Si un membre du Concierge remonte une incohérence (formulaire de
  contact, WhatsApp Concierge Phase 6, email réponse à la newsletter),
  ticket Linear `[FACTCHECK]` créé sous 4 heures ouvrées.
- Re-fact-check complet annuel sur la base du calendrier éditorial
  Atout France + Michelin (publications janvier-février).

## 6. Outils et raccourcis

- **Tavily** (`packages/integrations/tavily`) — pré-charge la liste
  des distinctions et des actualités. Utile pour le fact-check
  dimension 2 mais ne remplace pas la source officielle.
- **Sentry custom event** : `editorial.factcheck.completed` (Sprint 5)
  — capte chaque transition `pending → approved` avec metadata
  `hotel_id`, `reviewer_email`, `duration_min`.
- **Linear template** : `Fact-check Top 50 — hotel <slug>` (à créer
  par l'éditorial).

## Références

- `.cursor/skills/concierge-voice-pipeline/SKILL.md`
- `.cursor/skills/content-enrichment-pipeline/SKILL.md`
- `.cursor/rules/hotel-detail-page.mdc` (Hard rules 9-16)
- `docs/editorial/style-guide.md` §4-5 (banned lexicon)
- ADR-0011 — voix Concierge.
