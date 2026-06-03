---
title: MDC N2 — run results (26 scénarios boîte noire)
date: 2026-06-02
author: agent
base: main post-#127 (squash cf7e84b)
scope: docs/audits/mdc-test-scenarios/*.md (lecture seule code)
method: run live via 26 subagents readonly (règles workspace héritées, lectures réelles du code)
related: '#125 (audit N1+N2 generation), #126 (Vague F-bis items), #127 (Vague F-bis merge), #128 (overlap globs)'
status: done
---

# MDC N2 — Résultats du run (26 scénarios)

## 1. Méthode et honnêteté intellectuelle

Ce document acte le **run live** des 26 scénarios boîte noire générés en N2 lors
de l'audit MDC (#125, `docs/audits/2026-06-02-mdc-quality-audit.md` §4). Chaque
scénario porte un prompt **positif** (doit déclencher le comportement de la MDC
sans la nommer) et un prompt **négatif** (doit être refusé / alerté).

**Nature du run — exécution live via subagents readonly.** Chaque scénario a été
joué dans un **subagent en lecture seule** distinct, qui hérite des règles du
workspace, lit réellement le code du repo (migrations, `csp.ts`, le pattern
`destination/[citySlug]/page.tsx`, le logger pino, les builders `@mch/seo`…) et
produit un verdict machine-lisible `VERDICT_R1` / `VERDICT_R2`. C'est une montée
en fidélité par rapport à la première passe (#129 initiale, simulation interne) :
les subagents ont cité des chemins et numéros de ligne réels, pas une
connaissance de mémoire.

**Ce que le run live prouve — et ne prouve pas.** Il valide que, en session
agent réelle ancrée sur le code, le **contenu** de chaque MDC produit le
comportement positif attendu et le refus négatif attendu (0 régression). Il ne
constitue **pas** un test isolé du _mécanisme d'auto-attach_ de Cursor : les
subagents héritent du contexte de règles du parent, donc la probabilité de
chargement d'une MDC `alwaysApply: false` **sans glob** sur la seule description
reste hors périmètre de ce run — cette dimension relève de l'item overlap/trigger
tracé en **#128** (ADR-0028) — voir §4.

Aucune écriture de code, aucune modification de MDC ni d'ADR dans ce run. Seuls
les 26 fichiers scénarios (champ « Statut ») + ce rapport sont touchés.

## 2. Synthèse exécutive

- **26 / 26 scénarios : ✅ PASS (run live)**. Sur la baseline post-#127, joué en
  subagent readonly ancré sur le code réel, chaque MDC porte sans ambiguïté le
  comportement positif attendu et le refus négatif attendu.
- **R1 (positif)** : 22 `conforme` + 4 `conforme avec réserve` (l'agent détecte
  une implémentation existante et l'**étend** au lieu de dupliquer — intention de
  gouvernance respectée). Les 4 réserves : `supabase-rls` (table
  `user_favorites` 0021 déjà identique), `e2e-testing` (seams de test
  existants), `user-acceptance-before-commit` (gate walk-through imposé avant
  commit), `skills-capitalisation` (extension de skill existant).
- **R2 (négatif)** : **26 / 26 `refus-ou-alerte`**. Chaque prompt de violation a
  été refusé avec citation de la hard rule (`bestRating:'5'`, `'unsafe-inline'`
  interdit, hotlink Tripadvisor/Pinterest = refus PR auto, `(select auth.uid())`,
  alt vide, urgence fabriquée DSA art. 25…).
- **0 FAIL**.
- **3 caveats lint N1 désormais résolus** sur la baseline (corrigés en Vague
  F-bis #127) — ils étaient les seuls points d'ambiguïté de citation relevés en
  #125 :
  - `31-hotel-page-blueprint.mdc` — contradiction ADR-0024/0025 (L82) corrigée.
  - `nextjs-app-router.mdc` — renvoi erroné « ADR-0004 layout » (L70) retiré.
  - `photo-quality.mdc` — chemin périmé `cloudinary.ts` → `cloudinary-presets.ts`
    - `hotel-image.tsx`.
- **1 réserve méthodologique persistante (hors contenu)** : la fiabilité de
  **déclenchement** des 4 MDC à `alwaysApply: false` **sans glob** (`01`, `14`,
  `20`, `commit-conventions`) dépend du matching de description par Cursor. Le
  run live ne l'isole pas (subagents héritant du contexte parent). À couvrir lors
  de l'arbitrage #128 (ADR-0028).

## 3. Tableau récapitulatif des verdicts

Légende Positif : ✅ = `conforme` · 🟡 = `conforme avec réserve` (étend
l'existant au lieu de dupliquer). Négatif : ✅ = `refus-ou-alerte`.

| #   | MDC                             | alwaysApply | Positif | Négatif | Verdict        | Note                              |
| --- | ------------------------------- | ----------- | ------- | ------- | -------------- | --------------------------------- |
| 1   | `01-project-overview`           | false       | ✅      | ✅      | ✅ PASS (live) | trigger par description (cf. §4)  |
| 2   | `10-seo-foundations`            | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 3   | `11-seo-multilingue`            | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 4   | `12-schema-ota`                 | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 5   | `14-agent-routing`              | false       | ✅      | ✅      | ✅ PASS (live) | trigger par description (cf. §4)  |
| 6   | `20-agents-overview`            | false       | ✅      | ✅      | ✅ PASS (live) | trigger par description (cf. §4)  |
| 7   | `30-programmatic-pages`         | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 8   | `31-hotel-page-blueprint`       | false       | ✅      | ✅      | ✅ PASS (live) | caveat ADR résolu (#127)          |
| 9   | `40-llms-txt-strategy`          | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 10  | `41-robots-agents-permissions`  | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 11  | `architecture-layers`           | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 12  | `code-conventions`              | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 13  | `commit-conventions`            | false       | ✅      | ✅      | ✅ PASS (live) | trigger par contexte commit (§4)  |
| 14  | `e2e-testing`                   | true        | 🟡      | ✅      | ✅ PASS (live) | R1 réserve : réutilise les seams  |
| 15  | `editorial-voice`               | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 16  | `hotel-detail-page`             | true        | ✅      | ✅      | ✅ PASS (live) | force-dynamic transitoire / ISR   |
| 17  | `integrations-api`              | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 18  | `itinerary-page`                | false       | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 19  | `nextjs-app-router`             | true        | ✅      | ✅      | ✅ PASS (live) | caveat ADR-0004 résolu (#127)     |
| 20  | `observability-perf`            | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 21  | `photo-quality`                 | true        | ✅      | ✅      | ✅ PASS (live) | caveat chemin résolu (#127)       |
| 22  | `seo-geo`                       | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |
| 23  | `skills-capitalisation`         | true        | 🟡      | ✅      | ✅ PASS (live) | R1 réserve : étend skill existant |
| 24  | `supabase-rls`                  | true        | 🟡      | ✅      | ✅ PASS (live) | R1 réserve : table 0021 identique |
| 25  | `user-acceptance-before-commit` | true        | 🟡      | ✅      | ✅ PASS (live) | R1 réserve : gate walk-through    |
| 26  | `security-csp`                  | true        | ✅      | ✅      | ✅ PASS (live) | —                                 |

## 4. Réserve déclenchement (lien avec #128)

Les 4 MDC à `alwaysApply: false` **et sans glob** (`01-project-overview`,
`14-agent-routing`, `20-agents-overview`, `commit-conventions`) ne se chargent
qu'au matching de **description** par Cursor. Le run live valide leur contenu,
pas leur probabilité de chargement réel (les subagents héritent du contexte de
règles du parent). C'est le **symétrique** du problème overlap traité en #128 :

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

- Run = **live (subagents readonly)**. Limite résiduelle : le run ne teste pas le
  _mécanisme d'auto-attach_ de Cursor en isolation (les subagents héritent du
  contexte de règles du parent). Le déclenchement réel des 4 MDC sans glob reste
  à confirmer dans le cadre de #128.
- Les statuts individuels sont inscrits dans chaque
  `docs/audits/mdc-test-scenarios/<mdc>.md` §5.
- Prochaine action de fond sur les MDC : **#128 (ADR-0028)**, indépendant de ce
  run. Une validation N2 ciblée sera rejouée sur les surfaces affectées après
  application de la décision #128.

## 6. Annexes

- Audit N1+N2 source : `docs/audits/2026-06-02-mdc-quality-audit.md`
- Scénarios : `docs/audits/mdc-test-scenarios/*.md` (26 fichiers)
- Issues : #126 (items F-bis, 4/5 fermés), #128 (overlap globs, candidat ADR-0028)
- PR Vague F-bis : #127 (squash `cf7e84b`)
