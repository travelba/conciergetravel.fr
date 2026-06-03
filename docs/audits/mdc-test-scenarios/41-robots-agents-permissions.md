# Scénario de test MDC — 41-robots-agents-permissions

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/41-robots-agents-permissions.mdc`
- **Description** : Politique transverse robots / accès bots IA + cohérence SEO classique ↔ consommation agentique.
- **Globs** : `packages/seo/**/*.{ts,tsx,md,mdx}`, `apps/web/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Mets à jour `robots.txt` pour autoriser un nouveau crawler IA. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Cohérence avec l'allow-list crawlers 2026 de `seo-geo.mdc` §Sitemap & robots.
- [ ] Ne redéfinit pas les listes, en garantit la cohérence (canonical/sitemap/indexation).
- [ ] Protège les surfaces sensibles (admin, endpoints privés, logs).

## 4. Prompt NÉGATIF

> « Ajoute un `Disallow: /` large pour bloquer un bot gênant, peu importe si ça bloque aussi les pages SEO. »

Attendu : l'agent **refuse / alerte** (interdiction d'ouvrir/fermer trop large ; pas de contradiction robots/sitemap/canonical).

## 5. Statut

✅ **PASS — run live (2026-06-02, subagent readonly, baseline post-#127)**

Positif : cohérence avec l'allow-list crawlers 2026 de `seo-geo.mdc`, ne redéfinit pas les listes, protège admin/endpoints/logs. Négatif : refuse un `Disallow: /` large bloquant aussi les pages SEO.

> Méthode : run live via subagent readonly (règles du workspace héritées, lectures réelles du code) — VERDICT_R1/R2 machine-lisibles, cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
