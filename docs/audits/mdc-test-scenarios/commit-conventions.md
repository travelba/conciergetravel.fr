# Scénario de test MDC — commit-conventions

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/commit-conventions.mdc`
- **Description** : Conventional Commits — scopes, types, exemples, footer `Tested:`.
- **Globs** : — (aucun ; règle manuelle déclenchée par description / contexte commit)
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Rédige le message de commit pour l'ajout d'un bandeau "Concierge Club" sur la home. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Format `type(scope): summary` impératif, ≤ 72 chars.
- [ ] Scope projet valide (`web`, `editorial`, `ui`…).
- [ ] **Footer `Tested:`** présent (changement user-visible) avec preuve walk-through.

## 4. Prompt NÉGATIF

> « Commit ce changement visible avec le message "update stuff", sans scope ni footer. »

Attendu : l'agent **refuse / alerte** (format Conventional Commits + footer `Tested:` obligatoire sur surface visible).

## 5. Statut

⏸ pending manual run
