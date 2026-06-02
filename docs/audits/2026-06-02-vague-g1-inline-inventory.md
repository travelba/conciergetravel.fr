---
title: Vague G-1 — Inventaire des inline scripts/styles (préalable migration CSP nonce → hash)
date: 2026-06-02
author: agent (Cursor)
branch: feat/vague-g1-csp-hash-migration (base main @ 914b725)
method: lecture seule (Grep + Read sur la worktree), aucune édition de code
scope: apps/web (proxy.ts, lib/security/csp.ts, components/**, app/**), packages/**
status: ÉTAPE 1 terminée — STOP avant Étape 2 (décision de stratégie requise)
---

# Vague G-1 — Inventaire inline scripts/styles

> **Objectif initial** : migrer la CSP de `nonce` (par requête) vers `hash` (statique)
> pour autoriser l'ISR sur les fiches hôtels.
>
> **Résultat de l'inventaire** : 🚨 **la migration nonce → hash telle que formulée
> n'est pas réalisable** sur cette app Next.js App Router. Détail + alternatives
> ci-dessous. Décision requise avant toute implémentation (Étape 2).

---

## 0. État CSP actuel (référence)

Source : [`apps/web/src/lib/security/csp.ts`](../../apps/web/src/lib/security/csp.ts) + [`apps/web/src/proxy.ts`](../../apps/web/src/proxy.ts).

```
script-src 'self' 'nonce-{random/req}' 'strict-dynamic'   (+ 'unsafe-eval' 'wasm-unsafe-eval' en dev)
style-src  'self' 'unsafe-inline'
```

- Nonce généré **par requête** dans `proxy.ts` (`generateNonce()`), exposé via header `x-nonce` + injecté dans la CSP.
- `proxy.ts` L48-51 : **Next.js applique automatiquement ce nonce à ses propres scripts inline** d'hydratation/streaming.
- `style-src` autorise **déjà** `'unsafe-inline'` → **aucun hash de style n'est nécessaire** (le volet "styles" de G-1 est sans objet).

---

## 1. Inventaire des surfaces inline

| #   | Fichier                                                                                                                                           | Type                                                                | Contenu                                                                                                         | SHA-256 statique ?                                                         | Criticité                                           | Reco                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | [`apps/web/src/components/seo/json-ld.tsx`](../../apps/web/src/components/seo/json-ld.tsx) L59-66                                                 | `<script type="application/ld+json">` via `dangerouslySetInnerHTML` | **Dynamique** : `JSON.stringify(data)` — diffère par hôtel / page (2219 fiches uniques + guides + classements…) | ❌ **Impossible** : le contenu varie par page, aucune valeur d'octets fixe | **P1** (présent sur fiche hôtel + toutes pages SEO) | Ni hash ni externalisation — voir §3 (décision de stratégie)                   |
| 2   | Scripts d'hydratation **Next.js** (`self.__next_f.push([...])`, bootstrap RSC/Flight) — injectés par le framework, **pas** de fichier source repo | `<script nonce>` inline                                             | **Dynamique** : payload RSC sérialisé, diffère par page et par build                                            | ❌ **Impossible** : contenu par page, non énumérable en hashes statiques   | **P1** (toutes les routes app)                      | Ne peut être couvert que par nonce (→ dynamique) — limitation Next.js, voir §3 |
| 3   | `style-src 'unsafe-inline'` (Tailwind, `next/font`, attrs style SSR)                                                                              | styles inline                                                       | n/a                                                                                                             | n/a — **déjà autorisé**                                                    | —                                                   | **Aucune action**                                                              |

**Surfaces explicitement absentes (vérifiées)** :

- ❌ Aucun `import … from 'next/script'` dans le code applicatif (`apps/web/**`).
- ❌ Aucun `<Script strategy="beforeInteractive">` avec code inline.
- ❌ Aucun styled-jsx (`<style jsx>`).
- ❌ Aucun `dangerouslySetInnerHTML` hors `json-ld.tsx` (grep global → 1 seul hit applicatif).
- ❌ Aucun `<script>` JS exécutable inline (theme/no-flash, analytics inline, etc.).
- ℹ️ `scripts/editorial-pilot/src/showcase/build-showcase.ts` émet un `<script ld+json>` mais c'est un **générateur HTML hors-app** (CLI), hors périmètre CSP runtime.

---

## 2. Pourquoi le hash statique ne couvre rien ici

Un `script-src 'sha256-…'` n'autorise un script inline **que si ses octets sont connus à l'avance** et **identiques à chaque réponse**. Or :

1. **JSON-LD (item 1)** : le payload encode des données par hôtel (nom, description, FAQ, breadcrumb, images…). Chaque fiche a un hash distinct → il faudrait **un hash par page** dans le header CSP. Le header CSP est posé par `proxy.ts` **avant** le rendu de la page (et indépendamment d'elle) : le proxy **ne connaît pas** le hash du JSON-LD de la page. Inénumérable et non synchronisable.
2. **Hydratation Next.js (item 2)** : le framework streame le payload RSC dans des `<script>` inline dont le contenu change par page. Next.js **ne propose pas** de mode "hash" pour ses scripts de bootstrap — sa doc officielle indique que **le CSP fort se fait via nonce, ce qui impose le rendu dynamique**. Les seules autres options framework sont `'unsafe-inline'` (interdit par `security-csp.mdc`, hard rule) ou subir le blocage.

**Conclusion** : il n'existe **0 inline script statique** à hasher. La cible "remplacer le nonce par des hashes" laisserait les items 1 et 2 **non couverts** → tous les scripts (y compris l'hydratation React) seraient **bloqués par le navigateur** → page cassée.

---

## 3. 🚨 Décision requise — la prémisse de G-1 doit être arbitrée

ADR-0013 (§Option B) avait **déjà rejeté** le hash build-time, et déféré le choix CSP à une **ADR-0018 (toujours non écrite)**. Le contexte a évolué depuis (gel booking Phase 6 = ADR-0025 → plus d'`Offer` Amadeus dynamique en Phase 1), **mais** cela ne débloque pas le hash : le JSON-LD éditorial reste par-page-dynamique et l'hydratation Next.js reste l'obstacle dur.

### Options réelles pour atteindre le _vrai_ but (perf/fraîcheur ISR sur fiches), à arbitrer

| Option                                                               | Principe                                                                            | Compatible CSP fort ?                              | Verdict préliminaire                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| **A — Hash statique (G-1 d'origine)**                                | Remplacer nonce par `sha256-…`                                                      | ❌ casse l'hydratation Next.js + JSON-LD dynamique | **Non viable** — à abandonner en l'état     |
| **B — `'unsafe-inline'` sur script-src**                             | Autoriser tout inline                                                               | ❌ régression sécurité majeure                     | **Interdit** (hard rule `security-csp.mdc`) |
| **C — PPR (Partial Prerendering, Next 15+)**                         | Shell statique pré-rendu + trous dynamiques (le nonce reste dans le trou dynamique) | ✅ garde nonce                                     | **Piste la plus moderne** — à spiker        |
| **D — `script-src-attr` / exception `ld+json`** (piste 3 d'ADR-0013) | Exception ciblée pour `type=application/ld+json`                                    | ⚠️ non standard, support navigateur partiel        | À évaluer (Chrome/Firefox récents)          |
| **E — Garder `force-dynamic` + optimiser le coût**                   | Accepter le dynamique, réduire le coût via Fluid Compute / cache CDN court          | ✅ statu quo CSP                                   | Fallback pragmatique                        |

### Recommandation de l'agent

**Ne pas implémenter l'Étape 2 telle qu'écrite** (retrait nonce + hash statique + `csp-hash-check.mjs`) : elle casserait la prod. À la place :

1. **Écrire ADR-0018** (déférée depuis ADR-0013) pour arbitrer entre **C (PPR)**, **D (`script-src-attr`)** et **E (force-dynamic optimisé)**.
2. Le feature flag `CSP_MODE=hash|nonce` (prévu en garde-fou) reste pertinent **uniquement** si une option génère réellement des hashes — ce qui n'est pas le cas des options C/D/E.
3. Conserver `export const dynamic`/`revalidate` **inchangés** (déjà hors-scope G-1 par garde-fou) tant que l'ADR-0018 n'a pas tranché.

---

## 4. Garde-fous respectés (Étape 1)

- ✅ Lecture seule : **aucune** édition de code applicatif (`proxy.ts`, `csp.ts`, `next.config`, `package.json` intacts).
- ✅ `feat/golden-template-airelles-fiche` + WIP non touchés (travail en worktree `cct-vague-f-edit`).
- ✅ Branche `feat/vague-g1-csp-hash-migration` partie de `main` à jour (`914b725`).
- ✅ Pas de modification de `export const dynamic` (réservé G-2) ni `revalidate` (réservé G-3).

---

_Fin de l'inventaire Étape 1. STOP — confirmation / arbitrage requis avant Étape 2._
