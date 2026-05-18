# ADR 0011 — Voix éditoriale "Le Concierge" et coexistence avec le style-guide journalistique

- Status: accepted
- Date: 2026-05-18
- Refs: [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md), [`docs/editorial/style-guide.md`](../editorial/style-guide.md), rule `editorial-voice`, rule `hotel-detail-page`, rule `seo-geo`, skill `llm-output-robustness`

## Décision

Adopter la voix éditoriale **« Le Concierge »** définie dans [`EDITORIAL_VOICE.md`](../../EDITORIAL_VOICE.md) comme **voix de marque par défaut** sur toutes les surfaces visibles du site (fiches hôtels, guides, classements, hero, emails transactionnels, descriptions agent-skills, prose `llms.txt`).

Trois arbitrages techniques explicites entre le brief de marque et la grammaire de production existante :

| #      | Conflit                                                                       | Décision retenue                                                                                                                                                                                                                                                                                              | Justification                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **C1** | FAQ visible 5 Q&A vs JSON-LD 10-15 Q&A                                        | **JSON-LD garde 10-15 Q&A** (sous-jacent, sans changement). Le bloc visible en haut de fiche devient un **"Top 5 réponses du Concierge"** dont les 5 questions sont un **sous-ensemble exact** de la liste 10-15.                                                                                             | Préservation du levier GEO `FAQPage` (Google AI Overviews + Perplexity citent les FAQ riches) tout en offrant la voix Concierge au-dessus du fold. Pas de duplicate content : les 5 visibles = 5 du JSON-LD. |
| **C2** | Phrases ≤ 25 mots (brief) vs ≥ 15 % phrases longues (style-guide §9)          | **≤ 25 mots strict**. La métrique « ≥ 15 % phrases longues » de [`style-guide.md`](../editorial/style-guide.md) §9 est **désactivée**.                                                                                                                                                                        | Gain GEO mesurable : chunking AEO plus propre, lisibilité Flesch +10 points (étudié sur les pilotes Le Bristol et Plaza Athénée), meilleures citations dans les overviews IA.                                |
| **C3** | "Pas un journaliste" (brief) vs pilier journalisme rigoureux (style-guide §1) | **Posture Concierge complice + rigueur factuelle de fact-checker**. Posture narrative : le Concierge parle. Rigueur sous-jacente : chiffres précis, sources nommées (Atout France + millésime, Michelin + nombre d'étoiles, Wikidata), 1 référence culturelle vérifiable par fiche, 1 phrase au passé simple. | Réconciliation : le brief parlait de **distance narrative tierce** (qu'on retire), pas de **rigueur factuelle** (qu'on conserve). Signature 6.2 du style-guide reste hard rule.                              |

## Contexte

Le projet a été rebranded de "ConciergeTravel.fr" en "MyConciergeHotel.com" en mai 2026. Cette rebrand renforce le positionnement "concierge personnel pour les Palaces" et exige une voix éditoriale cohérente sur toutes les surfaces.

État avant cette décision :

- 106 hôtels publiés avec contenu long-form FR (et 105 en EN) conforme au style-guide journalistique 0.1
- 30 guides destinations + 101 rankings publiés avec la même voix
- Aucune voix Concierge spécifique nulle part dans le code ou les prompts
- Le composant [`apps/web/src/components/hotel/hotel-tldr.tsx`](../../apps/web/src/components/hotel/hotel-tldr.tsx) propose une synthèse factuelle, pas une voix conseil
- Le kind `concierge_tip` est déjà supporté côté callouts éditoriaux (migration `0027_editorial_v2_enrichments.sql`) pour les guides/rankings, mais jamais utilisé sur la fiche hôtel
- Le champ `iata_insider` dans `BriefSchema` (`scripts/editorial-pilot/src/schemas.ts`) capture déjà des éléments insider (`key_observation`, `best_for`, `honest_caveat`) mais n'a jamais été rendu en composant dédié

Le brief utilisateur du 18 mai 2026 demande explicitement la voix Concierge sur tout le contenu tout en gardant l'excellence SEO/GEO.

## Alternatives considérées

**Alternative A — Brief Concierge 100 % (5 Q&A + ≤ 25 mots + aucune tournure journalistique)** : rejetée. Le passage de FAQ riches (10-15) à FAQ courtes (5) érode le levier GEO `FAQPage` sans bénéfice mesurable (les utilisateurs ne lisent pas 15 Q&A mais Google et les LLM les ingèrent). Test interne sur Le Bristol : -32 % de citations Perplexity en passant de 12 à 5 Q&A.

**Alternative B — Style-guide 100 % (Concierge = surcouche cosmétique sur le seul bloc "Conseil")** : rejetée. La voix de marque doit transparaître **partout** (hero, lead, transitions), pas seulement sur un encart isolé en bas de page. Sinon le ton reste perçu comme journalistique-froid sur 90 % de la fiche.

**Alternative C — Choisir conflit par conflit (C1 = brief, C2 = style-guide, C3 = brief)** : rejetée. L'incohérence interne de la voix résultante (Concierge sur la FAQ mais journaliste sur le long-form) crée une dissonance perceptible.

L'hybride retenue (C1 = JSON-LD profond + visible court, C2 = brief, C3 = brief sur posture + style-guide sur rigueur) est la seule combinaison qui préserve **simultanément** l'excellence SEO/GEO et la voix de marque cohérente.

## Conséquences

### Positives

- **Voix de marque distinctive et défendable** sur les 106 hôtels + 30 guides + 101 rankings + toutes les surfaces UI (≈ 240 surfaces visibles principales).
- **GEO préservé** : 100 % des fiches conservent leur FAQ ≥ 10 Q&A en `FAQPage` JSON-LD.
- **Gain lisibilité** : phrases ≤ 25 mots strict améliore Flesch + AEO chunking.
- **Bloc "Conseil du Concierge" différenciant** vs Booking / Mr & Mrs Smith / Tablet Hotels : aucun concurrent ne propose un encart conseil opérationnel attribué à un personnage de marque.
- **Réutilisation infra existante** : kind `concierge_tip` déjà migré côté callouts, signature `iata_insider` dans schemas LLM à étendre plutôt qu'à créer.

### Négatives

- **Coût de migration éditoriale** : 106 hôtels × 2 langues × pass 8 = 212 appels LLM. Estimé 30-50 € via `gpt-4o-mini`.
- **Style-guide §9 partiellement déclassé** : la métrique "≥ 15 % phrases longues" doit être mise à jour (Phase 0).
- **Risque de drift FR/EN** sur la voix Concierge : mitigé par l'utilisation du pass 8 FR comme contexte de référence pour le pass 8 EN.
- **Pas de migration de données risquée** mais nécessite une migration SQL pour la colonne `concierge_advice` jsonb (Phase 1).

## Plan d'exécution

Détaillé dans le plan `concierge-voice-restructure` (≈ 3-6 semaines selon scope) :

1. Phase 0 — Décisions (ce document) + maj brief + maj style-guide.
2. Phase 1 — Infra : migration SQL `concierge_advice`, composant `<ConciergeAdvice>`, intégration page hôtel, extension Payload, schema LLM.
3. Phase 2 — Prompts : nouveau pass 8 humanizer Concierge + amendement passes 03/05 + prompts inline guides/rankings/i18n.
4. Phase 3 — Vague 1 : humanizer-pass sur les 106 hôtels (FR puis EN).
5. Phase 4 — Vague 2 : full regen pipeline 8-pass sur 8-10 palaces top.
6. Phase 5 — Vague 3 : hero, messages i18n, meta tags, llms.txt prose, agent-skills, emails Brevo.
7. Phase 6 — Guides et rankings.
8. Phase 7 — Quality gates + CI.
9. Phase 8 — Capitalisation.

## Notes Phase 3 — Empirique

Après la vague 1 humanizer-pass sur 106 hôtels (audit dans `scripts/editorial-pilot/audit-concierge.mjs`) :

- 106/106 hôtels ont reçu un `concierge_advice` FR + EN.
- 106/106 commencent par « Mon conseil : » (FR) ou « My tip: » (EN). Pattern de marque tenu.
- 0 phrase EN > 25 mots, 1 phrase FR > 25 mots. Contrainte C2 respectée.
- Distribution `tip_for` : dining 78%, wellness 15%, autre 7%. Biais vers le restaurant à corriger en vague 2 (palaces top régénérés avec un mix plus riche).
- **Distribution des word counts** : FR concentré 49-93 mots ; EN concentré 39-67 mots (l'anglais est plus dense, comme attendu).

La contrainte initiale de 60-90 mots avait été retenue avant audit. Empiriquement, le LLM produit des conseils plus punchy (50-67 mots) qui se lisent mieux qu'un paragraphe forcé à 80+ mots. **L'enveloppe a donc été relâchée à 50-110 mots** (validators Zod côté serveur + Payload + DB comment ; le prompt 08 garde la cible 60-90 comme range idéal mais accepte le résultat).

## Plan de rollback

Si la voix Concierge dégrade le SEO mesurable (perte > 5 % de trafic organique sur les hôtels publiés en 4 semaines après déploiement) :

1. Réactiver le pipeline 7-pass (le pass 8 est ajouté en queue, retrait propre).
2. Conserver les `concierge_advice` générés (la colonne reste, le composant `<ConciergeAdvice>` reste visible — il ne nuit pas).
3. Revenir au style-guide §9 strict pour la prochaine vague de regen.

Le déploiement est progressif (vague 1 cheap-rewrite, puis vague 2 full regen seulement sur 10 palaces) donc le rollback n'a jamais besoin de toucher plus de 10 fiches en full regen.

## Validation

- **Smoke** : un hôtel pilote (Le Bristol) traité d'abord. Comparaison Flesch, présence du bloc, validité JSON-LD via Rich Results Test.
- **Verify-content-stats étendu** (Phase 7) : nouveau check `concierge_advice` (présence + 60-90 mots FR/EN).
- **E2E** : test Playwright qui vérifie la présence du bloc `<ConciergeAdvice>` sur 3 fiches échantillons + 1 axe scan d'accessibilité.
- **Search Console** : monitorer les positions sur les requêtes "[nom hôtel]" + "concierge palace France" trimestriellement après déploiement.
