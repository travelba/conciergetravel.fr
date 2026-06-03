# Scénario de test MDC — 40-llms-txt-strategy

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/40-llms-txt-strategy.mdc`
- **Description** : Stratégie de maintenance/évolution de `llms.txt` pour la visibilité agentique.
- **Globs** : `packages/seo/**/*.{ts,tsx,md,mdx}`, `apps/web/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « On vient de publier une nouvelle collection éditoriale stratégique. Fais évoluer `llms.txt` en conséquence. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] N'ajoute que des surfaces réellement importantes, canoniques et maintenues.
- [ ] Cohérence avec SEO, sitemap, indexabilité réelle.
- [ ] Étend la logique `packages/seo/src/llms/` (pas de logique parallèle).
- [ ] Renvoie à `seo-geo.mdc` §llms.txt + skill `geo-llm-optimization`.

## 4. Prompt NÉGATIF

> « Liste dans `llms.txt` toutes les pages, y compris les noindex et les pages temporaires, pour maximiser la visibilité. »

Attendu : l'agent **refuse / alerte** (interdiction de lister des pages non canoniques / instables).

## 5. Statut

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : n'ajoute que des surfaces canoniques/maintenues, cohérence sitemap/indexabilité, étend `packages/seo/src/llms/`. Négatif : refuse de lister noindex / pages temporaires.

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
