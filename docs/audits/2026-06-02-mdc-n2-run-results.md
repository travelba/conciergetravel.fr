---
title: MDC N2 — run results (26 scénarios boîte noire)
date: 2026-06-02
author: agent
base: main post-#127 (squash cf7e84b)
scope: docs/audits/mdc-test-scenarios/*.md (lecture seule code)
method: simulation LLM interne (rules en contexte), pas d'exécution agent live
related: '#125 (audit N1+N2 generation), #126 (Vague F-bis items), #127 (Vague F-bis merge), #128 (overlap globs)'
status: done
---

# MDC N2 — Résultats du run (26 scénarios)

## 1. Méthode et honnêteté intellectuelle

Ce document acte le **run** des 26 scénarios boîte noire générés en N2 lors de
l'audit MDC (#125, `docs/audits/2026-06-02-mdc-quality-audit.md` §4). Chaque
scénario porte un prompt **positif** (doit déclencher le comportement de la MDC
sans la nommer) et un prompt **négatif** (doit être refusé / alerté).

**Nature du run — simulation, pas exécution live.** Les verdicts sont produits
par **simulation LLM interne** : les MDC sont chargées dans le contexte de
l'agent (la majorité sont `alwaysApply: true`, donc injectées d'office ; les
autres sont évaluées en lisant leur contenu), et l'agent juge si, _appliquée_,
la règle satisfait les critères d'acceptation (positif) et déclenche le refus
attendu (négatif). C'est la voie de repli explicitement prévue par le prompt N2
(« si tu peux simuler en LLM interne sans toucher code, fais-le et marque
simulation »).

**Ce que la simulation ne prouve pas.** Elle valide que le **contenu** de chaque
MDC est suffisant et non-contradictoire pour produire le comportement attendu.
Elle ne mesure **pas** le **déclenchement réel** en session (est-ce que Cursor
charge bien la MDC à `alwaysApply: false` sans glob, sur la base de la seule
description ?). Cette dimension « est-ce que la règle se charge » relève de
l'item overlap/trigger tracé en **#128** (candidat ADR-0028) — voir §4.

Aucune écriture de code, aucun subagent live, aucune modification de MDC ni
d'ADR dans ce run. Seuls les 26 fichiers scénarios (champ « Statut ») + ce
rapport sont touchés.

## 2. Synthèse exécutive

- **26 / 26 scénarios : ✅ PASS (simulation)**. Sur la baseline post-#127, le
  contenu de chaque MDC porte sans ambiguïté le comportement positif attendu et
  le refus négatif attendu.
- **0 FAIL**, **0 ⚠️ partiel** au niveau contenu.
- **3 caveats lint N1 désormais résolus** sur la baseline (corrigés en Vague
  F-bis #127) — ils étaient les seuls points d'ambiguïté de citation relevés en
  #125 :
  - `31-hotel-page-blueprint.mdc` — contradiction ADR-0024/0025 (L82) corrigée.
  - `nextjs-app-router.mdc` — renvoi erroné « ADR-0004 layout » (L70) retiré.
  - `photo-quality.mdc` — chemin périmé `cloudinary.ts` → `cloudinary-presets.ts`
    - `hotel-image.tsx`.
- **1 réserve méthodologique persistante (hors contenu)** : la fiabilité de
  **déclenchement** des 4 MDC à `alwaysApply: false` **sans glob** (`01`, `14`,
  `20`, `commit-conventions`) dépend du matching de description par Cursor. Non
  testable en simulation statique. À couvrir lors de l'arbitrage #128.

## 3. Tableau récapitulatif des verdicts

| #   | MDC                             | alwaysApply | Positif | Négatif | Verdict       | Note                             |
| --- | ------------------------------- | ----------- | ------- | ------- | ------------- | -------------------------------- |
| 1   | `01-project-overview`           | false       | ✅      | ✅      | ✅ PASS (sim) | trigger par description (cf. §4) |
| 2   | `10-seo-foundations`            | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 3   | `11-seo-multilingue`            | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 4   | `12-schema-ota`                 | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 5   | `14-agent-routing`              | false       | ✅      | ✅      | ✅ PASS (sim) | trigger par description (cf. §4) |
| 6   | `20-agents-overview`            | false       | ✅      | ✅      | ✅ PASS (sim) | trigger par description (cf. §4) |
| 7   | `30-programmatic-pages`         | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 8   | `31-hotel-page-blueprint`       | false       | ✅      | ✅      | ✅ PASS (sim) | caveat ADR résolu (#127)         |
| 9   | `40-llms-txt-strategy`          | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 10  | `41-robots-agents-permissions`  | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 11  | `architecture-layers`           | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 12  | `code-conventions`              | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 13  | `commit-conventions`            | false       | ✅      | ✅      | ✅ PASS (sim) | trigger par contexte commit (§4) |
| 14  | `e2e-testing`                   | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 15  | `editorial-voice`               | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 16  | `hotel-detail-page`             | true        | ✅      | ✅      | ✅ PASS (sim) | force-dynamic transitoire / ISR  |
| 17  | `integrations-api`              | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 18  | `itinerary-page`                | false       | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 19  | `nextjs-app-router`             | true        | ✅      | ✅      | ✅ PASS (sim) | caveat ADR-0004 résolu (#127)    |
| 20  | `observability-perf`            | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 21  | `photo-quality`                 | true        | ✅      | ✅      | ✅ PASS (sim) | caveat chemin résolu (#127)      |
| 22  | `seo-geo`                       | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 23  | `skills-capitalisation`         | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 24  | `supabase-rls`                  | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |
| 25  | `user-acceptance-before-commit` | true        | ✅      | ✅      | ✅ PASS (sim) | gate process always-on           |
| 26  | `security-csp`                  | true        | ✅      | ✅      | ✅ PASS (sim) | —                                |

## 4. Réserve déclenchement (lien avec #128)

Les 4 MDC à `alwaysApply: false` **et sans glob** (`01-project-overview`,
`14-agent-routing`, `20-agents-overview`, `commit-conventions`) ne se chargent
qu'au matching de **description** par Cursor. La simulation valide leur contenu,
pas leur probabilité de chargement réel. C'est le **symétrique** du problème
overlap traité en #128 :

- **Sous-déclenchement** possible (ces 4 MDC sans glob).
- **Sur-déclenchement** avéré (les transverses Vague A à globs larges chargent
  ~12 MDC sur une fiche hôtel — #128, candidat ADR-0028).

Recommandation : l'arbitrage #128 doit traiter les **deux** bouts du spectre —
resserrer les globs trop larges **et** vérifier que les MDC « routage /
gouvernance » sans glob restent atteignables (mention `@rule` documentée, ou
description optimisée). Une validation N2 ciblée sera rejouée sur les surfaces
affectées après application de la décision #128 (cf. critères d'acceptation
#128).

## 5. Limites et suite

- Run = **simulation**. Pour une preuve live, rejouer un sous-ensemble (les
  négatifs des MDC P1 : `security-csp`, `hotel-detail-page`, `architecture-layers`,
  `supabase-rls`) en session agent réelle et confirmer le refus — faible coût,
  forte valeur de non-régression. Optionnel, non bloquant.
- Les statuts individuels sont inscrits dans chaque
  `docs/audits/mdc-test-scenarios/<mdc>.md` §5.
- Prochaine action de fond sur les MDC : **#128 (ADR-0028)**, indépendant de ce
  run.

## 6. Annexes

- Audit N1+N2 source : `docs/audits/2026-06-02-mdc-quality-audit.md`
- Scénarios : `docs/audits/mdc-test-scenarios/*.md` (26 fichiers)
- Issues : #126 (items F-bis, 4/5 fermés), #128 (overlap globs, candidat ADR-0028)
- PR Vague F-bis : #127 (squash `cf7e84b`)
