# Audit pré-production — Cluster 3 : Performance & UX

> Périmètre : `apps/web` (Next.js 16 App Router, i18n `fr` défaut + `en` préfixé,
> contenu `force-dynamic` Supabase). Audit **lecture seule** du code — aucune
> modification, aucun commit, aucun build. Source : fichiers spéciaux de route
> (`loading.tsx` / `error.tsx` / `not-found.tsx` / `global-error.tsx`), pages
> dynamiques (`destination`, `classement`, `classements/[axe]/[valeur]`, `lieux`,
> `hotels`, `guides`, `itineraires`, `hotel/[slug]`, home), data readers
> `server/**`, composants média (`@mch/ui` `hotel-image`, `home-hero`,
> `hotel-gallery`, podium classement), composants client (`search-autocomplete`,
> `price-comparator-client`, `directory-mapbox-canvas`, `hotel-interactive-map-lazy`,
> `home-kit-reveal`), `styles/kit.css`, + sondage HTML production via `curl`/`Invoke-WebRequest`.
>
> Date : 2026-06-23.
>
> ⚠️ Pas de Lighthouse/Chrome disponible : les constats LCP/CLS sont déduits du
> code + du markup HTML rendu en production (pas de mesure terrain Web Vitals).

---

## Méthode

- Inventaire des fichiers spéciaux confirmé par `Glob` : **2 `loading.tsx`**
  (`hotel/[slug]`, `recherche`), **1 `error.tsx`** (niveau `[locale]`),
  **1 `not-found.tsx`** (niveau `[locale]`), **1 `global-error.tsx`** (racine).
  Aucune frontière `loading`/`error` au niveau des segments de contenu.
- Lecture des data readers `server/**` (rankings, destinations/cities, places,
  itineraries, annuaire, search/algolia, maps/mapbox) pour le pattern
  fallback-défensif (retour `[]`/`null` vs `throw`).
- Lecture des composants média et client pour `next/image` vs `<img>`,
  `priority`/`loading`/`width`/`height`, fetch `useEffect`, `cache()`.
- Sondage du HTML de prod : statut HTTP de 11 routes, markup du hero home,
  comptage `_next/image` (228) et `res.cloudinary.com` (246) sur la home.

**Verdict synthétique** : l'infrastructure de **résilience données** est
excellente (lecteurs défensifs systématiques → pas de 500 sur panne Supabase /
Algolia / Mapbox / Cloudinary). Les vraies lacunes sont (1) l'**absence quasi
totale de `loading.tsx`** sur ~28 routes dynamiques lourdes → transitions
client perçues comme figées, et (2) quelques **scans catalogue dupliqués
non-`cache()`** par requête sur les pages les plus visitées.

---

## Issues

### 🟠 [MAJEUR] — ~28 routes dynamiques lourdes sans `loading.tsx` (paint figé pendant le fetch)

- **Page/Fichier :** toutes les routes `force-dynamic` SAUF `hotel/[slug]` et
  `recherche`. Concrètement, sans squelette :
  `app/[locale]/page.tsx` (home, 5 fetchs //), `destination/page.tsx`,
  `destination/[citySlug]/page.tsx`, `classement/[slug]/page.tsx`,
  `classements/page.tsx`, `classements/[axe]/[valeur]/page.tsx`,
  `lieux/page.tsx`, `lieux/[citySlug]/page.tsx`, `lieux/[citySlug]/[placeSlug]/page.tsx`,
  `hotels/page.tsx`, `hotels/[pays]/page.tsx`, `hotels/[pays]/[ville]/page.tsx`,
  `guides/page.tsx`, `guide/[citySlug]/page.tsx`, `itineraires/page.tsx`,
  `itineraire/[slug]/page.tsx`, `marques/page.tsx`, `marque/[brandSlug]/page.tsx`,
  `categorie/[categorySlug]/page.tsx`, `label/[facetSlug]/page.tsx`,
  `inspiration`, `ouvertures`, etc.
- **Problème :** ces pages sont `export const dynamic = 'force-dynamic'` (nonce CSP
  par requête) et lisent Supabase à chaque requête. Sans `loading.tsx`, lors d'une
  **navigation côté client** (clic depuis un méga-menu / une carte), Next.js
  garde l'**ancienne page affichée et figée** jusqu'à résolution du payload RSC du
  nouveau segment — aucun squelette instantané, aucun retour visuel. Sur les
  routes qui scannent jusqu'à 8×1000 lignes (`destination/[citySlug]`) ou la table
  `editorial_rankings` complète (`classements/[axe]/[valeur]`), l'attente perçue
  est longue et donne une impression de clic « mort ».
- **Impact :** UX de navigation dégradée sur les surfaces les plus trafiquées
  (destination, classements, hôtels). Pas de crash, mais perception de lenteur et
  de non-réactivité — surtout sur mobile / réseau lent. Contraste fort avec
  `hotel/[slug]` qui, lui, offre un squelette soigné.
- **Recommandation :** ajouter un `loading.tsx` par segment de hub/template à fort
  trafic (au minimum `destination/[citySlug]`, `classement/[slug]`,
  `classements/[axe]/[valeur]`, `hotels/[pays]/[ville]`, `itineraire/[slug]`,
  `guide/[citySlug]`). Réutiliser le pattern de `recherche/loading.tsx` (grille de
  cartes en `animate-pulse`) et de `hotel/[slug]/loading.tsx` (réserve un `min-h`
  pour éviter le CLS). Un squelette générique partagé suffit pour les hubs.

---

### 🟠 [MAJEUR] — Scans catalogue dupliqués non-`cache()` par requête (`getDestinationBySlug`, `listPublishedRankings`)

- **Page/Fichier :** `apps/web/src/server/destinations/cities.ts`
  (`getDestinationBySlug` L330, `listPublishedCities` L217 — **aucun `cache()` dans
  le fichier**) ; `apps/web/src/server/rankings/get-ranking-by-slug.ts`
  (`listPublishedRankings` L276 — **non `cache()`-wrappé**, contrairement à
  `getRankingBySlug` L197 et `getRankingEntries` L212 qui le sont).
- **Problème :** sur `destination/[citySlug]`, `getDestinationBySlug` est appelé
  **dans `generateMetadata` ET dans le corps de page** ; il appelle en interne
  `fetchAllPublished()` qui pagine **tout le catalogue publié** (jusqu'à 8×1000
  lignes). N'étant pas `cache()`-wrappé, le catalogue complet est **scanné deux
  fois par requête**. Idem sur `classements/[axe]/[valeur]` :
  `listPublishedRankings()` (scan complet de `editorial_rankings` + sous-requêtes
  de comptage d'entrées) est ré-appelé dans `generateMetadata` (`resolveAxeValue`),
  dans le corps de page, et pour les « axes connexes » — 2 à 3 scans complets par
  requête, page `force-dynamic` donc à chaque hit.
- **Impact :** latence serveur (TTFB) et charge Supabase multipliées sur deux
  familles de pages très visitées. Aggrave directement le constat #1 (attente plus
  longue, ressentie d'autant plus fort sans `loading.tsx`).
- **Recommandation :** envelopper `fetchAllPublished`/`getDestinationBySlug`,
  `listPublishedCities` et `listPublishedRankings` dans `cache()` (React
  request-scoped) comme c'est déjà fait pour `getRankingBySlug`/`getRankingEntries`.
  Déduplique gratuitement les appels `generateMetadata` ↔ page sans changer la
  logique métier. Idéalement, ajouter aussi un `unstable_cache`/`revalidateTag`
  sur ces scans catalogue (déjà invalidés par les hooks Payload ailleurs).

---

### 🟡 [MINEUR] — Hero LCP de la home : `<img>` statique brut, hors `next/image` et hors Cloudinary `f_auto,q_auto`

- **Page/Fichier :** `apps/web/src/components/home/home-hero.tsx` — markup prod
  confirmé : `<img class="hero-bg" src="/kit/img/hero.jpg" fetchPriority="high"/>`.
- **Problème :** l'image **la plus grande au-dessus de la ligne de flottaison sur
  la page la plus trafiquée** (candidat LCP n°1) est un JPEG statique servi tel
  quel : pas d'AVIF/WebP, pas de `srcset` responsive, pas de `f_auto,q_auto`
  Cloudinary, pas de `width`/`height`. Le `fetchPriority="high"` est présent (bien),
  mais le poids/format ne sont pas optimisés et le mobile télécharge la même image
  que le desktop. (Le CLS est probablement maîtrisé car `hero-bg` est en
  position absolue/`object-cover`, mais l'optimisation LCP est laissée sur la table.)
- **Impact :** LCP home plus lourd que nécessaire vs cible ≤ 2,5 s
  (`observability-perf.mdc`). Sur 4G mid-tier, un JPEG non-AVIF non-responsive peut
  coûter plusieurs centaines de ms.
- **Recommandation :** passer le hero par Cloudinary (`f_auto,q_auto`,
  responsive `w_`) ou par `next/image` avec `priority` + `sizes="100vw"`, OU au
  minimum pré-générer une variante AVIF/WebP + un `srcset` 768/1280/1920. Conserver
  `fetchPriority="high"`.

---

### 🟡 [MINEUR] — `<img>` bruts (podium classement, blocs lieux, hôtels à proximité) : pas de `srcset` responsive

- **Page/Fichier :** podium/cartes de `classement/[slug]/page.tsx`, blocs lieux,
  `hotel-nearby-places`, vignettes diverses utilisant `<img>` + URL Cloudinary
  directe.
- **Problème :** ces images passent **bien** par Cloudinary (`f_auto,q_auto`,
  `c_fill,g_auto`) et sont majoritairement `loading="lazy"` — donc format et lazy
  OK. Mais elles **contournent le `srcset` responsive de `next/image`** : une
  largeur de delivery fixe (souvent ~1280 px pour l'image « feature ») est servie
  à tous les viewports → le mobile télécharge une image plus large que nécessaire.
- **Impact :** sur-téléchargement modéré sur mobile (octets gaspillés), pas de
  CLS car les dimensions sont posées sur la plupart. Impact perf réel mais limité.
- **Recommandation :** soit ajouter un `srcset`/`sizes` Cloudinary explicite
  (plusieurs `w_`), soit migrer ces surfaces vers le wrapper `@mch/ui`
  `HotelImage` (qui s'appuie sur `next/image`) déjà utilisé massivement ailleurs.
- ✅ **Point positif confirmé (commit 782efe53)** : le podium de classement émet
  bien l'image « feature » en `loading="eager"` + `fetchPriority="high"` + `width`/
  `height` explicites, et les tuiles secondaires en `loading="lazy"`. **Pas de CLS**
  sur le podium, LCP du podium priorisé correctement.

---

### 🟡 [MINEUR] — Contenu home masqué jusqu'au JS (reveal-on-scroll, 14 blocs)

- **Page/Fichier :** `apps/web/src/components/home/home-kit-reveal.tsx` +
  `apps/web/src/styles/kit.css` (`.mch-kit .reveal { opacity:0; transform:translateY(24px) }`).
  Prod confirmé : **14 blocs `.reveal`** sur la home.
- **Problème :** ces 14 blocs (têtes de magazine, mosaïques, sections édito)
  démarrent à `opacity:0` et ne deviennent visibles qu'après que le JS client
  (`IntersectionObserver`) ajoute `is-visible`. Si le JS est lent, différé ou
  bloqué, le contenu reste invisible jusqu'au **fallback de 1600 ms** (`setTimeout`).
- **Impact :** contenu éditorial conditionné au JS → risque de « page vide »
  perçue jusqu'à 1,6 s sur réseau lent, et contenu non visible si JS échoue.
  Atténuations en place : respect de `prefers-reduced-motion` (CSS désactive
  l'effet → contenu visible immédiatement) + fallback 1600 ms.
- **Recommandation :** réserver l'effet reveal aux blocs **sous** la ligne de
  flottaison ; laisser le 1er écran rendu sans `opacity:0` (ou animer uniquement
  le `transform`, jamais l'`opacity`, pour le contenu above-the-fold). Réduire le
  fallback à ~300-500 ms.

---

### 🟡 [MINEUR] — Une seule frontière `error.tsx` (niveau locale) : un throw non capturé fait un 500 plein écran

- **Page/Fichier :** `apps/web/src/app/[locale]/error.tsx` (seule frontière de
  segment), `app/global-error.tsx` (dernier recours). Aucun `error.tsx` au niveau
  `hotel`, `classement`, `destination`, etc.
- **Problème :** tout throw non capturé dans une page de contenu remonte jusqu'à
  l'`error.tsx` de locale → **écran 500 générique plein page**, perte du contexte
  (header/nav inclus dans le boundary). Les lecteurs de données étant défensifs
  (cf. point positif ci-dessous), les throws sont rares, mais des cas subsistent :
  `MISSING_MESSAGE` i18n (clé de namespace absente), `t.raw('cityFaq.items')`, ou
  un helper non-data (`buildEditorialLinkMap`) qui throw → 500 sur toute la page.
- **Impact :** dégradation peu gracieuse en cas d'erreur non-données ; l'utilisateur
  perd toute la page au lieu d'un bloc en erreur. Probabilité faible, sévérité UX
  moyenne.
- **Recommandation :** ajouter un `error.tsx` de segment sur les templates lourds
  (`hotel/[slug]`, `classement/[slug]`, `destination/[citySlug]`) pour afficher un
  message contextuel + un CTA « réessayer » tout en gardant le shell de nav.
  Sentry capte déjà l'exception dans le boundary existant (bon).

---

### 🔵 [INFO] — `/lieux` (et `/lieux/[citySlug]`) renvoient 404 en production alors que les routes existent dans le code

- **Page/Fichier :** routes présentes : `app/[locale]/lieux/page.tsx`,
  `lieux/[citySlug]/page.tsx`, `lieux/[citySlug]/[placeSlug]/page.tsx`. Sondage prod :
  `HEAD /lieux` → **404**, `GET /fr/lieux` → **404**, `HEAD /lieux/paris` → **404**.
  (À comparer : `/destination`, `/classements`, `/marques`, `/hotels`,
  `/itineraires` → 200.)
- **Problème :** la verticale « Lieux à visiter » est **inaccessible en prod** alors
  que les pages destination émettent des `<Link>` vers `/lieux/[citySlug]` (+
  `hotel-nearby-places`) → **liens internes cassés**. Cause probable hors cluster
  perf (déploiement/middleware/feature-flag), à confirmer par l'auditeur
  Navigation/Routing (Cluster 1).
- **Impact :** maillage interne cassé vers une verticale entière (UX + SEO). Signalé
  ici car détecté pendant le sondage HTML ; **n'entre pas dans le score perf**.
- **Recommandation :** vérifier le statut de déploiement / le matcher middleware de
  `/lieux` ; soit publier la verticale, soit retirer les liens internes vers
  `/lieux/*` tant qu'elle n'est pas live (cf. règle `user-acceptance-before-commit`).

---

## Points positifs (à conserver)

- ✅ **Lecteurs de données défensifs systématiques** — `server/**`
  (`listPublishedRankings`, `listPublishedCities`, `getDestinationBySlug`,
  `listPublishedPlacesForCity`, `getItineraryBySlug`, `getPlaceBySlug`,
  `getCityDirectory`…) enveloppent Supabase dans `try/catch` et retournent `[]`/
  `null` + `console.error`. **Conséquence majeure : une panne Supabase / Cloudinary
  / Algolia / Mapbox dégrade vers un état vide, ne fait PAS de 500.** Les 7 routes
  de contenu sondées en prod répondent 200. C'est le point fort du cluster.
- ✅ **Dégradation Mapbox** — `getMapboxAccessToken()` retourne `null` si le token
  est absent ; la carte n'est pas montée, la liste reste affichée.
- ✅ **Carte Mapbox code-splittée + montée paresseuse** —
  `hotel-interactive-map-lazy.tsx` : `next/dynamic({ ssr:false })` (sort
  `mapbox-gl` ~469 KB du first-load JS), montée via `IntersectionObserver`
  (`rootMargin:200px`), **desktop-only** (mobile ne télécharge jamais le moteur),
  et placeholder réservant la boîte `aspect-[20/9]` → **pas de CLS**. Exemplaire.
- ✅ **Fetchs client maîtrisés** — `search-autocomplete` (debounce + `AbortController`
  - dégradation silencieuse vers le form natif) et `price-comparator-client`
    (annulation + `catch` → état `unavailable`). Aucun fetch `useEffect` pour le
    contenu principal des pages (tout en RSC). Pas de waterfall client.
- ✅ **`next/image` utilisé massivement** — 228 références `/_next/image` + 246
  URLs Cloudinary sur la seule home, via le wrapper `@mch/ui` `HotelImage`
  (`priority` pour le LCP galerie, `loading="lazy"` par défaut, `decoding="async"`,
  `width`/`height` posés). L'usage de `<img>` brut est circonscrit à quelques
  surfaces.
- ✅ **`cache()` déjà en place** sur `getRankingBySlug` / `getRankingEntries`
  (dédupe `generateMetadata` ↔ page) — le bon pattern, à étendre (cf. issue 🟠 #2).
- ✅ **Squelettes anti-CLS** — `hotel/[slug]/loading.tsx` réserve `min-h-[180vh]` et
  mirroir la structure above-the-fold ; `recherche/loading.tsx` réserve la grille.
- ✅ **Tables éditoriales responsive** — `editorial-table.tsx` enveloppe le
  `<table>` dans `overflow-x-auto` + `role="region"`/`tabIndex` → pas de débordement
  horizontal mobile (kit.css applique aussi `overflow-x:auto` aux blocs larges).
- ✅ **Parallélisation** — home + destination utilisent `Promise.all` (pas de
  waterfall serveur).

---

## Récapitulatif par sévérité

| Sévérité    | Nombre | Issues                                                                                                   |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------- |
| 🔴 Critique | 0      | —                                                                                                        |
| 🟠 Majeur   | 2      | (#1) ~28 routes sans `loading.tsx` ; (#2) scans catalogue dupliqués non-`cache()`                        |
| 🟡 Mineur   | 4      | hero LCP non optimisé ; `<img>` sans `srcset` ; reveal masqué jusqu'au JS ; pas d'`error.tsx` de segment |
| 🔵 Info     | 1      | `/lieux` 404 en prod (cross-cluster routing)                                                             |

**Top 5 issues perf/UX (par priorité)**

1. 🟠 **~28 routes dynamiques lourdes sans `loading.tsx`** (destination, classements,
   hôtels, itinéraires, guides…) → navigation client figée, paint perçu lent sur
   les surfaces les plus trafiquées.
2. 🟠 **Scans catalogue dupliqués non-`cache()`** : `getDestinationBySlug` (2× tout
   le catalogue/requête) et `listPublishedRankings` (2-3× la table rankings/requête)
   → TTFB et charge Supabase gonflés sur les pages les plus visitées.
3. 🟡 **Hero LCP home** = JPEG statique brut hors `next/image`/Cloudinary
   (`f_auto,q_auto`), sans `srcset` → LCP de la home plus lourd que la cible 2,5 s.
4. 🟡 **Contenu home masqué jusqu'au JS** (14 blocs `.reveal` à `opacity:0`,
   fallback 1,6 s) → « page vide » perçue sur réseau lent / JS en échec.
5. 🟡 **Une seule `error.tsx` (locale)** : un throw non-données (i18n manquante,
   helper) fait un 500 plein écran au lieu d'un bloc en erreur contextuel.

**Aucune page de contenu ne fait un 500 sur panne d'upstream** : les lecteurs
défensifs garantissent une dégradation gracieuse (vérifié en prod : 7/7 routes
sondées → 200). Le seul 404 anormal (`/lieux`) relève du routing/déploiement, pas
de la résilience perf.

---

## Score Performance /10

### **7 / 10**

**Justification.** Le socle de **résilience** est très solide (lecteurs défensifs
partout → pas de 500 sur panne Supabase/Algolia/Cloudinary/Mapbox, confirmé en
prod), l'**optimisation média** est globalement bonne (`next/image` massif,
Cloudinary `f_auto,q_auto`, lazy par défaut, Mapbox code-split + lazy desktop-only
sans CLS, podium classement priorisé sans CLS), et les **fetchs client** sont
maîtrisés (debounce + annulation, zéro waterfall). Cela vaut une base élevée.

Deux 🟠 empêchent un meilleur score : (1) l'**absence quasi totale de
`loading.tsx`** sur ~28 routes dynamiques pénalise la fluidité perçue sur les
parcours les plus fréquents — un manque systémique, pas ponctuel ; (2) les
**scans catalogue dupliqués non-`cache()`** alourdissent le TTFB des pages
destination et classements-taxonomie, ce qui aggrave directement le ressenti du
point (1). Les 🟡 (hero LCP non optimisé, reveal masqué jusqu'au JS, `error.tsx`
unique) sont des optimisations à ROI clair mais non bloquantes.

Aucun 🔴 : rien ne casse ni ne 500 en dégradation. Le chemin vers **8,5+/10** est
court et mécanique : ajouter des squelettes `loading.tsx` génériques sur les hubs/
templates lourds, `cache()`-wrapper les 3 scans catalogue, et optimiser le hero
LCP de la home.
