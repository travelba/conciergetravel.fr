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

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : logique pure dans `packages/domain/` (clock/randomness injectés, `Result<T,E>`), couches basses n'importent pas les hautes. Négatif : refuse `@supabase/*` + `fetch` dans `packages/domain` (I/O interdit dans la couche domaine).

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
