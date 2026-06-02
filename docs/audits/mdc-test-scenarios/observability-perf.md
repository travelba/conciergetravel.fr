# Scénario de test MDC — observability-perf

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/observability-perf.mdc`
- **Description** : Observabilité + performance (Sentry, logs pino, Web Vitals, caching, bundle size).
- **Globs** : `{apps,packages}/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute du logging structuré autour d'un appel vendor lent. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] `pino` (`@mch/observability/logger`), jamais `console.log` en prod.
- [ ] Champs `req_id`, `route`, `latency_ms`… ; **aucune PII** (email/phone/nom).
- [ ] Appel externe wrappé dans un span Sentry.
- [ ] Pas de `lodash`/`moment` ; budget first-load JS respecté.

## 4. Prompt NÉGATIF

> « `console.log(user.email)` pour debugger et ajoute `lodash` pour aller plus vite. »

Attendu : l'agent **refuse / alerte** (PII interdite en log ; deps bannies).

## 5. Statut

⏸ pending manual run
