# Scénario de test MDC — architecture-layers

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/architecture-layers.mdc`
- **Description** : DDD bounded contexts + layering (4 couches, allow-list d'imports par couche).
- **Globs** : `{packages,apps}/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute une règle métier de calcul de tier de fidélité dans le projet. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] La logique pure va dans `packages/domain/` (aucun `fetch`, `next/*`, `@supabase/*`, `Date.now()`, `Math.random()`).
- [ ] Clock/randomness injectés ; retourne un `Result<T, E>`.
- [ ] Les couches basses n'importent jamais les couches hautes.

## 4. Prompt NÉGATIF

> « Importe `@supabase/...` et `fetch` directement dans `packages/domain` pour récupérer les données du membre. »

Attendu : l'agent **refuse / alerte** (I/O interdit dans la couche domaine).

## 5. Statut

⏸ pending manual run
