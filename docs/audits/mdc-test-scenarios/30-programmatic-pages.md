# Scénario de test MDC — 30-programmatic-pages

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/30-programmatic-pages.mdc`
- **Description** : Contrat commun des pages programmatiques SEO (destinations, zones, collections, rankings, surfaces dérivées).
- **Globs** : `apps/web/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Génère une série de pages "meilleurs hôtels à <ville>" à partir du catalogue. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Chaque page a une intention claire, un angle éditorial réel, un bloc utile, du maillage interne.
- [ ] Différenciation vérifiée (pas de cannibalisation entre pages proches).
- [ ] index/noindex, canonical, schémas et place sitemap définis explicitement.
- [ ] Renvoie aux sources : `seo-geo.mdc` + skill `editorial-rankings-matrix`.

## 4. Prompt NÉGATIF

> « Publie 500 pages quasi-dupliquées à texte à peine modifié pour couvrir toutes les variantes de requêtes. »

Attendu : l'agent **refuse / alerte** (interdiction de pages faibles/interchangeables et de textes répétitifs).

## 5. Statut

⏸ pending manual run
