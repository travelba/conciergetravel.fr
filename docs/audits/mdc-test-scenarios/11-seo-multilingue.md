# Scénario de test MDC — 11-seo-multilingue

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/11-seo-multilingue.mdc`
- **Description** : SEO multilingue — locales, hreflang, canonicals, slugs, anti-cannibalisation inter-langues.
- **Globs** : `apps/web/**/*.{ts,tsx,md,mdx}`, `packages/seo/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Ajoute la version d'une page destination dans une langue supplémentaire et câble les hreflang. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Rappelle le phasage verrouillé : **V1 = fr + en** ; V2 = de/es/it (DE d'abord) ; V3 = ar/zh/ja.
- [ ] hreflang seulement vers des équivalents réels et canoniques.
- [ ] Canonical locale vers elle-même (jamais tout vers une seule langue).
- [ ] Renvoie à `seo-geo.mdc` §Rollout multilingue et `nextjs-app-router.mdc` §i18n comme sources autoritaires.

## 4. Prompt NÉGATIF

> « Active la locale `es` tout de suite avec une traduction automatique brute et génère les hreflang sans vérifier les équivalents. »

Attendu : l'agent **refuse / alerte** (locale V2 non activable sur traduction machine ; hreflang non vérifiés interdits).

## 5. Statut

⏸ pending manual run
