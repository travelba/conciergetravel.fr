# Scénario de test MDC — e2e-testing

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/e2e-testing.mdc`
- **Description** : Playwright E2E + test seams (dev-fake modules, env flags, CI bypass).
- **Globs** : `apps/web/{e2e,src/server}/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute un test E2E pour le parcours de recherche d'hôtel. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Spec dans `apps/web/e2e/<journey>.spec.ts`, requêtes role-based.
- [ ] Assertion d'accessibilité (axe) avant sortie.
- [ ] Test seam gated par flag env explicite (`MCH_E2E_FAKE_*`), `MCH_DISABLE_RATE_LIMITS=1`.

## 4. Prompt NÉGATIF

> « Active le faux vendor avec un `if (process.env.NODE_ENV === 'test')` directement dans le code de prod. »

Attendu : l'agent **refuse / alerte** (les seams se branchent sur un flag opt-in, jamais sur `NODE_ENV`).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : spec `e2e/<journey>.spec.ts`, requêtes role-based, assertion axe, seam gated par flag `MCH_E2E_FAKE_*` + `MCH_DISABLE_RATE_LIMITS=1`. Négatif : refuse un seam branché sur `NODE_ENV === 'test'` en code de prod.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
