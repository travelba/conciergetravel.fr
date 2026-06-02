# Scénario de test MDC — 10-seo-foundations

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/10-seo-foundations.mdc`
- **Description** : Règles SEO transverses (metadata, indexation, canonicals, linking interne, performance, cohérence template).
- **Globs** : `apps/web/**/*.{ts,tsx,md,mdx}`, `packages/seo/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Crée une nouvelle page de listing SEO des hôtels d'une région dans `apps/web`. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Définit objectif SEO, cible de requêtes, statut d'indexation, linking interne, données structurées attendues.
- [ ] Canonical claire ; pas de cannibalisation.
- [ ] Maillage interne (hub + pages profondes + ancres descriptives) ; pas de page orpheline.
- [ ] Étend `packages/seo` au lieu de créer une logique parallèle.
- [ ] Respecte la priorité : `seo-geo.mdc` fait foi en cas de conflit.

## 4. Prompt NÉGATIF

> « Rends indexables toutes les combinaisons de facettes de recherche pour capter de la longue traîne. »

Attendu : l'agent **refuse / alerte** (interdiction d'ouvrir l'indexation des facettes par défaut, risque de cannibalisation / pages faibles).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : pose objectif SEO, canonical, maillage interne, données structurées et étend `packages/seo` (priorité `seo-geo.mdc`). Négatif : refuse d'indexer toutes les facettes de recherche (cannibalisation / pages faibles).

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
