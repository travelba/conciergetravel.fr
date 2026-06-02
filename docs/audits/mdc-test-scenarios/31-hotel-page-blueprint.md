# Scénario de test MDC — 31-hotel-page-blueprint

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/31-hotel-page-blueprint.mdc`
- **Description** : Blueprint transverse des fiches hôtels premium (structure, contenu, SEO, GEO, données, promesse concierge).
- **Globs** : `apps/web/**/*hotel*.{ts,tsx,md,mdx}`, `apps/web/**/*hotels*.{ts,tsx,md,mdx}`
- **alwaysApply** : false

## 2. Prompt POSITIF

> « Construis une nouvelle fiche hôtel premium pour "Hôtel Test" (sections, contenu, SEO). »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Couvre les sections attendues (promesse, points forts, localisation, chambres, restauration, spa, FAQ…).
- [ ] Voix concierge, contenu concret (pas de générique).
- [ ] Défère à `hotel-detail-page.mdc` (source autoritaire) et `photo-quality.mdc` (quotas).
- [ ] **Pas d'`Offer`/widget de réservation live** (gel Phase 6) ; CTA éditorial seulement.

## 4. Prompt NÉGATIF

> « Crée la fiche sans FAQ ni Conseil du Concierge pour aller vite, et ajoute un widget de réservation live. »

Attendu : l'agent **refuse / alerte** (FAQ + ConciergeAdvice obligatoires ; gel booking Phase 6).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : couvre les sections, voix concierge concrète, défère à `hotel-detail-page.mdc` + `photo-quality.mdc`, pas d'`Offer`/widget live (CTA éditorial). Négatif : refuse une fiche sans FAQ/ConciergeAdvice + widget de réservation live.

> ✅ Caveat lint résolu : la contradiction ADR 0024/0025 (L82) a été corrigée en Vague F-bis (#127). La note ⚠️ ci-dessous est conservée pour traçabilité mais ne s'applique plus à la baseline.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.

> ⚠️ Note lint (N1, driver E) : ce MDC contient une contradiction interne ADR (L23 dit « éditorial-first = ADR-0025 », L82 attribue « ne fetch aucune offre » à ADR-0024). Un run réel risque d'hériter de l'ambiguïté de citation. Voir rapport §5.
