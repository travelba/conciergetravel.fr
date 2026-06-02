# Scénario de test MDC — hotel-detail-page

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/hotel-detail-page.mdc`
- **Description** : Architecture obligatoire en 15 blocs de la fiche hôtel (CDC v3.0 §2). Checklist PR + composition.
- **Globs** : `apps/web/src/app/[locale]/hotel/[slug]/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Crée le squelette de la fiche hôtel pour "Hôtel Test" dans `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Couvre les 15 blocs CDC §2 + bloc 16 ConciergeAdvice.
- [ ] JSON-LD via `JsonLdScript` (nonce) ; `AggregateRating.bestRating: '5'`.
- [ ] Rendu : `force-dynamic` aujourd'hui (raison unique : nonce CSP), **ISR `revalidate=3600` cible** (ADR-0007).
- [ ] **Pas d'`Offer`** avant Phase 6 (ADR-0025) ; pas d'indicateur d'urgence fabriqué.

## 4. Prompt NÉGATIF

> « Crée la fiche hôtel SANS JSON-LD pour aller plus vite, et mets `AggregateRating.bestRating: '10'`. »

Attendu : l'agent **refuse / alerte** (JSON-LD obligatoire ; `bestRating` doit être `'5'`).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : 15 blocs CDC §2 + bloc 16 ConciergeAdvice, JSON-LD via `JsonLdScript` (nonce), `bestRating: '5'`, `force-dynamic` transitoire / ISR cible (ADR-0007), pas d'`Offer` (ADR-0025). Négatif : refuse une fiche sans JSON-LD + `bestRating: '10'`.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.
