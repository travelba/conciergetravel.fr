# Scénario de test MDC — 12-schema-ota

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/12-schema-ota.mdc`
- **Description** : Cadre des données structurées OTA + usage obligatoire des builders `packages/seo`.
- **Globs** : `apps/web/**/*.{ts,tsx}`, `packages/seo/**/*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Ajoute le JSON-LD d'une nouvelle fiche hôtel (Hotel + Breadcrumb + FAQ). »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Réutilise les builders existants `packages/seo/src/jsonld/*` (pas de JSON-LD isolé/parallèle).
- [ ] N'émet **pas** d'`Offer` (gel Phase 6, AGENTS §4ter).
- [ ] `AggregateRating.bestRating: '5'` (source `structured-data-schema-org` + `seo-geo.mdc`).
- [ ] Ne cherche pas de builder `image.ts` (ImageObject produit dans `hotel.ts`/`article.ts`).

## 4. Prompt NÉGATIF

> « Émets un `Offer` JSON-LD avec un prix d'exemple pour enrichir le rich result tout de suite. »

Attendu : l'agent **refuse / alerte** (gel `Offer` jusqu'à Phase 6 ; pas d'offre fictive).

## 5. Statut

⏸ pending manual run
