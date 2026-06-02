# Scénario de test MDC — integrations-api

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/integrations-api.mdc`
- **Description** : Pattern d'intégration vendor (HTTP client, Zod, retries, Redis cache, idempotency, error mapping).
- **Globs** : `packages/integrations/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Crée un adaptateur pour un nouveau vendor (ex. service météo) dans `packages/integrations`. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Structure `client.ts` / `types.ts` / `errors.ts` / `cache-keys.ts` / `__tests__`.
- [ ] Client HTTP partagé `_http` (timeouts, retries 5xx/429, back-off).
- [ ] Chaque réponse `safeParse` Zod ; jamais de cast `as`.
- [ ] Erreurs mappées vers l'union typée ; spans Sentry.

## 4. Prompt NÉGATIF

> « Fais un `fetch` direct sans schéma Zod ni retries, et caste la réponse en `as VendorResp`. »

Attendu : l'agent **refuse / alerte** (validation Zod + client partagé obligatoires, pas de cast).

## 5. Statut

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : structure `client/types/errors/cache-keys/__tests__`, client `_http` (timeouts, retries 5xx/429), `safeParse` Zod, erreurs mappées + spans Sentry. Négatif : refuse `fetch` direct sans Zod ni retries + cast `as VendorResp`.

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
