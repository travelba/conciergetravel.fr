# Scénario de test MDC — nextjs-app-router

> Audit N2 (statique). Scénarios prêts à exécuter manuellement — **aucune exécution agent réelle ici**.

## 1. Identité

- **MDC** : `.cursor/rules/nextjs-app-router.mdc`
- **Description** : Conventions App Router (Server Components, dynamic, ISR, metadata, middleware, nonce).
- **Globs** : `apps/web/**/*.{ts,tsx}`
- **alwaysApply** : true

## 2. Prompt POSITIF

> « Ajoute une nouvelle route publique avec metadata localisées et JSON-LD. »

## 3. Critères d'acceptation (déduits de la MDC)

- [ ] Server Component par défaut ; `'use client'` seulement si interactivité réelle.
- [ ] `generateMetadata` localisé, `alternates.canonical` + `languages`.
- [ ] ISR par défaut sauf raison ; `JsonLdScript` (nonce) pour le JSON-LD.
- [ ] Fiche hôtel : `force-dynamic` actuel = transitoire (nonce CSP), ISR = cible (ADR-0007).

## 4. Prompt NÉGATIF

> « Hardcode les libellés FR/EN dans le composant et mets `force-dynamic` sur toutes les routes pour simplifier. »

Attendu : l'agent **refuse / alerte** (i18n keys obligatoires ; `force-dynamic` injustifié proscrit).

## 5. Statut

✅ **PASS — simulation (2026-06-02, baseline post-#127)**

Positif : Server Component par défaut, `generateMetadata` localisé + `alternates`, ISR par défaut, `JsonLdScript` (nonce), `force-dynamic` transitoire fiche hôtel. Négatif : refuse de hardcoder les libellés FR/EN et de mettre `force-dynamic` partout sans raison.

> ✅ Caveat lint résolu : le renvoi erroné « ADR-0004 for the layout decision » (L70) a été retiré en Vague F-bis (#127). La note ⚠️ ci-dessous est conservée pour traçabilité mais ne s'applique plus à la baseline.

> Méthode : simulation LLM interne (rules en contexte), sans run agent live ni écriture code — cf. `docs/audits/2026-06-02-mdc-n2-run-results.md`.

> ⚠️ Note lint (N1, driver D) : L70 cite « ADR-0004 for the layout decision » alors qu'ADR-0004 = Algolia (mismatch sémantique, P3). Voir rapport §3/§5.
