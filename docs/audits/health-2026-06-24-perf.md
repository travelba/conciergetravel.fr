# Audit PERFORMANCE / vitesse prod — `myconciergehotel.com`

- **Date** : 2026-06-24
- **Worker** : Audit PERFORMANCE / vitesse prod (read-only)
- **Cibles projet** (`.cursor/rules/observability-perf.mdc`) : LCP ≤ 2,5 s mobile
  mid-tier · first-load JS < 180 KB gzip (marketing) · CLS < 0,1.
- **Méthode** : `curl.exe` + `Measure-Command` depuis Windows/PowerShell sur la
  prod live. **Pas de run navigateur** : Lighthouse a échoué (`No Chrome
installations found` — confirmé, attendu sur ce poste). Toutes les valeurs
  ci-dessous sont **mesurées** (poids, en-têtes, TTFB, tailles de bundle), sauf
  les Core Web Vitals terrain (LCP/CLS/INP réels) qui exigent un vrai navigateur
  — explicitement signalés en fin de rapport.

---

## Verdict

**Score perf : 6 / 10.**

Les fondamentaux « front » sont excellents : `next/image` partout avec
dimensions explicites (anti-CLS), Cloudinary `f_auto,q_auto:good`, lazy-loading
sous la flottaison, hero préchargé (`rel=preload as=image`), polices woff2
auto-hébergées via `next/font`, carte Mapbox **statique** (aucun `mapbox-gl`
JS), et une **isolation tierce quasi parfaite** (les images passent par
l'optimiseur Next same-origin ; le seul appel cross-origin navigateur réel est
l'image statique `api.mapbox.com`). Aucun script Sentry/GTM/analytics
render-blocking dans le HTML.

Deux problèmes structurels plombent le score :

1. **Aucune mise en cache CDN** sur toutes les pages HTML catalogue/marketing —
   `no-store` + `X-Vercel-Cache: MISS` à **chaque** requête → SSR dynamique →
   **TTFB mesuré 0,7 à 2,2 s**. Sur `/classement/*` et `/destination/*` le TTFB
   atteint 2,2 s, ce qui épuise quasiment seul le budget LCP de 2,5 s avant le
   moindre pixel.
2. **First-load JS ≈ 489 KB gzip** (home) / **≈ 506 KB** (fiche hôtel) — soit
   ~2,7× le budget de 180 KB.

---

## Mesures brutes

### 1. Poids de réponse + TTFB (3 échantillons curl `--compressed`)

| Page                                     | HTML brut                 | gzip fil | TTFB (min–max)    | X-Vercel-Cache  |
| ---------------------------------------- | ------------------------- | -------- | ----------------- | --------------- |
| `/` (home FR)                            | 596 656 B (583 KB)        | ~125 KB  | 0,87 – 1,26 s     | **MISS**        |
| `/en` (home EN)                          | 566 958 B (554 KB)        | —        | 1,25 s            | **MISS**        |
| `/hotel/le-meurice` (FR)                 | **1 023 304 B (1,02 MB)** | ~189 KB  | 0,74 – 1,01 s     | **MISS**        |
| `/en/hotel/le-meurice`                   | 979 707 B (957 KB)        | —        | 1,45 s            | **MISS**        |
| `/classement/meilleurs-palaces-provence` | 708 004 B (692 KB)        | ~163 KB  | 0,44 – **2,22 s** | **MISS**        |
| `/destination/paris`                     | 724 072 B (707 KB)        | —        | ~2,1 s            | **MISS**        |
| `/le-concierge-club`                     | 535 556 B (523 KB)        | —        | 0,78 s            | **MISS**        |
| `_next/static/*.js` (asset)              | —                         | —        | **0,04 – 0,06 s** | **HIT**         |
| `_next/image` (hero 1280w)               | 204 696 B (jpeg)          | —        | 0,19 s            | MISS→cache 30 j |

> **Page > 1 MB HTML : la fiche hôtel FR (1,02 MB brut).** La cause est le
> payload RSC inline (113 appels `self.__next_f.push` vs 58 sur la home) — DOM
> SSR riche + données flight sérialisées dans le HTML.

### 2. En-têtes de cache

- **Toutes les pages HTML** :
  `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`,
  `X-Vercel-Cache: MISS`, `Age: 0` — **systématique, à chaque requête**.
- **Assets statiques** (`/_next/static/chunks/*.js|*.css`, fonts) :
  `Cache-Control: public, max-age=31536000, immutable`, `X-Vercel-Cache: HIT`,
  `Content-Encoding: gzip` (brotli pour les navigateurs réels). ✅ parfait.
- **Images optimisées** (`/_next/image`) :
  `Cache-Control: public, max-age=2592000, must-revalidate` (30 j), CDN cachées
  après 1er hit, format négocié (jpeg en curl, avif/webp en navigateur). ✅

### 3. Élément LCP

**Home** — hero `/kit/img/hero.jpg` via `next/image` mode `fill` :

- ✅ Préchargé : `<link rel="preload" as="image" imageSrcSet="…hero.jpg…" imageSizes="100vw">`.
- ✅ Non lazy (`class="hero-bg"`, pas de `loading="lazy"`).
- ⚠️ **Pas de `fetchpriority="high"`** sur le `<img>`.
- ⚠️ Asset JPG local servi par l'optimiseur Next (pas Cloudinary `f_auto`) — Next
  négocie quand même avif/webp, impact mineur.

**Fiche hôtel** — mosaïque hero, 2 tuiles Cloudinary :

- ✅ Préchargées : 2× `<link rel=preload as=image>` (`places-9` 1200×900 `imageSizes=50vw`, `places-2` 900×675).
- ✅ `loading="eager"`, **width/height explicites** (`600×450`), `f_auto,q_auto:good,c_fill,g_center`.
- ⚠️ **`fetchpriority="high"` = 0 sur toute la page** (le preload couvre l'essentiel, mais l'attribut manque).

### 4. Images (anti-CLS / lazy / dimensions)

|                    | Home               | Fiche hôtel                                                  |
| ------------------ | ------------------ | ------------------------------------------------------------ |
| `<img>` total      | 22                 | 35                                                           |
| `loading="lazy"`   | 21                 | 24                                                           |
| `loading="eager"`  | 0 (hero en `fill`) | 11 (mosaïque + carte)                                        |
| `width=` explicite | —                  | 20 (les 15 restants sont `fill`, dimensionnés par conteneur) |

✅ Dimensions explicites sur les images non-`fill`, lazy sous la flottaison,
Cloudinary `f_auto,q_auto:good,c_fill,g_auto`, **aucune image surdimensionnée**
détectée (tailles bornées par `sizes` + srcset Next). Les images `fill` sont
positionnées en `absolute inset-0` dans un conteneur dimensionné → pas de CLS.

### 5. JavaScript (first-load)

| Page        | chunks | **gzip fil total** | brut total |
| ----------- | ------ | ------------------ | ---------- |
| Home        | 17     | **488,6 KB**       | ~1,9 MB    |
| Fiche hôtel | 18     | **506,5 KB**       | ~2,0 MB    |

- Plus gros chunk isolé : `07icog0gqji~l.js` = **169,9 KB gzip / 540,8 KB brut**
  (vendor). Sans source-maps publiques, contenu non nommable depuis curl.
- Ratio SSR/hydratation : le contenu est très majoritairement **rendu côté
  serveur** (RSC) — bon pour le SEO/AEO et le contenu visible, mais le coût
  d'hydratation reste élevé vu le poids JS.

### 6. Fonts

- 2 woff2 auto-hébergées via `next/font` (variantes preload `…-s.p.…woff2`).
- `font-display: swap` (défaut `next/font`, avec `size-adjust` anti-CLS).
- ⚠️ Aucun `<link rel=preload as=font>` explicite dans le `<head>` (les woff2
  sont déclarées dans la CSS) — découverte après parse CSS, impact mineur.

### 7. TTFB

- Assets cachés (HIT) : **40–60 ms**. ✅
- HTML dynamique (MISS) : **0,44 – 2,2 s**. Pires cas mesurés :
  `/classement/*` (2,22 s) et `/destination/*` (~2,1 s).

### 8. Tierces parties (ressources réellement chargées par le navigateur)

- **`api.mapbox.com`** — image **statique** (`/styles/v1/mapbox/light-v11/static/pin-l…/800x360@2x`), **aucun `mapbox-gl` JS** chargé. ✅ pattern optimal.
- `res.cloudinary.com` — **jamais appelé directement** par le navigateur : les
  images transitent par `/_next/image` (same-origin). Aucune connexion tierce
  pour les images. ✅
- **Aucun** script Sentry / GTM / gtag / analytics dans le HTML rendu
  (chargés éventuellement client-side dans le bundle, mais non render-blocking).
- Les ~12 hôtes externes de la fiche hôtel (`dorchestercollection.com`,
  `datatourisme.fr`, `wikidata.org`, `atout-france.fr`, `openstreetmap.org`,
  mairies…) sont des **liens `<a>` sortants EEAT**, pas des ressources chargées.

---

## Findings priorisés

### 🔴 P0 — Aucune mise en cache CDN sur les pages à trafic (impact LCP direct)

- **Mesure** : `Cache-Control: private … no-store`, `X-Vercel-Cache: MISS`,
  `Age: 0` sur **100 % des pages HTML** (home, fiche, classement, destination,
  FR+EN). TTFB SSR mesuré **0,7–2,2 s** ; pic **2,22 s** sur
  `/classement/meilleurs-palaces-provence` et **~2,1 s** sur `/destination/paris`.
- **Pourquoi P0** : un TTFB de 2,2 s consomme à lui seul ~88 % du budget LCP
  mobile (2,5 s) **avant tout rendu**. Sur classement/destination, le LCP terrain
  mobile dépasse quasi certainement la cible — sur des pages à trafic SEO.
- **Cause racine (code, read-only)** : la lecture du nonce CSP via `headers()`
  déclenche `DYNAMIC_SERVER_USAGE` de Next → bascule **`force-dynamic`** →
  désactive le cache CDN → Next émet automatiquement `no-store`. Documenté
  explicitement dans `apps/web/src/lib/security/csp.ts` (lignes 157-173 : « the
  hotel detail page intentionally keeps `force-dynamic` … »). **Conséquence : la
  stratégie ISR `revalidate = 3600` d'ADR-0007 ne prend jamais effet** — le
  `force-dynamic` gagne.
- **Action corrective** (décision archi requise, hors périmètre lecture seule) :
  1. Adopter **PPR / Cache Components (Next 16)** pour servir une coquille
     statique cachée CDN tout en gardant les îlots dynamiques (auth, nonce) à la
     demande — cf. skill `next-cache-components`.
  2. OU déplacer l'application du nonce CSP hors du chemin qui force le dynamique
     (header injecté en edge middleware sur une réponse cachable, le nonce du
     `<script>` JSON-LD étant le seul vrai besoin).
  3. OU, a minima, exposer des en-têtes `s-maxage`/`stale-while-revalidate` CDN
     sur les routes catalogue qui n'ont pas réellement besoin du nonce par-requête.
     Cible : `X-Vercel-Cache: HIT/PRERENDER` et TTFB < 200 ms sur classement,
     destination, fiche, home.

### 🟠 P1 — First-load JS ~2,7× le budget (489 / 506 KB gzip vs 180 KB)

- **Mesure** : home 17 chunks = **488,6 KB gzip** ; fiche hôtel 18 chunks =
  **506,5 KB gzip**. Plus gros chunk = **169,9 KB gzip**.
- **Pourquoi P1** : sur mobile mid-tier, ~500 KB de JS gzip ⇒ TBT/INP élevés et
  retarde l'interactivité ; la règle `observability-perf.mdc` fixe < 180 KB.
- **Action** :
  - Lancer `pnpm --filter @mch/web analyze` pour nommer le chunk de 540 KB brut.
  - Pousser le `'use client'` au plus bas (îlots), `dynamic(() => …, { ssr:false,
loading:() => null })` pour le non-critique (cf. `observability-perf.mdc`).
  - Vérifier qu'aucune lib lourde (date, carte, carousel) n'entre dans le tronc
    commun ; bannir `lodash`/`moment` (déjà règle).

### 🟠 P1 — Fiche hôtel : 1,02 MB de HTML brut (payload RSC inline lourd)

- **Mesure** : `/hotel/le-meurice` = 1 023 304 B brut / ~189 KB gzip,
  113 `self.__next_f.push` (vs 58 home).
- **Pourquoi P1** : gros DOM SSR + données flight sérialisées → coût de
  download/parse/hydratation, surtout combiné au MISS CDN (P0).
- **Action** : auditer les sections de la fiche (1746 lignes de page serveur) —
  certaines données volumineuses (FAQ 40-60, sections long-read, sources EEAT)
  pourraient être différées/streamées via `<Suspense>` plutôt que toutes
  sérialisées dans le payload initial.

### 🟡 P2 — `fetchpriority="high"` absent de l'image LCP

- **Mesure** : 0 occurrence de `fetchpriority="high"` sur home et fiche, alors
  que le hero est bien préchargé (`rel=preload as=image`) et `eager`.
- **Action** : passer le hero via la prop `priority` de `next/image` (qui ajoute
  `fetchpriority="high"` + le preload), ou ajouter l'attribut manuellement.
  Gain LCP marginal mais gratuit.

### 🟡 P2 — Carte Mapbox statique potentiellement chargée `eager`

- **Mesure** : 11 images `eager` sur la fiche, dont la carte statique
  `api.mapbox.com` (section géo, **sous la flottaison**).
- **Action** : confirmer/forcer `loading="lazy"` sur la carte — c'est la seule
  ressource cross-origin réelle, inutile de la charger avant le scroll.

### 🟡 P2 — Pas de preload de police explicite

- **Mesure** : 2 woff2 `next/font` déclarées en CSS, aucun `<link as=font>`.
- **Action** : activer `preload: true` sur la police critique du `next/font`
  pour la découvrir avant le parse CSS (gain LCP texte marginal).

### 🟡 P2 — Hero home = JPG local (pas Cloudinary `f_auto`)

- **Mesure** : `/kit/img/hero.jpg` via `/_next/image` (q=75) au lieu de
  Cloudinary `f_auto,q_auto`. Next négocie quand même avif/webp.
- **Action** : facultatif — migrer le hero home vers Cloudinary pour bénéficier
  de `q_auto` adaptatif. Impact faible.

---

## Ce qui n'a PAS pu être mesuré (nécessite un vrai navigateur)

Lighthouse/Chrome indisponible sur ce poste (`No Chrome installations found`).
**Aucune** des valeurs ci-dessus n'est une estimation — mais les CWV **terrain**
suivants exigent un run navigateur (Lighthouse mobile throttlé, WebPageTest, ou
CrUX/PageSpeed Insights distant) :

- **LCP réel** (ms) mobile mid-tier — le P0 ci-dessus le menace mais il faut le
  confirmer ; recommandation forte : lancer PSI/CrUX sur `/`, `/hotel/le-meurice`,
  `/classement/meilleurs-palaces-provence`.
- **CLS terrain** — structurellement maîtrisé (dimensions explicites, `fill` en
  conteneur dimensionné, `font-display:swap` + `size-adjust`), mais non chiffré.
- **TBT / INP** — directement liés au ~500 KB de JS (P1), non mesurables ici.
- **Analyse du chemin critique de rendu** (render-blocking CSS, ordre
  d'hydratation) et **temps d'hydratation** réel.

> Reco : faire tourner **PageSpeed Insights** (run distant, pas de Chrome local
> requis) sur les 3 URLs pour obtenir les CWV terrain + lab et confirmer le P0.

---

## Synthèse par axe

| Axe                      | État                                | Note |
| ------------------------ | ----------------------------------- | ---- |
| Cache CDN HTML           | 🔴 `no-store` partout, MISS         | 2/10 |
| TTFB                     | 🔴 0,7–2,2 s dynamique              | 3/10 |
| First-load JS            | 🟠 ~489–506 KB gzip (>180)          | 4/10 |
| Poids HTML               | 🟠 fiche 1,02 MB                    | 5/10 |
| Images (CLS/lazy/format) | 🟢 excellent                        | 9/10 |
| Fonts                    | 🟢 woff2 auto-hébergées, swap       | 8/10 |
| Tierces parties          | 🟢 isolation quasi parfaite         | 9/10 |
| LCP markup (preload)     | 🟢 préchargé (manque fetchpriority) | 8/10 |

**Score global perf : 6 / 10** — fondamentaux front de très bon niveau, plombés
par l'architecture de cache (P0) et le budget JS (P1). Le levier #1, de loin, est
de rendre les pages catalogue cachables CDN (PPR/Cache Components) pour effondrer
le TTFB et sécuriser le LCP mobile.
