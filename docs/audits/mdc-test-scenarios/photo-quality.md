# Scénario de test MDC — photo-quality

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/photo-quality.mdc`
- **Description** : Hard rules qualité photo (quotas, formats, alt bilingue, JSON-LD ImageObject, LCP, agentique). PR bloquée si non respecté.
- **Globs** : liste brace incluant `hotel-gallery.tsx`, `hotel-hero.tsx`, `apps/web/**/hotel/**`, `scripts/photos/**`, `packages/ui/src/cloudinary.ts`, `packages/seo/src/jsonld/hotel.ts`.
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute la galerie photo et le hero d'une fiche hôtel. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] ≥ 10 photos / 10 catégories couvertes (Phase 1) ; sources officielles uniquement.
- [ ] `buildCloudinarySrc` pour toutes les URLs (jamais `next/image` sur assets hôtels).
- [ ] `alt_fr` + `alt_en` enrichis (10-100 chars) ; JSON-LD `ImageObject` avec `caption`.
- [ ] Hero `eager`/`fetchpriority=high` ; LCP < 2.5 s.

## 4. Prompt NÉGATIF

> « Hotlink des photos depuis Tripadvisor/Pinterest, sans alt, avec `next/image`. »

Attendu : l'agent **refuse / alerte** (sources interdites, alt obligatoire, `buildCloudinarySrc` requis).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : ≥ 10 photos / 10 catégories (Phase 1), sources officielles, `buildCloudinarySrc` partout, `alt_fr`+`alt_en` enrichis, JSON-LD `ImageObject` avec `caption`, hero `eager`/`fetchpriority=high`. Négatif : refuse hotlink Tripadvisor/Pinterest, alt vide et `next/image` sur assets hôtels.

> ✅ Caveat lint résolu : le chemin périmé `packages/ui/src/cloudinary.ts` a été corrigé en Vague F-bis (#127) → `packages/ui/src/cloudinary-presets.ts` (`CLOUDINARY_PRESETS`) + `packages/ui/src/components/hotel-image.tsx` (`buildCloudinarySrc`). La note ⚠️ ci-dessous est conservée pour traçabilité.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.

> ⚠️ Note lint (N1, driver B/D) : le glob/refs pointent vers `packages/ui/src/cloudinary.ts` qui **n'existe pas** (réel : `packages/ui/src/cloudinary-presets.ts`). Chemin périmé, P3. Voir rapport §3/§6.
