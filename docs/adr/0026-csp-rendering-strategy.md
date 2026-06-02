# ADR-0026 — CSP × Rendering Strategy for Hotel Pages

- Status: Proposed
- Date: 2026-06-02
- Deciders: TBD (architecture review)
- Supersedes: —
- Superseded by: —
- Related: ADR-0007 (ISR target), ADR-0013 (CSP strategy), ADR-0024 (photo transform), ADR-0025 (editorial-first / gel booking)

> **Note de numérotation** : cette ADR a été désignée « ADR-0018 » dans
> ADR-0013 §C et dans l'inventaire `docs/audits/2026-06-02-vague-g1-inline-inventory.md`.
> Le numéro 0018 ayant été attribué entre-temps à
> `0018-env-vars-vercel-source-of-truth.md`, la décision CSP × rendering est
> publiée sous le **n° 0026** (prochain libre). Les pointeurs « ADR-0018 »
> de ADR-0013 et de l'inventaire G-1 sont donc périmés et renvoient en
> réalité ici.

## Context

ADR-0013 a posé une CSP stricte avec `script-src 'self' 'nonce-<per-request>'`,
incompatible avec un rendu statique (ISR) car le nonce doit être généré par requête.
Pour cette raison, les fiches hôtels (`app/hotels/[slug]/page.tsx`) sont actuellement
en `export const dynamic = 'force-dynamic'`, ce qui contredit la cible ADR-0007 (ISR
`revalidate = 3600`).

La Vague F (docs/rules) a documenté cette incohérence comme **transitoire** (raison
technique unique : nonce CSP par requête). La Vague G-1 a tenté la migration
`nonce → hash` et l'a invalidée par inventaire (voir
`docs/audits/2026-06-02-vague-g1-inline-inventory.md`) :

- JSON-LD per-page : 2219 fiches uniques, aucun octet fixe hashable.
- Hydratation Next.js (`self.__next_f.push`) : payload RSC streaming, dynamique par page.
- `script-src 'unsafe-inline'` interdit (hard rule `security-csp.mdc`).

ADR-0013 avait explicitement déféré le choix final à cette ADR (alors désignée
« ADR-0018 »), jamais rédigée jusqu'ici. Cette dette de gouvernance est désormais
résolue.

## Decision drivers

- **D1** — Honorer ADR-0007 (ISR, `revalidate = 3600`) sur les fiches hôtels, ou amender ADR-0007 si infaisable.
- **D2** — Préserver la CSP stricte (`security-csp.mdc`), refus de `'unsafe-inline'` sur `script-src`.
- **D3** — Performance utilisateur : LCP P75 mobile < 2.5s, TTFB P75 < 600ms, cache hit CDN > 90%.
- **D4** — Coût d'infrastructure (Vercel Fluid Compute, bande passante CDN).
- **D5** — Coût d'implémentation (j.h, risque régression, réversibilité).
- **D6** — Compatibilité Next.js App Router + RSC streaming + Sanity CMS.
- **D7** — Maintenance long terme (surface dette technique, alignement écosystème).

## Considered options

### Option α — Partial Prerendering (PPR)

Shell statique pré-rendu (CSP avec hash) + îlots dynamiques (CSP avec nonce sur les
seuls îlots streamés). Feature Next.js (canary/experimental selon version).

**Pros**

- Aligne ADR-0007 sur le shell (cache CDN, ISR sur la coquille).
- Préserve la CSP nonce uniquement là où c'est nécessaire (îlots dynamiques).
- Modèle moderne, direction officielle Vercel/Next.js.

**Cons**

- Statut PPR : à vérifier sur la version Next.js du repo (experimental jusqu'à v15.x stable).
- Complexité de découpage shell/îlots (refactor RSC).
- JSON-LD per-page doit être placé dans le shell ou éligible au pré-rendu — non trivial avec 2219 fiches.
- Risque de régression hydratation si la frontière shell/îlot mal placée.

**Effort estimé** : 5–8 j.h + 2 semaines de surveillance preview.

### Option β — `script-src-attr 'unsafe-hashes'` + retour ISR sur shell

Conserver le rendu statique (ISR) pour le shell, déléguer les scripts inline
(hydratation, JSON-LD) à une CSP qui autorise les handlers via `'unsafe-hashes'` +
liste de hashes SHA-256 des handlers connus.

**Pros**

- ISR runtime atteint sans PPR (pas de dépendance à une feature experimental).
- Compatible Next.js App Router stable.
- Réversible (toggle CSP).

**Cons**

- `'unsafe-hashes'` affaiblit la CSP (autorise les event handlers inline).
- Maintenance des hashes : à chaque build, recalcul + update header.
- JSON-LD per-page reste un problème (payload variable) — nécessite externalisation ou pré-calcul.
- Hydratation RSC `self.__next_f.push` : nécessite de hasher le bootstrap inline généré par Next.js, qui change à chaque release Next.

**Effort estimé** : 3–5 j.h + outillage hash-check + 1 semaine surveillance.

### Option γ — `force-dynamic` permanent optimisé

Acter `force-dynamic` comme permanent (amender ADR-0007 en conséquence), optimiser
le coût/perf par : cache CDN court (s-maxage=60 stale-while-revalidate=3600), Fluid
Compute, JSON-LD edge-cached, transform photo ADR-0024 sur Vercel Image.

**Pros**

- Zéro refactor, prod stable.
- CSP nonce préservée, sécurité maximale.
- Hydratation Next.js native, aucun risque régression.

**Cons**

- Manque ADR-0007 (ISR) — il faudrait l'amender en "ISR via cache CDN, pas via runtime statique Next.js".
- Coût Fluid Compute récurrent (à chiffrer : ~X €/mois sur 2219 fiches × trafic estimé).
- Cache hit CDN dépend de la stratégie de clés (vary headers, cookies).
- Dette philosophique : "transitoire" devient "permanent" dans les MDC (à refléter en Vague F-bis).

**Effort estimé** : 1–2 j.h (tuning cache headers) + audit coût.

## Decision

**TBD** — cette ADR est en statut `Proposed`. La décision sera tranchée lors de
la revue d'architecture après évaluation chiffrée des trois options.

### Critères de tranche (à valider en revue)

| Critère                   | α PPR          | β script-src-attr  | γ force-dynamic opt. |
| ------------------------- | -------------- | ------------------ | -------------------- |
| Aligne ADR-0007           | ✅             | ✅                 | ⚠️ (amende)          |
| Préserve CSP stricte      | ✅             | ⚠️ (unsafe-hashes) | ✅                   |
| LCP P75 cible             | ✅ probable    | ✅ probable        | ⚠️ dépend cache      |
| Coût €/mois               | faible         | faible             | moyen-élevé          |
| Effort j.h                | 5–8            | 3–5                | 1–2                  |
| Risque régression         | moyen          | moyen              | faible               |
| Réversibilité             | moyenne        | bonne              | excellente           |
| Compatibilité Next stable | dépend version | ✅                 | ✅                   |
| Maintenance long terme    | bonne          | moyenne            | bonne                |

## Consequences

### Si α retenue

- Vague G-2 réécrite : "Découpage PPR shell/îlots fiches hôtels".
- ADR-0007 confirmée.
- MDC Vague F maintenue (`force-dynamic` reste "transitoire", remplacé par PPR).
- Pré-requis : valider la version Next.js et le statut PPR (stable | canary | experimental).

### Si β retenue

- Vague G-2 : "Migration ISR + script-src-attr 'unsafe-hashes'".
- Amendement `security-csp.mdc` pour autoriser `'unsafe-hashes'` (revue sécu obligatoire).
- ADR-0007 confirmée.
- Outillage hash-check au build.

### Si γ retenue

- Vague G clôturée sans G-2/G-3.
- ADR-0007 amendée : "ISR effectif via cache CDN s-maxage, pas via runtime statique".
- Vague F-bis (doc) : `force-dynamic` requalifié de "transitoire" à "permanent justifié".
- Audit coût mensuel ajouté au runbook.

## Alternatives rejected

- **Hash build-time pur** (option B d'ADR-0013) : rejeté par ADR-0013, confirmé par inventaire G-1 (payload RSC variable).
- **`'unsafe-inline'`** : interdit par `security-csp.mdc`.
- **Désactivation hydratation React** : non-démarreur, casse l'app.
- **Self-hosting Next.js custom** pour patcher l'hydratation : effort prohibitif, dette infinie.

## References

- ADR-0007 — ISR target for hotel pages
- ADR-0013 — CSP strategy (déféra à cette ADR, alors désignée « ADR-0018 »)
- ADR-0024 — Photo transform pipeline
- ADR-0025 — Editorial-first / gel booking
- `docs/audits/2026-06-02-vague-g1-inline-inventory.md` — inventaire CSP G-1
- `.cursor/rules/security-csp.mdc` — hard rule CSP
- Next.js docs — Partial Prerendering
- MDN — CSP `'unsafe-hashes'`, `script-src-attr`
