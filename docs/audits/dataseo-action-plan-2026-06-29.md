# Plan d'action DataSEO — fiches hôtel + classements

**Date** : 2026-06-29  
**Source opérationnelle** :
`scripts/editorial-pilot/runs/dataseo-actions-unified-2026-06-29T16-58-13-925Z.md`  
**Périmètre audité** : 100 fiches hôtel + 100 classements, lecture seule.  
**Objectif PO** : identifier précisément ce qu'il faut **modifier**, **créer**
ou **retirer** sur chaque fiche hôtel et chaque classement, puis exécuter les
corrections par vagues contrôlées.

## 1. Synthèse exécutive

La vague DataSEO officielle a produit une matrice de 200 entités :

| Surface      | Volume audité | Actions à modifier |   Actions à créer | Actions à retirer |
| ------------ | ------------: | -----------------: | ----------------: | ----------------: |
| Fiches hôtel |           100 |  inclus dans total | inclus dans total | inclus dans total |
| Classements  |           100 |  inclus dans total | inclus dans total | inclus dans total |
| **Total**    |       **200** |            **224** |           **162** |           **110** |

Signal SEO exploitable : **1705 PAA utiles** après filtrage du bruit.

Lecture PM :

1. Le chantier le plus urgent n'est pas de produire plus de texte, mais de
   **nettoyer les erreurs à risque** : claims Palace non sourcés, meta titles
   cassés, FAQ avec langue mélangée, PAA bruitées, angles booking Phase 6.
2. Le deuxième levier est la **création de preuves** : sources EEAT, geo_qa,
   FAQ grounded, sections de classements, tableaux, photos/catégories.
3. Le troisième levier est la **mise à niveau SEO/GEO** : titles, H1, meta,
   factual summaries, PAA coverage, maillage vers classements/lieux.

## 2. Principes non négociables

### 2.1 Lecture seule avant correction

Le runner DataSEO reste le point d'entrée avant chaque vague :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit -- --hotel-limit=100 --ranking-limit=100 --concurrency=2
```

Smoke test avant toute modification du runner :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit:smoke
```

Les rapports d'audit ne modifient jamais Supabase. Les écritures doivent passer
par des runners de correction séparés, avec dry-run, logs et rollback possible.

### 2.2 Hiérarchie des décisions

1. Hard rules projet : sécurité, CSP, pas d'Offer/booking Phase 6, pas de PII,
   pas de scaffolding.
2. CDC fiche hôtel : parité template Airelles/Gordes, FAQ, photos, JSON-LD,
   Conseil du Concierge.
3. DataSEO : PAA, volumes, intent, related keywords.
4. Editorial : voix Concierge, concision, sources vérifiables.

Une recommandation DataSEO qui pousse vers prix live, disponibilité, refund,
paiement, promo ou urgence de stock est rejetée jusqu'à la Phase 6 booking.

### 2.3 Critères de sortie par entité

Une fiche ou un classement est considéré traité seulement si :

- `hasLeak()` passe sur tous les textes générés.
- `dfs_paa_coverage` est tracé quand une FAQ/geo_qa est régénérée.
- Les questions PAA bruitées sont retirées du contenu public.
- Les claims d'affiliation, Palace, Michelin, Forbes, R&C, LHW sont sourcés ou
  retirés.
- Les meta title/description sont dans les bandes projet.
- FR et EN sont cohérents.
- Les changements visibles sont relus dans le navigateur avant commit/push.

## 3. Backlog priorisé

### P0 — Nettoyage risque / conformité

À faire avant toute réécriture profonde.

| Famille                       | Pourquoi P0                     | Action                                                                 |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Claims `Palace` non confirmés | Risque factual + SEO trompeur   | Vérifier contre Atout France / source officielle, retirer ou qualifier |
| Meta title cassé              | Régression SERP visible         | Corriger pipes, titres incomplets, titres hors intention               |
| FAQ langue mélangée           | Mauvaise UX + signal faible GEO | Réécrire les questions FR/EN au bon endroit                            |
| PAA bruitées                  | Contenu hors cible              | Exclure célébrités, fortune, salaires, people, recrutement             |
| Angles Phase 6                | Hors phasage projet             | Retirer disponibilité, booking, paiement, refund, promo, prix live     |

Fiches top P0 visibles dans la vague :

- `the-berkeley`
- `hotel-de-russie-rocco-forte-collection`
- `25hours-hotel-dubai-one-central`
- `hotel-ritz-paris`
- `claridge-s-londres`
- `bulgari-roma`
- `burj-al-arab`
- `jumeirah-mina-a-salam`
- `trianon-palace-versailles-a-waldorf-astoria-hotel`
- `taj-lake-palace`

Classements P0 visibles dans la vague :

- `meilleurs-hotels-spa-paris-16`
- `meilleurs-palaces-paris-16`
- `plus-beaux-hotels-paris`
- `palaces-romantiques`
- `plus-beaux-hotels-5-etoiles-france`
- `top-small-luxury-hotels-antigua-et-barbuda`

### P1 — Création des preuves EEAT et SEO

Objectif : ne pas réécrire de faits avant d'avoir les sources.

| Famille                        | Action                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Sources EEAT < 2 ou < 3        | Ajouter official site, Wikidata/Wikipedia, Michelin/Forbes/R&C/LHW si applicable |
| External sources classements   | Ajouter sources éditoriales et institutionnelles                                 |
| Fiches avec marque forte       | Vérifier title/meta contre le top keyword DataSEO                                |
| Classements sans source solide | Ajouter source externe avant réécriture sectionnelle                             |

Ordre de traitement :

1. Fiches à gros volume marque : Ritz Paris, Claridge's, George V, Plaza, Le
   Meurice, Aman New York, The Ned.
2. Fiches Dubai/Londres/New York avec beaucoup d'avis Google mais sources faibles.
3. Classements `spa`, `palaces`, `plus-beaux`, `top-*` qui structurent le
   maillage.

### P2 — Création / régénération des blocs DataSEO-grounded

Objectif : répondre aux vraies questions, pas à des questions inventées.

| Bloc                 | Déclencheur                   | Action                                                   |
| -------------------- | ----------------------------- | -------------------------------------------------------- |
| `faq_content_kit`    | < 40 Q/R ou PAA non couvertes | Régénérer avec DataSEO + `dfs_paa_coverage`              |
| `geo_qa`             | < 3 réponses et PAA utiles    | Créer 3 Q/R GEO sans fallback LLM-only si PAA zéro       |
| `factual_summary_*`  | hors bande ou angle faible    | Réviser seulement si DataSEO apporte un fait exploitable |
| `meta_desc_*`        | hors bande                    | Réviser dans 140-170 caractères                          |
| Sections classements | < 6 ou angle faible           | Créer méthode, critères, quartiers, cas d'usage          |
| Tableaux classements | absent                        | Ajouter comparaison lisible                              |

Règle : une fiche sans PAA utile ne reçoit pas de `geo_qa` inventé. Elle reste
qualitative via description, sources, photos et FAQ canonique.

### P3 — Photos et catégories

Objectif : faire monter la qualité visible et l'intention image.

| Signal DataSEO                                | Action                                   |
| --------------------------------------------- | ---------------------------------------- |
| `photos`, `restaurant`, `spa`, `room`, `pool` | Prioriser les catégories manquantes      |
| Fiche < 10 photos                             | Sourcing prioritaire                     |
| Fiche < 30 photos                             | Backlog Phase 2 photo                    |
| Catégories < 5                                | Sourcing ciblé plutôt qu'ajout générique |
| Catégories < 10                               | Objectif CDC long terme                  |

Important : la décision projet reste écriture d'abord, photos ensuite. Ici les
photos sont planifiées et priorisées, pas traitées avant les P0/P1 texte.

### P4 — Classements face à Yonder

Objectif : battre Yonder sur structure + preuves + précision, pas copier son
format magazine.

Benchmark actuel :

- MCH gagne côté machine : JSON-LD, FAQPage, ItemList, hreflang, maillage.
- Yonder garde l'avance visible : justifications plus concrètes, photos mieux
  choisies, autorité/indexation.

Actions :

1. Réviser les meta descriptions des 100 classements audités hors bande.
2. Créer les sections manquantes : méthode, critères, quartiers, cas d'usage.
3. Ajouter sources EEAT sur les `top-*`, `palaces-*`, `plus-beaux-*`.
4. Retirer PAA bruitées et angles Phase 6.
5. Ajouter des preuves par hôtel dans les justifications : architecte, chambre à
   booker, table, spa, vue, accès, timing Concierge.
6. Vérifier EN pour les classements qui portent une intention internationale.

## 4. Plan d'exécution par vagues

### Vague 0 — Gel et outillage

Durée cible : 0,5 jour.

Objectif : fiabiliser le pipeline avant écritures.

Actions :

1. Garder le runner officiel comme source d'audit.
2. Ajouter si nécessaire un extracteur CSV/JSON des actions par famille :
   `claims`, `meta`, `faq_lang`, `eeat`, `photo`, `ranking_meta`,
   `ranking_sections`.
3. Vérifier que chaque runner d'écriture possède `--dry-run`, logs, liste de
   slugs et seuils de sécurité.

Sortie attendue :

- Un fichier de lot P0 hôtels.
- Un fichier de lot P0 classements.
- Un ordre d'exécution validé.

### Vague 1 — P0 hôtels, corrections déterministes

Durée cible : 1 jour.

Périmètre : top 30 hôtels du rapport.

Actions :

1. Corriger les meta titles cassés.
2. Corriger les FAQ FR/EN mélangées.
3. Retirer/qualifier les claims Palace non officiels.
4. Retirer les PAA bruitées des surfaces FAQ/geo_qa.
5. Ne pas régénérer de longs textes tant que les sources EEAT sont faibles.

Contrôles :

- `pnpm --filter @mch/editorial-pilot typecheck`
- audit DataSEO relancé sur les slugs traités
- spot-check page FR + EN pour les fiches modifiées

### Vague 2 — P0 classements, metadata et retrait bruit

Durée cible : 1 jour.

Périmètre : top 30 classements du rapport.

Actions :

1. Réviser `meta_desc_fr/en` hors bande.
2. Retirer PAA bruitées / Phase 6.
3. Vérifier H1/title contre top keyword quand DataSEO retourne un volume fort.
4. Ne pas changer les entrées classées manuellement.

Contrôles :

- pas de baisse `is_published`
- pas de modification des `editorial_ranking_entries` curated
- comparaison rapide avec Yonder sur les slugs stratégiques

### Vague 3 — EEAT hôtels + classements

Durée cible : 2 jours.

Actions hôtels :

1. Ajouter au moins 2 sources fiables aux fiches `eeat_sources_lt_2`.
2. Mapper official site / Wikidata / Wikipedia / Michelin / Forbes / R&C selon
   disponibilité.
3. Ne pas accepter de source OTA comme source officielle.

Actions classements :

1. Ajouter 3 sources minimum pour les classements `sources_lt_3`.
2. Privilégier sources institutionnelles et médias de référence.

Contrôles :

- pas de source toxique type squatter/OTA
- sources visibles ou agent-consumable selon surface
- pas de PII en logs

### Vague 4 — FAQ / GEO / sections DataSEO-grounded

Durée cible : 2 à 3 jours.

Actions hôtels :

1. Régénérer `faq_content_kit` si insuffisant ou mal aligné PAA.
2. Créer `geo_qa` seulement quand PAA utile existe.
3. Réviser factual summaries hors idéal quand un angle DataSEO utile existe.

Actions classements :

1. Créer sections manquantes.
2. Ajouter tableaux comparatifs absents.
3. Renforcer FAQ quand les PAA utiles existent.

Contrôles :

- `dfs_paa_coverage` logué
- `hasLeak()` obligatoire
- EN cohérent avec FR
- aucune question prix live / disponibilité / refund

### Vague 5 — Photos planifiées

Durée cible : backlog Phase 2, non bloquant pour P0 texte.

Actions :

1. Extraire les hôtels < 10 photos.
2. Extraire les hôtels < 30 photos.
3. Croiser avec DataSEO : spa, restaurant, chambre, piscine, vue, photos.
4. Prioriser les fiches à fort volume marque.

Sortie attendue :

- backlog photo catégorisé par hôtel
- catégories manquantes par fiche
- pas d'upload tant que la source n'est pas qualifiée

### Vague 6 — Re-audit, acceptation, commit

Durée cible : 0,5 jour par lot.

Actions :

1. Relancer le runner DataSEO sur les slugs traités.
2. Comparer avant/après : actions restantes, PAA utiles, erreurs retirées.
3. Marcher les pages modifiées FR + EN.
4. Vérifier que les changements visibles sont atteignables depuis les entrées
   réelles.
5. Commit seulement après acceptation visible.

## 5. Ordre conseillé des 10 premières fiches

1. `the-berkeley` — claim Palace + factual summary + photos + PAA bruitées.
2. `hotel-de-russie-rocco-forte-collection` — claim Palace + EEAT + photos.
3. `25hours-hotel-dubai-one-central` — meta title cassé + photos + PAA bruitées.
4. `hotel-ritz-paris` — claim Palace + top keyword très fort + photos.
5. `claridge-s-londres` — claim Palace + top keyword très fort + photos.
6. `bulgari-roma` — FAQ langue mélangée + top keyword prix à traiter sans prix
   live.
7. `burj-al-arab` — claim Palace + PAA bruitées + photos.
8. `four-seasons-hotel-george-v` — title/meta contre top keyword + photos.
9. `the-plaza-hotel` — claim Palace + top keyword + photos.
10. `le-meurice` — renforcer restaurant/tea time/dress code sans booking live.

## 6. Ordre conseillé des 10 premiers classements

1. `meilleurs-hotels-spa-nice`
2. `meilleurs-hotels-spa-paris-1`
3. `meilleurs-hotels-spa-paris-16`
4. `meilleurs-hotels-spa-paris-8`
5. `meilleurs-hotels-spa-rome`
6. `meilleurs-hotels-spa-venise`
7. `meilleurs-hotels-urbains-paris-1`
8. `meilleurs-hotels-urbains-paris-7`
9. `meilleurs-hotels-urbains-paris-8`
10. `meilleurs-hotels-urbains-paris-9`

Action commune : réviser les meta descriptions dans la bande 140-170, puis
traiter les retraits PAA/Phase 6 quand le rapport les signale.

## 7. Commandes de pilotage

Audit complet récurrent :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit -- --hotel-limit=100 --ranking-limit=100 --concurrency=2
```

Audit hôtels uniquement :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit:hotels -- --hotel-limit=100 --concurrency=2
```

Audit classements uniquement :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit:rankings -- --ranking-limit=100 --concurrency=2
```

Audit smoke :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit:smoke
```

Contrôles de base :

```bash
pnpm --filter @mch/editorial-pilot typecheck
git diff --check
```

## 8. Gouvernance PM

### Cadence

- 1 vague audit DataSEO par jour de production active.
- 1 vague correction courte, limitée à 20-30 entités.
- 1 re-audit après chaque vague.
- Aucun gros push sans rapport avant/après.

### Rôles

| Rôle                | Responsabilité                                      |
| ------------------- | --------------------------------------------------- |
| PM / chef de projet | Priorise les vagues, bloque les hors-phase          |
| Éditorial           | Réécrit titres, FAQ, sections, Conseil du Concierge |
| SEO/GEO             | Valide PAA, metadata, maillage, Yonder gap          |
| Data/EEAT           | Ajoute sources, vérifie affiliations                |
| Photo               | Planifie catégories et sourcing                     |
| QA                  | Walkthrough FR/EN, mobile/desktop si layout touché  |

### Stop conditions

Arrêter la vague si :

- DataSEO renvoie une erreur API répétée.
- Le taux de PAA utiles tombe à zéro sur une famille entière.
- Un runner tente d'écrire sans dry-run préalable.
- Un contenu généré réintroduit scaffolding/meta-commentary.
- Une correction touche booking/prix live.

## 9. Livrables attendus par vague

Chaque vague doit produire :

1. Rapport DataSEO avant correction.
2. Liste des slugs traités.
3. Journal des champs modifiés.
4. Rapport DataSEO après correction.
5. Résumé des actions restantes.
6. Preuve d'acceptation visible pour les changements user-facing.

## 10. Prochaines décisions

Décision recommandée : lancer **Vague 1 P0 hôtels** sur les 10 premières fiches,
en corrections déterministes uniquement.

Pourquoi :

- Elles concentrent les risques les plus visibles.
- Elles couvrent Londres, Paris, Rome, Dubaï, New York.
- Elles mélangent tous les cas de correction : claim, meta, FAQ langue, photos,
  PAA bruitées.
- Elles créent le modèle d'exécution pour les 90 fiches suivantes.

Après Vague 1, relancer :

```bash
pnpm --filter @mch/editorial-pilot dataseo:audit -- --scope=hotels --hotel-limit=30 --concurrency=2
```

Puis décider si la vague suivante est :

- P0 classements metadata ;
- EEAT hôtels ;
- FAQ/geo_qa grounded ;
- photo backlog.
