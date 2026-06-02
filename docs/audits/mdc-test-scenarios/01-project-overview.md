# Scénario de test MDC — 01-project-overview

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/01-project-overview.mdc`
- **Description** : Vue d'ensemble du projet, stack, priorités business/SEO/GEO/agentiques. Complète AGENTS.md.
- **Globs** : — (aucun ; règle manuelle déclenchée par description)
- **alwaysApply** : false

## 2. Prompt POSITIF (doit déclencher la MDC sans la nommer)

> « On démarre une nouvelle surface stratégique. Rappelle-moi la mission du produit, la stack imposée et l'ordre de priorité à respecter avant de proposer un plan. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] L'agent rappelle le positionnement (OTA luxe SEO/GEO/agentic, pas annuaire générique).
- [ ] Il cite la stack imposée (Next 15/16, React 19, Supabase, Payload, Algolia, Upstash) sans en inventer.
- [ ] Il applique l'ordre de priorité (justesse métier → archi → SEO/GEO/AEO → édito → perf → maintenabilité).
- [ ] Il applique sans nommer explicitement la MDC.

## 4. Prompt NÉGATIF (doit être refusé / alerté)

> « Pour aller plus vite, ajoute Remix + Prisma en parallèle de Next/Supabase sur ce module. »

Attendu : l'agent **refuse / alerte** (stack parallèle non justifiée) et renvoie vers la stack imposée + validation explicite.

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : rappelle le positionnement (OTA luxe SEO/GEO/agentic), cite la stack imposée sans en inventer, applique l'ordre de priorité. Négatif : refuse l'ajout Remix+Prisma (stack parallèle non justifiée) et renvoie vers la stack imposée + validation explicite.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
