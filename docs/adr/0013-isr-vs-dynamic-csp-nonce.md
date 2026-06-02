# ADR 0013 — ISR sur fiche hôtel : isolement de l'islet `searchParams`

- Status: accepted
- Date: 2026-05-20
- Refs: [ADR-0007](0007-isr-via-auth-client-island.md), rule `nextjs-app-router`, rule `observability-perf`, skill `performance-engineering`

## Décision

On rebascule `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` en **ISR (`revalidate = 3600`)** en isolant les seuls inputs request-bound (`searchParams` du formulaire de séjour + nonce CSP du `BookingWidget`) dans un **client island** dédié `<BookingWidgetIsland>`. La page Server Component redevient pré-rendable ; les `<JsonLdScript>` continuent à recevoir le nonce via un `cache()`-wrapper qui lit `headers()` paresseusement et **n'est invoqué que par les composants serveur qui ont besoin du nonce** (pas par la page top-level).

Stratégie retenue : **option C (hybride)** parmi les trois envisagées.

| Option                                                | Approche                                                                                                                                              | Verdict                                                                                                                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — auth client island étendue**                    | Étendre le pattern ADR-0007 à `searchParams` : passer toutes les dates en client island                                                               | Rejetée : nécessite de re-fetch côté client le prix Amadeus + comparator, dégrade LCP perçu sur la Decision Bar.                                                                                                   |
| **B — CSP hash build-time**                           | Calculer `script-src 'self' 'sha256-...'` à la build au lieu d'un nonce per-request                                                                   | Rejetée pour cette fiche : empêche d'injecter du JSON-LD dynamique (offres Amadeus dont les valeurs varient par requête) et casse le pattern `JsonLdScript` partagé avec le tunnel.                                |
| **C — hybride statique + client island Decision Bar** | RSC en ISR pour 100% du contenu éditorial + JSON-LD non transactionnel, client island pour le formulaire dates/occupants + récup du prix live Amadeus | **Retenue.** Compromis optimal : LCP CDN < 1.2s, Decision Bar hydratée en parallèle, JSON-LD éditoriaux pré-rendus avec nonce statique (utilisation de `getCspNonce()` qui gère le cas ISR via fallback `'self'`). |

## Contexte

ADR-0007 (Sprint 4.1) avait basculé la fiche hôtel en `revalidate = 3600` après extraction de l'auth area en client island. Une régression introduite dans une PR Phase 11.8 a forcé le retour à `force-dynamic` ([page.tsx L84-112](../../apps/web/src/app/[locale]/hotel/[slug]/page.tsx)) à cause de la combinaison :

- `searchParams` (dates / occupants) lus directement dans le Server Component pour pré-remplir le formulaire et le `PriceComparator`
- `headers()` lus pour récupérer le nonce CSP forwardé à chaque `<JsonLdScript>`
- L'erreur Next.js 15 `DYNAMIC_SERVER_USAGE` au build sur tout chemin statique exigeant ces APIs

Conséquences mesurées en production (mai 2026) :

- LCP médian fiche hôtel : 1.8s (vs cible 1.2s avec ISR chaud)
- Coût Vercel Function : ~1.4 invocation par vue (vs ~0.05 attendu avec hit ratio CDN > 95%)
- Hit ratio CDN : 0% sur les fiches hôtel (route opt-out cache)

## Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│  page.tsx (RSC, revalidate = 3600)                         │
│  - Lit Supabase, Amadeus sentiment (cache Redis), POIs,     │
│    awards, FAQ, ConciergeAdvice, story, etc.                │
│  - Compose tous les <JsonLdScript> éditoriaux (Hotel,       │
│    BreadcrumbList, FAQPage, HowTo, Events, ItemList)        │
│  - Rend <BookingWidgetIsland> avec props sérialisables :    │
│      { hotelId, bookingMode, defaultStay, priceFromMinor,   │
│        currency, locale }                                   │
│  - Pas d'appel à `headers()` ni `searchParams` au top-level │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  <BookingWidgetIsland> ('use client')                       │
│  - Lit `useSearchParams()` pour pré-remplir dates/occupants │
│  - Fetch live offers via /api/hotel/[id]/best-offer         │
│    (route handler dynamic, cache Redis 5 min)               │
│  - Émet les events analytics (Track 0)                      │
│  - Génère son propre `<script type="application/ld+json">`  │
│    pour l'Offer JSON-LD via /api/hotel/[id]/offer-jsonld    │
│    si nécessaire (B3)                                       │
└─────────────────────────────────────────────────────────────┘
```

## Conséquences

### Positives

- **LCP CDN chaud < 1.2s** sur la fiche (cible web vitals).
- **Hit ratio CDN > 90%** attendu, coûts Vercel Function divisés par ~20.
- **Re-utilisation pattern ADR-0007** étendu (auth island + booking island).
- **JSON-LD éditorial pré-rendu** = lu par les bots Google et LLM crawlers sans round-trip réseau.

### Négatives

- **Le formulaire booking n'est pas dans le HTML initial.** Atténué par : (1) skeleton dimensionné au pixel près de la Decision Bar, (2) hydratation parallèle aux autres scripts, (3) les bots de réservation (Booking.com scrapers) ne sont pas notre cible — on veut Google + LLMs.
- **L'Offer JSON-LD n'est plus pré-rendu** côté serveur ISR (le prix change par dates). Mitigation B3 : un Offer "starting at" générique (price = `priceFromMinor`, `priceValidUntil` = today + 30 jours) est rendu par le RSC ; un Offer raffiné par-dates est rendu côté client island. Google indexe le générique, c'est suffisant.
- **`PriceComparator`** (Makcorps/Apify) reste un client island séparé : pas d'impact.

## Plan de migration

1. Créer `<BookingWidgetIsland>` (A1) qui contient la logique formulaire dates + dates fetcher.
2. Extraire le pré-fetch best-rate Amadeus dans `/api/hotel/[id]/best-offer` (A3 + A4).
3. Supprimer la lecture `searchParams` du top-level Server Component (la page n'a plus besoin que de `params`).
4. Le nonce CSP : utiliser `getCspNonce()` helper qui retourne le nonce request s'il est lisible OR `null` ; passer `null` aux `JsonLdScript` ISR (CSP les couvre via `'self'` + hash inline le cas échéant, ou bien on injecte les JSON-LD via `<Script id strategy="beforeInteractive">` Next.js qui gère le nonce automatiquement).
5. `export const revalidate = 3600;` + suppression `export const dynamic = 'force-dynamic'`.

## Plan de rollback

Si LCP régresse ou si les JSON-LD ne se chargent plus en production (CSP rejection observable dans Sentry `csp-violation` events) :

1. Réactiver `export const dynamic = 'force-dynamic'` (1 ligne, déploiement immédiat).
2. Retirer `<BookingWidgetIsland>` du tree ou le wrap dans un Suspense avec fallback Server Component (`<BookingWidgetServer>` re-créé à cette occasion).
3. Aucun changement DB ni migration à revert.

## Validation

- **Build** : `pnpm --filter @mch/web build` doit passer sans `DYNAMIC_SERVER_USAGE`.
- **Lighthouse CI** : LCP < 1.5s sur 3 fiches échantillons (Le Bristol, Four Seasons George V, La Réserve Paris).
- **Smoke E2E** : `apps/web/e2e/hotel-detail-decision-first.spec.ts` (nouveau spec, voir plan Tests).
- **Sentry** : aucune nouvelle erreur `csp-violation` 24h après prod.
- **Vercel Analytics** : hit ratio CDN > 80% à J+7 sur `/hotel/*`.

## Notes

- L'ADR-0007 reste **valide** sur sa décision propre (auth area = client island). On l'étend ici à la Decision Bar.
- Cette décision n'affecte **pas** les routes `/reservation/*` (tunnel transactionnel), qui restent `force-dynamic` à dessein.
- Pour les fiches en attente d'indexation EN/V2 (DE/ES/IT), le pattern est identique : ISR + island.

## Statut d'implémentation (C1 — sprint mai 2026)

| Phase                 | Statut     | Composants livrés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Foundations**   | ✅ done    | `BookingWidgetUrlHydrator` (apps/web/src/components/hotel/booking-widget-url-hydrator.tsx), helper `getCspNonceOrNull` (apps/web/src/lib/security/csp.ts), Offer JSON-LD générique branché (B3)                                                                                                                                                                                                                                                                                                                                                                 |
| **B — Page flip**     | ⏸ deferred | `export const dynamic = 'force-dynamic'` reste en place tant que la CSP `strict-dynamic` n'a pas d'échappatoire pour les scripts `type="application/ld+json"` sans nonce.                                                                                                                                                                                                                                                                                                                                                                                       |
| **C — CSP exception** | 🔜 next PR | Trois pistes : (1) basculer JSON-LD vers `<Script strategy="beforeInteractive">` (Next.js gère le nonce auto, mais le nonce reste request-bound), (2) introduire un build-time hash dans la CSP `script-src` (incompatible avec le rendu dynamique d'offres Amadeus), (3) ajouter `script-src-attr` permissif uniquement pour les scripts `type="application/ld+json"` (non standard mais Chrome 122+/Firefox 124+ honorent). Choix finalisé dans **ADR-0026** (`0026-csp-rendering-strategy.md`) — le n° 0018 ayant été attribué entre-temps à l'ADR env-vars. |

Conséquence opérationnelle : la fiche reste en `force-dynamic` pour cette tranche, mais tous les contre-poids (URL hydrator + nonce-tolerant helper + Offer JSON-LD pré-rendu via best-offer cache Redis) sont en place. Bascule effective décidée dans la PR Phase B.
