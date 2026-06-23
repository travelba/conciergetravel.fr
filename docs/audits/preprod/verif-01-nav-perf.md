# RE-AUDIT prod — Vérification Go-Live · Cluster Navigation/Liens + Performance/UX

> Cible : **production live** `https://myconciergehotel.com` (PR #162 mergée dans
> `main`, déploiement Vercel `dpl_522QPzrTXCkgHhsxaiEP5AXuTBgK`).
> Méthode : sondage HTTP `Invoke-WebRequest` / `HttpWebRequest` (PowerShell, pas de
> Chrome → pas de Lighthouse) + inspection du code source du repo
> (branche locale `feat/lieux-a-visiter-vertical`, commits Go-Live présents sur
> `origin/main`). Audit **lecture seule** — aucun fichier de code modifié.
>
> Findings d'origine : [`01-navigation-liens.md`](01-navigation-liens.md) (score 7.5/10),
> [`03-performance-ux.md`](03-performance-ux.md) (score 7/10).
>
> Date : 2026-06-23.

---

## 1. Tableau correctif → PASS / FAIL → preuve

| #   | Correctif Go-Live attendu                                                                 | Verdict        | Preuve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Redirects `/selection/*` re-pointés vers cibles **200** (plus de 301→404)                 | ⚠️ **PARTIEL** | Variantes préfixées OK : `/en/selection/lune-de-miel` → **308** `…/classements/occasion/lune-de-miel`, `/en/selection/ski` → **308** `…/classements/theme/sport-ski`, `/en/selection/plage-privee` → **308** `…/categorie/palaces-bord-de-mer` ; les 3 cibles résolvent en **200**. **MAIS** le chemin **FR canonique nu** `/selection/lune-de-miel` (sans préfixe `/fr/`, forme réelle des deep-links legacy) renvoie **404 direct** — aucune règle ne le couvre (cf. §3 gap A).             |
| 2   | Liens internes `/guide/[citySlug]` → `/destination/[citySlug]` (sauf 8 country-guides)    | ✅ **PASS**    | `build-link-map.ts:106-108`, `local-guide-teaser.tsx:58-60`, `region-hub-fallback.tsx:73-74`, `related-guides.tsx:35-36`, `destination/page.tsx:168` utilisent désormais `isHandBuiltCountrySlug(slug) ? '/guide/[citySlug]' : '/destination/[citySlug]'`. Plus de saut 308 sur le maillage des villes ; les 8 pays hand-built restent canoniques sous `/guide/`.                                                                                                                             |
| 3   | Dorchester double slug : `/marque/dorchester` → 308 canonical **ou** absent du sitemap    | ✅ **PASS**    | `/marque/dorchester` → **308** `Location=/marque/dorchester-collection` ; canonical 200. Sitemap `hubs.xml` : **0** occurrence de `/marque/dorchester` nu — uniquement `/marque/dorchester-collection` (loc + 3 hreflang). Les deux conditions sont remplies.                                                                                                                                                                                                                                 |
| 4   | Gating `/dev/*` → **404** en prod                                                         | ✅ **PASS**    | `/dev/logo-preview` → **404**, `/en/dev/logo-preview` → **404**, `/dev/photo-filter-preview` → **404**. Code : `if (process.env.NODE_ENV === 'production') notFound();` dans les deux pages.                                                                                                                                                                                                                                                                                                  |
| 5   | 404 i18n : URL EN inexistante → CTA « back home » en **anglais** (pas FR)                 | ⚠️ **PARTIEL** | Plus aucune fuite FR sur les 404 EN (bug d'origine résolu). Le not-found **localisé brandé** (`[locale]/not-found.tsx`, « Back to home » EN / « Retour à l'accueil » FR) s'affiche bien sur les 404 **de sous-segment** (`/en/hotel/<inconnu>` → CTA EN ; `/hotel/<inconnu>` → CTA FR). **MAIS** les 404 **de premier niveau** (`/en/zzz`, `/fr/zzz`, `/zzz`) tombent sur le **404 par défaut Next.js** « This page could not be found » (anglais framework, sans CTA brandé) — cf. §3 gap C. |
| 6   | `loading.tsx` sur hubs (destination, classement, classements, lieux, hotels, itineraires) | ✅ **PASS**    | 7 `loading.tsx` présents : `destination/`, `destination/[citySlug]/`, `classement/[slug]/`, `classements/`, `lieux/`, `hotels/`, `itineraires/` (+ les pré-existants `hotel/[slug]/` et `recherche/`). Les 6 hubs demandés sont couverts.                                                                                                                                                                                                                                                     |
| 7   | `cache()` sur `getDestinationBySlug` + `listPublishedRankings`                            | ✅ **PASS**    | `cities.ts:341` `export const getDestinationBySlug = cache(_getDestinationBySlug)` + `cities.ts:121` `fetchAllPublished = cache(...)` ; `get-ranking-by-slug.ts:281` `export const listPublishedRankings = cache(_listPublishedRankings)`. Dédup `generateMetadata` ↔ corps de page effective.                                                                                                                                                                                                |
| 8   | `favicon.ico` + `manifest.webmanifest` présents (→ 200)                                   | ❌ **FAIL**    | `manifest.webmanifest` → **200** (`application/manifest+json`) ✅. **MAIS** `/favicon.ico` → **404** (design « SVG-only », aucun `.ico` livré) ET surtout `/icon.svg` (référencé dans le `<head>` : `<link rel="icon" href="/icon.svg">`) → **404 en prod**. Le favicon est donc **cassé live** (cf. §3 gap B, cause racine identifiée).                                                                                                                                                      |
| 9   | `/lieux` + `/lieux/paris` → **200** (verticale 404 avant deploy)                          | ✅ **PASS**    | `/lieux` → **200**, `/lieux/paris` → **200** (`text/html`). La verticale « Lieux à visiter » est désormais live ; le maillage interne `/destination` → `/lieux/[citySlug]` n'est plus cassé.                                                                                                                                                                                                                                                                                                  |

**Bilan : 5 PASS · 2 PARTIEL · 1 FAIL · (1 = item 1+8 nuancés).**

---

## 2. Régressions détectées (échantillon de routes clés FR + EN)

Sondage HEAD `no-follow` de 17 routes de premier plan — **aucune régression** :

| Route                                                       | FR                                    | EN                              |
| ----------------------------------------------------------- | ------------------------------------- | ------------------------------- |
| Home `/`                                                    | **200**                               | `/en` **200**                   |
| Fiche hôtel `/hotel/le-meurice`                             | **200**                               | `/en/hotel/le-meurice` **200**  |
| Destination `/destination/paris`                            | **200**                               | `/en/destination/paris` **200** |
| Hub classements `/classements`                              | **200**                               | `/en/classements` **200**       |
| Classement détail `/classement/meilleurs-palaces-provence`  | **200**                               | —                               |
| Recherche `/recherche`                                      | **200**                               | `/en/search` **200**            |
| Compte `/compte`                                            | **307** → auth (attendu, route gatée) | `/en/account` **307** (attendu) |
| `/marques` `/lieux` `/itineraires` `/destination` `/hotels` | **200**                               | —                               |
| Marque canonique `/marque/dorchester-collection`            | **200**                               | —                               |

**Verdict régressions : 0.** Tous les parcours testés répondent comme attendu
(le 307 sur `/compte` et `/en/account` est la redirection d'auth normale, pas une
régression). Les lecteurs de données défensifs (constat positif du Cluster 3)
tiennent : aucune 5xx observée.

### Évaluation perf via markup (pas de Lighthouse — pas de Chrome)

- ✅ **Hero LCP home migré `next/image`** (🟡 d'origine **résolu**) : l'ancien
  `<img class="hero-bg" src="/kit/img/hero.jpg">` brut a disparu. Le hero est
  désormais `data-nimg="fill"` avec `srcSet` responsive **320w → 1920w** via
  `/_next/image?…&q=75` (négociation AVIF/WebP), `sizes="100vw"`, et **1
  `<link rel="preload" as="image">`** émis dans le `<head>` (signature de
  `priority` Next/image → préchargement LCP). Optimisation LCP correctement posée.
- ✅ **`next/image` massif** : 247 références `/_next/image`, 19 `data-nimg`,
  21 `loading="lazy"` sur la seule home — lazy hors-LCP confirmé.
- ✅ **`loading.tsx`** : les 6 hubs + 3 templates lourds sont couverts (cf. item 6) —
  la navigation client n'est plus figée sur les surfaces les plus trafiquées.
- ✅ **`cache()`** : les 2 scans catalogue dupliqués par requête (constat 🟠 #2 du
  Cluster 3) sont éliminés (item 7).

---

## 3. Gaps résiduels nav/perf (post-deploy)

### 🟠 Gap B — `/icon.svg` renvoie **404 en prod** → favicon cassé (RÉGRESSION du correctif #8)

- Le `<head>` émet `<link rel="icon" href="/icon.svg">` (+ `apple-touch-icon`,
  `shortcut icon`) et le fichier `apps/web/public/icon.svg` est bien committé
  (commit `954806d3`, présent sur `origin/main`). Pourtant `GET /icon.svg` →
  **404** (idem HEAD) ; `/favicon.ico` → 404 (design « SVG-only » assumé).
- **Cause racine identifiée** : le matcher du middleware `apps/web/src/proxy.ts:101`
  exclut `favicon.ico|…|manifest.webmanifest|…|logos|kit` mais **PAS `icon.svg`**.
  La requête `/icon.svg` tombe donc dans next-intl, qui tente de la localiser →
  l'asset statique de `public/` est masqué → 404. (Le commit a bien ajouté
  `manifest.webmanifest` à l'exclusion — qui marche, 200 — mais a oublié `icon.svg`.)
- **Impact** : aucun favicon servi en prod (le navigateur demande `/icon.svg` →
  404, fallback `/favicon.ico` → 404). Cosmétique mais visible sur tous les onglets.
- **Fix (hors périmètre lecture-seule)** : ajouter `icon.svg` à l'exclusion du
  matcher `proxy.ts` (ou livrer un vrai `app/icon.svg` via le file-convention Next,
  qui sort de la portée du middleware). 1 ligne.

### 🟠 Gap A — `/selection/*` : seul le chemin **préfixé** redirige ; le FR nu **404**

- `next.config.ts` déclare uniquement `source: '/:locale(fr|en)/selection/…'` pour
  les 3 redirects, **sans la variante de chemin nu** — contrairement à
  `/itineraire`, `/marque/dorchester`, `/le-concierge-club/prestige` qui ont bien
  leurs **deux** entrées (préfixée + nue). Or `localePrefix: 'as-needed'` sert le FR
  **sans préfixe** : `/selection/lune-de-miel` (forme canonique des deep-links
  legacy externes/SEO) → **404 direct**, jamais redirigé.
- **Impact** : la perte de link-equity du finding d'origine n'est résolue **que**
  pour les variantes `/fr/…` et `/en/…` (rarement la forme des liens entrants
  réels). Le cas le plus probable (FR nu) reste cassé.
- **Fix** : ajouter 3 règles `source: '/selection/<slug>'` (chemin nu) pointant vers
  les mêmes cibles, sur le modèle de `/itineraire`.

### 🟡 Gap C — 404 de premier niveau non brandé/non localisé

- `/en/zzz`, `/fr/zzz`, `/zzz` → **404 par défaut Next.js** (« This page could not be
  found », anglais framework, sans CTA brandé), au lieu du `[locale]/not-found.tsx`.
  Le not-found brandé ne se déclenche que pour les 404 **de sous-segment** (ex.
  `/en/hotel/<inconnu>`). Le bug d'origine (EN affichant du FR) est **résolu** ;
  reste qu'un visiteur FR sur une 404 racine voit du texte anglais framework.

### 🟡 Gap D — Soft-404 : slugs inexistants de détail renvoient **200** (NOUVEAU)

- `/hotel/zzz-nonexistent`, `/en/hotel/zzz-nonexistent`, `/destination/zzz-nonexistent`
  → **HTTP 200** (et **aucun** `X-Robots-Tag: noindex`), tout en affichant l'UI
  not-found brandée. C'est un **soft-404** : Google peut indexer des URLs poubelle à
  l'infini. Détecté pendant cette vérification, **non listé** dans les audits
  d'origine. À corriger via un vrai `notFound()` (statut 404) sur ces templates.

### 🟡 Carry-over (non régressions, findings d'origine non ciblés par le deploy)

- Fil d'ariane absent sur `lieux`/`itineraires`/`label`/`le-concierge-club`/`ouvertures`
  (MINEUR Cluster 1) — non vérifié comme corrigé.
- Régions héros `/classements/lieu/[slug]` → états vides noindex (MINEUR Cluster 1).
- Reveal-on-scroll home (14 blocs `opacity:0`, fallback 1,6 s) + `error.tsx` unique
  par locale (MINEUR Cluster 3) — `error.tsx` de segment ajoutés sur `destination` +
  `classement` (commit `1ca10dbb`), bonne avancée partielle.

---

## 4. Score cluster Navigation/Liens + Performance/UX

### **8 / 10** (vs 7.5 nav + 7 perf en pré-prod)

**Ce qui a progressé (le gros du Go-Live a atterri).** Les correctifs structurants
sont **live et vérifiés sur la prod** : maillage interne `/guide`→`/destination`
sans saut 308 (item 2), Dorchester dé-cannibalisé (308 + hors sitemap, item 3),
`/dev/*` gatés 404 (item 4), verticale `/lieux` débloquée en 200 (item 9), 6 hubs
dotés de `loading.tsx` (item 6), 2 scans catalogue `cache()`-wrappés (item 7), et
hero LCP home migré `next/image` + preload (constat 🟡 #3 résolu). **0 régression**
sur 17 routes FR/EN clés ; aucune 5xx, résilience défensive intacte.

**Ce qui retient le score (3 détracteurs).**

1. ❌ **Favicon cassé en prod** (`/icon.svg` → 404, matcher `proxy.ts` incomplet) —
   le correctif #8 n'a pas atterri ; cosmétique mais visible partout.
2. ⚠️ **`/selection/*` FR nu → 404** : le re-pointage ne couvre que les chemins
   préfixés, pas la forme canonique des deep-links legacy (perte de link-equity
   toujours réelle pour le trafic FR).
3. 🟡 **Soft-404 (200 sans noindex)** sur les slugs de détail inexistants — nouveau
   risque SEO détecté, non bloquant mais à traiter.

Aucun de ces trois n'est un 🔴 bloquant fonctionnel : la nav réelle ne casse pas, le
contenu ne 500 pas. Mais les deux premiers sont des **correctifs Go-Live qui n'ont
pas pleinement abouti** (favicon + selection FR), d'où le retrait de 2 points. Le
chemin vers **9+/10** est mécanique : 1 ligne dans `proxy.ts` (icon.svg), 3 règles
de redirect nu (`/selection/*`), un `notFound()` sur les templates de détail.

---

### Annexe — commandes de preuve (PowerShell, prod live)

```powershell
# Redirects no-follow
[System.Net.HttpWebRequest]  # Method=HEAD, AllowAutoRedirect=$false
# /selection/lune-de-miel => 404 (FR nu)  ;  /en/selection/lune-de-miel => 308 → /en/classements/occasion/lune-de-miel (200)
# /marque/dorchester => 308 → /marque/dorchester-collection  ;  /itineraire => 308 → /itineraires

# Assets
# /manifest.webmanifest => 200  ;  /icon.svg => 404  ;  /favicon.ico => 404

# Verticale + dev gating
# /lieux => 200  ;  /lieux/paris => 200  ;  /dev/logo-preview => 404  ;  /en/dev/logo-preview => 404

# Hero (HttpClient + décompression gzip)
# <img data-nimg="fill" class="hero-bg" srcSet="/_next/image?...w=320..1920&q=75"> + <link rel=preload as=image> ×1
```

> ⚠️ En-têtes : toutes les pages de contenu émettent
> `Cache-Control: private, no-cache, no-store, must-revalidate` (routes
> `force-dynamic`, nonce CSP par requête). Le hint CDN `s-maxage=3600`
> déclaré dans `next.config.ts` pour `/hotel/:slug*` **reste inopérant** tant
> que la fiche est `force-dynamic` — comportement **connu et documenté** dans
> le code, pas une régression. Aucune mise en cache CDN sur l'éditorial.
