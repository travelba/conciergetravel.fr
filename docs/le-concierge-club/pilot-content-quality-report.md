# Sprint 2.5 — Pilot Le Concierge Club : qualité contenu

**Statut** : ⏳ À exécuter avant le go Sprint 3a (génération massive).
**Owner** : éditorial + concierge voix.
**Date prévue de gate** : à compléter par le copilote au moment du run.

---

## 1. Objectif

Valider que les 4 nouveaux passes LLM (`conseil_enrichi`, `quartier_concierge`,
`gastronomie_concierge`, `timing_acces_concierge`) produisent un contenu
publishable **sans réécriture systématique** sur un échantillon
représentatif. Si le pilote échoue (score < 80 % sur ≥ 2 axes), itérer les
prompts AVANT de lancer Sprint 3a sur les 443 hôtels publiés.

> Ce document est le **livrable de gate** : Sprint 3a ne démarre qu'après
> avoir coché la conclusion en bas du fichier.

---

## 2. Échantillon (5-10 hôtels, à compléter avant run)

L'échantillon doit couvrir au moins **3 typologies** pour exposer les
failures-modes propres à chaque profil. Plage cible : 5 minimum, 10 maximum.

| #   | Slug                                               | Ville        | Typologie                   | `is_palace` | `priority` | Notes                              |
| --- | -------------------------------------------------- | ------------ | --------------------------- | ----------- | ---------- | ---------------------------------- |
| 1   | `le-bristol-paris`                                 | Paris        | Palace parisien historique  | ✅          | P0         | Référence (déjà très enrichi)      |
| 2   | `cheval-blanc-saint-tropez`                        | Saint-Tropez | Palace balnéaire            | ✅          | P0         | Saisonnier fort                    |
| 3   | `hotel-du-cap-eden-roc`                            | Antibes      | Hors centre-ville           | ✅          | P0         | Accès complexe                     |
| 4   | `airelles-chateau-de-versailles-le-grand-controle` | Versailles   | Palace périphérique         | ✅          | P0         | Quartier non urbain                |
| 5   | `le-negresco-nice`                                 | Nice         | Palace en bord de mer       | ✅          | P1         | Description riche                  |
| 6   | `hotel-de-crillon-paris`                           | Paris        | Palace Place de la Concorde | ✅          | P0         | Gastronomie 2 étoiles              |
| 7   | `_ajouter_un_R&C_petit_format`                     | (à choisir)  | Relais & Châteaux campagne  | ❌          | P2         | Données plus pauvres → stress test |
| 8   | `_ajouter_un_boutique_régional`                    | (à choisir)  | Boutique régional 5★        | ❌          | P2         | Risque de hallucination plus élevé |

À compléter par le copilote au moment du run dans la table ci-dessus.

### Commande de run (pilote, dry-run d'abord)

```bash
cd scripts/editorial-pilot

# 1) Dry-run sur 1 hôtel pour valider la chaîne complète
pnpm club:conseil-enrichi --slug=le-bristol-paris --dry-run --tavily
pnpm club:quartier         --slug=le-bristol-paris --dry-run --tavily
pnpm club:gastronomie      --slug=le-bristol-paris --dry-run --tavily
pnpm club:timing           --slug=le-bristol-paris --dry-run --tavily

# 2) Run live sur l'échantillon (5-10 slugs)
SLUGS="le-bristol-paris,cheval-blanc-saint-tropez,hotel-du-cap-eden-roc,airelles-chateau-de-versailles-le-grand-controle,le-negresco-nice,hotel-de-crillon-paris"
pnpm club:conseil-enrichi --slugs="$SLUGS" --tavily --concurrency=2
pnpm club:quartier         --slugs="$SLUGS" --tavily --concurrency=2
pnpm club:gastronomie      --slugs="$SLUGS" --tavily --concurrency=2
pnpm club:timing           --slugs="$SLUGS" --tavily --concurrency=2
```

---

## 3. Grille de scoring — 4 axes, score /5 par axe

Chaque hôtel × chaque section reçoit un score sur 4 axes (5 = parfait,
1 = à jeter). Le score moyen par axe est calculé sur l'ensemble de
l'échantillon.

### Axe 1 — Factualité (vs Tavily + JSON Supabase)

- 5 : tous les faits cités (chambre, restaurant, distance, étoile, adresse, horaire) sont vérifiables dans le JSON source OU les sources Tavily.
- 3 : 1 fait isolé sans source claire, mais plausible.
- 1 : ≥ 2 faits inventés (numéro de chambre, chef inexistant, étoile Michelin fantôme).

**Méthode de vérification** : ouvrir le run log JSON (`runs/premium-section-*.json`) et croiser chaque assertion factuelle avec `=== HOTEL ===` et les snippets Tavily.

### Axe 2 — Voix Concierge (vs ADR-0011 + `EDITORIAL_VOICE.md`)

- 5 : posture concierge complice, secret opérationnel, ton sobre, pas de marketing.
- 3 : ton globalement correct mais 1-2 superlatifs ou tournures commerciales.
- 1 : ton journalistique générique ou commercial (« incroyable séjour », « cadre idyllique », « expérience inoubliable »).

### Axe 3 — Uniqueness (vs description existante)

- 5 : le contenu apporte des informations NOUVELLES par rapport à `description_fr` / `description_en`. Aucune phrase ne reformule platement la description.
- 3 : 70 % de contenu neuf, 30 % de reformulation.
- 1 : essentiellement un re-paraphrase de la description existante.

### Axe 4 — Valeur informationnelle (au lecteur)

- 5 : un lecteur qui prépare un séjour gagne ≥ 3 informations actionnables.
- 3 : 1 information actionnable.
- 1 : prose générique sans valeur opérationnelle.

---

## 4. Tableau de résultats (à remplir au run)

### `conseil_enrichi`

| Slug               | Factualité | Voix | Uniqueness | Valeur | Moyenne | Commentaire |
| ------------------ | ---------- | ---- | ---------- | ------ | ------- | ----------- |
| `le-bristol-paris` | /          | /    | /          | /      | /       |             |
| …                  |            |      |            |        |         |             |

### `quartier_concierge`

| Slug               | Factualité | Voix | Uniqueness | Valeur | Moyenne | Commentaire |
| ------------------ | ---------- | ---- | ---------- | ------ | ------- | ----------- |
| `le-bristol-paris` | /          | /    | /          | /      | /       |             |
| …                  |            |      |            |        |         |             |

### `gastronomie_concierge`

| Slug               | Factualité | Voix | Uniqueness | Valeur | Moyenne | Commentaire |
| ------------------ | ---------- | ---- | ---------- | ------ | ------- | ----------- |
| `le-bristol-paris` | /          | /    | /          | /      | /       |             |
| …                  |            |      |            |        |         |             |

### `timing_acces_concierge`

| Slug               | Factualité | Voix | Uniqueness | Valeur | Moyenne | Commentaire |
| ------------------ | ---------- | ---- | ---------- | ------ | ------- | ----------- |
| `le-bristol-paris` | /          | /    | /          | /      | /       |             |
| …                  |            |      |            |        |         |             |

---

## 5. Synthèse par axe (à calculer)

| Axe                     | Score moyen | Seuil        | Statut |
| ----------------------- | ----------- | ------------ | ------ |
| Factualité              | /5          | ≥ 4,0 (80 %) | ⬜     |
| Voix Concierge          | /5          | ≥ 4,0        | ⬜     |
| Uniqueness              | /5          | ≥ 4,0        | ⬜     |
| Valeur informationnelle | /5          | ≥ 4,0        | ⬜     |

---

## 6. Gate Go / No-Go

- **GO Sprint 3a** ssi : ≥ 3 axes sur 4 ≥ 4,0 ET aucun axe < 3,5.
- **NO-GO + itération prompt** : si ≥ 2 axes < 4,0, OU axe Factualité < 4,0 (risque légal/EEAT trop fort).

### Hypothèses d'itération si NO-GO

| Symptôme                             | Itération prompt suggérée                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hallucinations factuelles fréquentes | Renforcer Tavily grounding (`--tavily` obligatoire) + ajouter une consigne « si la donnée n'est pas dans le JSON OU SOURCES, ne pas l'écrire » plus visible en CHECKLIST. |
| Voix marketing récurrente            | Étendre la liste `BANNED_LEXICON` dans `premium-section-generator.ts`.                                                                                                    |
| Uniqueness faible (paraphrase)       | Ajouter au prompt l'extrait `description_fr` actuel avec consigne explicite « tu N'écris pas une paraphrase de ce texte ».                                                |
| Valeur informationnelle faible       | Augmenter la médiane visée (passer de 240 mots à 270 mots) ET ajouter une consigne « au moins 3 faits actionnables ».                                                     |

---

## 7. Conclusion (à remplir post-run)

- [ ] Pilote exécuté le \_\_\_
- [ ] Scores calculés et collés dans la section 5
- [ ] Conclusion : **GO / NO-GO**
- [ ] Si NO-GO, itération appliquée commit `_______`, re-run lancé
- [ ] Approbation : owner éditorial **\_\_\_** + product owner **\_\_\_**

---

## 8. Références

- `.cursor/rules/hotel-detail-page.mdc` — checklist des 16 blocs fiche hôtel.
- `.cursor/skills/concierge-voice-pipeline/SKILL.md` — règles voix.
- `.cursor/skills/llm-output-robustness/SKILL.md` — règles Zod / retry / gate.
- `.cursor/skills/content-enrichment-pipeline/SKILL.md` — Tavily grounding.
- `EDITORIAL_VOICE.md` — voix Concierge (root).
- `docs/adr/0011-concierge-voice.md` — ADR voix.
- `packages/db/migrations/0057_loyalty_member_program.sql` — colonnes éditoriales.
