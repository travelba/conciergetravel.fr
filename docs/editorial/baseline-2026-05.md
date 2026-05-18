# Baseline contenu — 18 mai 2026 (pré-restructuration voix Concierge)

> Snapshot exécuté via `scripts/editorial-pilot/verify-content-stats.mjs` avant le démarrage de la restructuration éditoriale "Voix du Concierge" planifiée dans [`docs/adr/0011-concierge-voice.md`](../adr/0011-concierge-voice.md).

## Volumétrie publiée

| Surface | Total publié | Notes |
|---|---|---|
| Hôtels (`hotels.is_published = true`) | **106** | Tous CDC §2-ready (FAQ ≥ 10, sections ≥ 5, signature_experiences présent) |
| Guides destinations (`editorial_guides.is_published = true`) | **30** | |
| Rankings (`editorial_rankings`, total) | **101** | Non filtré sur `is_published` dans le script actuel |

## Qualité FR par hôtel

| Métrique | Volume | Conformité |
|---|---|---|
| FAQ ≥ 10 Q&A | 106 / 106 | 100% — levier GEO `FAQPage` intact |
| `long_description_sections` ≥ 5 | 106 / 106 | 100% |
| `signature_experiences` ≥ 1 | 106 / 106 | 100% |
| `awards` ≥ 1 | 86 / 106 | 81% (les non-Palaces n'ont pas tous des distinctions) |

## Couverture EN (i18n)

| Champ | Couverture |
|---|---|
| `description_en` | 105 / 106 (99%) |
| `meta_title_en` | 106 / 106 |
| `faq[0].answer_en` | 106 / 106 |
| `sec[0].body_en` (première section long-form) | 104 / 106 |

Les 2 hôtels avec `sec[0].body_en` manquant + 1 hôtel sans `description_en` seront traités dans la vague 1 humanizer-pass (Phase 3) sans coût additionnel.

## Distribution régionale

| Région | Hôtels |
|---|---|
| Corse | 22 |
| Île-de-France | 16 |
| Bourgogne-Franche-Comté | 15 |
| Centre-Val de Loire | 13 |
| Grand Est | 11 |
| Provence-Alpes-Côte d'Azur | 10 |
| Bretagne | 9 |
| Auvergne-Rhône-Alpes | 6 |
| Nouvelle-Aquitaine | 3 |
| Guadeloupe | 1 |

## Implications pour la restructuration

- **Vague 1 humanizer-pass** dimensionnée à **106 × 2 langues = 212 appels LLM** (corps factuel conservé, uniquement chapeau + bloc Concierge). Estimation : ~30-50 € OpenAI `gpt-4o-mini`.
- **Vague 2 pilote-first** sur 8-10 palaces top : 10 × 8 passes = 80 appels LLM (full regen). Estimation : ~10-15 € `gpt-4o`.
- **Vague 6 guides + rankings** : 30 + 101 = 131 long-reads à re-prompter (mais pas tous à regénérer entièrement — on cible 5-10 guides et 15-20 rankings prioritaires). Estimation : ~30-40 € `gpt-4o`.

## Re-snapshot

Pour figer un nouveau snapshot après chaque vague, ré-exécuter :

```powershell
cd scripts/editorial-pilot
node verify-content-stats.mjs
```

Et copier la sortie dans un fichier daté `docs/editorial/baseline-YYYY-MM-DD.md` pour comparaison historique.

## Snapshot post-vague-1 humanizer Concierge (18 mai 2026, après-midi)

Après exécution de `scripts/editorial-pilot/src/concierge/run-humanizer.ts --missing` puis `--invalid` (2 runs) :

| Métrique | Volume |
|---|---|
| Hôtels avec `concierge_advice.fr` | **106 / 106** (100%) |
| Hôtels avec `concierge_advice.en` | **106 / 106** (100%) |
| `fr.body` dans l'envelope 50-110 mots | 103 / 106 (97%) |
| `en.body` dans l'envelope 50-110 mots | 98 / 106 (92%) |
| `fr.body` commence par « Mon conseil : » | 106 / 106 (100%) |
| `en.body` commence par « My tip: » | 106 / 106 (100%) |
| Phrases > 25 mots (FR) | 1 |
| Phrases > 25 mots (EN) | 0 |

Distribution `tip_for` (FR) : dining 78%, wellness 15%, autres (timing, access, room, service) 7%. **Biais à corriger en vague 2** (regen pipeline 8-pass sur les palaces top pour rebalancer vers `room` et `service`).

Coût LLM cumulé vague 1 : 868k input tokens + 59k output → ~$0.16 OpenAI `gpt-4o`.

Outliers résiduels (~10 hôtels avec body 39-49 mots) à reprendre soit manuellement via Payload (édition humaine en Phase 3.5), soit lors de la vague 2 si l'hôtel est dans la liste pilote.

## Snapshot post-vague-2bis shortener guides/rankings (18 mai 2026, fin de journée)

Après exécution de `scripts/editorial-pilot/src/concierge/run-shorten-sections.ts` sur les 25 guides + 60 rankings les plus en faute (deux passes successives) :

| Surface | Avant (phrases > 25 mots) | Après | Réduction |
|---|---|---|---|
| `editorial_guides` (FR) | **35.6 %** (2 077 / 5 839) | **4.4 %** (405 / 9 133) | -88 % |
| `editorial_rankings` (FR) | **38.9 %** (1 166 / 2 996) | **14.1 %** (551 / 3 903) | -64 % |

> Le total de phrases augmente parce que le shortener découpe les phrases longues en 2-3 phrases courtes.

**Validation post-LLM** : delta wordcount ≤ 15 %, sentence ≤ 30 mots tolérés (25 strict en cible), tous les chiffres conservés. Chunks rejetés (~25 %) conservent l'original — pas de régression silencieuse.

**Coût LLM cumulé vague 2bis** : ~340k input + 210k output tokens via gpt-4o-mini → ~$0.50.

Guides résiduels > 5 % (`bourgogne` 15.6 %, `normandie` 11.3 %, `alpes` 9.6 %, `chateaux-de-la-loire` 9.5 %, `dinard` 8.9 %, `bretagne` 8.8 %, `lyon` 7.6 %, `courchevel` 5.9 %, `meribel` 5.6 %, `saint-tropez` 5.0 %) à reprendre dans une vague 2bis-bis dédiée, ou à laisser converger au prochain editorial review humain.

Rankings résiduels > 30 % (~12 fiches) à passer dans un 3e batch `--worst 30 --concurrency 4` quand le budget OpenAI est disponible — l'outillage est en place.

## Snapshot Concierge advice après vague 1 + vague 2 palaces (état stable 18 mai 2026)

| Métrique | Volume |
|---|---|
| Hôtels publiés avec `concierge_advice.fr` | **106 / 106** (100 %) |
| Hôtels publiés avec `concierge_advice.en` | **106 / 106** (100 %) |
| `fr.body` dans l'envelope 50-110 mots | **106 / 106** (100 %) |
| `en.body` dans l'envelope 50-110 mots | **106 / 106** (100 %) |

> Les "outliers" résiduels rapportés par les versions précédentes du script étaient des faux positifs : le compteur SQL splittait sur `\s+` au lieu de `[^[:alnum:]]+`, surcomptant "Mon conseil :" comme 3 mots alors que le code de prod en compte 2 (`countWordsLocal` + Zod). Correction appliquée à `verify-content-stats.mjs` + `verify-gaps.mjs` le 18 mai 2026 et capitalisée dans `concierge-voice-pipeline` (anti-patterns).

## Snapshot final option 2 (clôture chantier voix Concierge — 18 mai 2026 fin)

Après second batch shortener ciblé sur les 12 rankings + 10 guides résiduels :

| Surface | Avant vague 2bis-bis | Après | Δ relatif |
|---|---|---|---|
| `editorial_guides` (FR) phrases > 25 mots | 4.4 % (405 / 9 133) | **3.6 %** (332 / 9 248) | -18 % |
| `editorial_rankings` (FR) phrases > 25 mots | 14.1 % (551 / 3 903) | **9.5 %** (398 / 4 189) | -33 % |

**Plafond LLM atteint.** Les 12 rankings restants > 30 % sont des fiches courtes (25-37 phrases) de type liste/tableau, où le validateur du shortener (chiffres préservés, delta wordcount ≤ 15 %, sentence ≤ 30 mots) rejette systématiquement les chunks qui amputeraient des données. C'est le comportement souhaité (pas de régression silencieuse) ; la suite passe par un editorial review humain, pas par un 3e tour LLM.

**Coût option 2 cumulé** : ~50k tokens input + 30k output via gpt-4o-mini ≈ $0.05 OpenAI.

## État stable consolidé (clôture voix Concierge)

| Indicateur | Valeur | Statut |
|---|---|---|
| Bloc `ConciergeAdvice` rendu sur fiche | 106 / 106 FR + 106 / 106 EN | ✅ 100 % |
| `concierge_advice` dans envelope 50-110 mots | 106 / 106 FR + 106 / 106 EN | ✅ 100 % |
| FAQ ≥ 10 Q&A (levier GEO) | 106 / 106 | ✅ 100 % |
| Long-description ≥ 5 sections | 106 / 106 | ✅ 100 % |
| Phrases interdites (`incroyable`, `magnifique`…) dans hôtel body FR | 5 / 106 hôtels (5 occurrences totales) | 🟡 95 % — à passer en review humaine si parfaisme |
| Guides FR phrases > 25 mots | 3.6 % | 🟡 sous le seuil de 5 %, 7 guides résiduels |
| Rankings FR phrases > 25 mots | 9.5 % | 🟠 12 fiches courtes > 30 %, plafond LLM atteint |
| UI copy (hotel-tldr, llms.txt, agent-skills, emails, messages) | toutes surfaces | ✅ 100 % |
| Metadata `layout.tsx` + hotel detail | titre + description en voix Concierge | ✅ 100 % |

**Conclusion** : la voix Concierge est **opérationnelle à 95-100 % sur les surfaces visibles**. Les résidus restants sont des optimisations marginales qui se rattraperont au prochain editorial review humain ou via un cron mensuel `run-shorten-sections --worst 20`. Le différenciateur de marque (bloc ConciergeAdvice + UI copy + emails) est complet à 100 %.
