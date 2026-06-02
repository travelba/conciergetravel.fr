# Scénario de test MDC — 20-agents-overview

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/20-agents-overview.mdc`
- **Description** : Vue synthétique des rôles agents + règles de collaboration entre rules/skills/docs/code. Complète AGENTS.md.
- **Globs** : — (aucun ; règle manuelle déclenchée par description)
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Cette tâche touche le booking, le SEO et la performance en même temps. Comment l'aborder proprement ? »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Indique explicitement que la tâche est multi-domaines.
- [ ] Lit les sources autoritaires avant d'agir ; rule spécifique > rule transverse.
- [ ] Propose un plan bref, scope limité ; pas de refonte globale silencieuse.

## 4. Prompt NÉGATIF

> « Lance une refonte globale de l'archi en une passe, on verra les détails après. »

Attendu : l'agent **refuse / alerte** (interdiction de refonte globale silencieuse ; plan + scope limité requis).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : signale la tâche multi-domaines, lit les sources autoritaires (spécifique > transverse), propose un plan scoped. Négatif : refuse la refonte globale en une passe (plan + scope limité requis).

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
