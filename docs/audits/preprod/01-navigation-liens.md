# Audit pré-production — Cluster 1 : Navigation & Liens

> Périmètre : `apps/web` (Next.js 16 App Router, i18n `fr` défaut + `en` préfixé,
> contenu `force-dynamic` Supabase). Audit **lecture seule** du code — aucune
> modification, aucun commit. Source : arbre de routes (66 pages, 51 route
> handlers), `next.config.ts`, `src/proxy.ts`, `src/i18n/routing.ts`,
> `src/i18n/legacy-en-redirects.ts`, `components/layout/{site-header,mobile-nav,site-footer,breadcrumb,nav-data}.tsx`,
>
> - cross-références liens internes (`<Link>`, `redirect`/`permanentRedirect`,
>   `<a href>`, link-map éditorial).
>
> Date : 2026-06-23.

---

## Méthode

- Inventaire des routes confirmé via `Glob` sur `app/**/page.tsx` (66 pages, dont
  16 templates dynamiques) + route handlers.
- Extraction de toutes les surfaces de liens : méga-menus desktop
  (`site-header.tsx`), menu mobile (`mobile-nav.tsx`), footer 5 colonnes
  (`site-footer.tsx`), fil d'ariane (`breadcrumb.tsx`), data de nav partagée
  (`nav-data.ts`), redirects `next.config.ts`, `routing.ts` (`pathnames`),
  `legacy-en-redirects.ts`, `redirect()`/`permanentRedirect()` côté pages,
  link-map auto-injecté (`server/editorial/build-link-map.ts`).
- Chaque `href` interne croisé avec l'arbre de routes réel.

---

## Issues

### 🟠 [MAJEUR] — Redirections `/selection/*` qui pointent vers des pages inexistantes (301 → 404)

- **Page/Fichier :** `apps/web/next.config.ts` (lignes 115-129), `async redirects()`.
- **Problème :** Trois redirections permanentes (301) sont déclarées :
  - `/:locale/selection/lune-de-miel` → `/:locale/selection/romantiques-et-lune-de-miel`
  - `/:locale/selection/ski` → `/:locale/selection/montagne`
  - `/:locale/selection/plage-privee` → `/:locale/selection/bord-de-mer-et-plage`

  Or **aucune route `/selection/...` n'existe** : pas de dossier
  `app/[locale]/selection/`, et aucune entrée `/selection` dans
  `routing.ts > pathnames`. Les trois cibles (`romantiques-et-lune-de-miel`,
  `montagne`, `bord-de-mer-et-plage`) ne correspondent à aucune page. Le 301
  aboutit donc systématiquement à un **404**.

- **Impact :** Tout lien entrant historique / signal SEO / partage social pointant
  vers `/selection/lune-de-miel` (ski, plage-privee) est redirigé 301 vers une page 404. Perte de link-equity et UX cassée pour le trafic legacy. (Atténuation : aucun
  lien interne de la nav ne pointe vers `/selection/*` — l'impact est cantonné au
  trafic externe/legacy.)
- **Recommandation :** Soit créer les pages cibles `/selection/<slug>` (catégories
  éditoriales), soit re-pointer ces redirects vers les équivalents existants —
  p. ex. `/selection/lune-de-miel` → `/classements/occasion/lune-de-miel`,
  `/selection/ski` → `/classements/saison/hiver`, `/selection/plage-privee` →
  `/classements/saison/ete` (axes réels validés dans `axes.ts`). Sinon supprimer
  les trois règles mortes.

---

### 🟠 [MAJEUR] — Liens internes pointant vers `/guide/[citySlug]` qui 308-redirige vers `/destination/[citySlug]` (chaîne de redirection sur maillage interne)

- **Page/Fichier :** route redirigeante `app/[locale]/guide/[citySlug]/page.tsx`
  (`permanentRedirect` → `/destination/[citySlug]`, ligne 45). Liens internes
  encore branchés dessus :
  - `components/hotel/local-guide-teaser.tsx:54` (teaser guide sur chaque fiche hôtel)
  - `components/itineraire/related-itineraries`… → `components/itineraire/related-guides.tsx:32`
  - `components/destinations/region-hub-fallback.tsx:70`
  - `app/[locale]/destination/page.tsx:168` et `:373` (cartes du répertoire destinations)
  - `server/editorial/build-link-map.ts:102` (auto-liens injectés dans le corps
    éditorial — propagé sur de nombreuses pages)
- **Problème :** `/guide/[citySlug]` (dynamique) renvoie un **308** systématique vers
  `/destination/[citySlug]` (ADR-0015 : fusion guide↔destination). Or plusieurs
  composants de maillage continuent de générer des liens `pathname: '/guide/[citySlug]'`
  au lieu de la cible canonique `/destination/[citySlug]`. Chaque clic / crawl
  subit un saut de redirection inutile.
- **Impact :** Gaspillage de budget de crawl (Google suit le 308 puis indexe la
  destination), légère latence UX, dilution du signal de maillage interne (les liens
  ne pointent pas vers l'URL canonique). Pas de 404, pas de boucle.
- **Recommandation :** Remplacer dans ces composants `pathname: '/guide/[citySlug]'`
  par `pathname: '/destination/[citySlug]'` (la cible canonique post ADR-0015).
  Le `build-link-map.ts` est prioritaire car il propage le lien redirigé dans le
  corps de nombreuses pages.

---

### 🟡 [MINEUR] — Double slug marque : `/marque/dorchester` ET `/marque/dorchester-collection` indexables (contenu dupliqué)

- **Page/Fichier :** `app/[locale]/marque/[brandSlug]/page.tsx`
  (`generateStaticParams` ligne 302 itère `KNOWN_BRANDS` ; canonical
  auto-référent ligne 353-357) ; source des slugs
  `server/hotels/get-related-hotels.ts` lignes 65-67 (`dorchester-collection`,
  canonical) et 95-97 (`dorchester`, alias `pattern: null`).
- **Problème :** `KNOWN_BRANDS` contient les **deux** slugs. `generateStaticParams`
  pré-rend donc `/marque/dorchester` et `/marque/dorchester-collection`, chacun avec
  un **canonical auto-référent** (pointant vers lui-même). Les deux URLs rendent la
  même marque « Dorchester Collection » → contenu dupliqué indexable. La nav
  (header/mobile/footer) n'utilise que `dorchester-collection`, donc `/marque/dorchester`
  n'est joignable que par `generateStaticParams` / sitemap, mais reste public et
  indexable.
- **Impact :** Cannibalisation SEO mineure (deux URLs concurrentes pour la même
  entité). Alias « transitionnel » jamais refermé.
- **Recommandation :** Soit faire 308-rediriger `/marque/dorchester` →
  `/marque/dorchester-collection`, soit exclure l'alias de `generateStaticParams`
  - du sitemap, soit fixer le `canonical` de l'alias vers le slug canonique.

---

### 🟡 [MINEUR] — Fil d'ariane global absent sur plusieurs routes de premier niveau réelles

- **Page/Fichier :** `components/layout/breadcrumb.tsx` (`TOP_LEVEL_LABEL`, lignes 52-76).
- **Problème :** Le mapping `TOP_LEVEL_LABEL` ne couvre pas plusieurs segments de
  routes existantes : `lieux`, `itineraires` / `itineraire`, `label`,
  `le-concierge-club`, `ouvertures`, `presse`. Pour ces pages, `topLevel === undefined`
  → le composant retourne `null` (aucun fil d'ariane rendu).
- **Impact :** Incohérence de navigation : ces pages publiques (dont `/lieux`,
  `/itineraires`, `/label/[facetSlug]`, `/le-concierge-club`, `/ouvertures`) ne
  présentent pas de fil d'ariane global. Perte de repère utilisateur + d'un
  `BreadcrumbList` JSON-LD homogène. Pas de lien cassé.
- **Recommandation :** Ajouter les entrées manquantes dans `TOP_LEVEL_LABEL`
  (`lieux` → `/lieux`, `itineraires`/`itineraire` → `/itineraires`,
  `label` → `/hotels` ou `/classements`, `le-concierge-club` → `/le-concierge`,
  `ouvertures` → `/le-concierge`, `presse` → `/le-concierge`), en élargissant le
  type d'union des `href` autorisés.

---

### 🟡 [MINEUR] — Liens « Régions héros » vers `/classements/lieu/[slug]` pouvant résoudre en pages vides noindex

- **Page/Fichier :** `site-header.tsx` (DestinationsMegaMenu, lignes 434-444),
  `mobile-nav.tsx` (`AxisLinkList axe="lieu"`, lignes 378-383),
  `site-footer.tsx` (strip régions, lignes 532-544). Données :
  `nav-data.ts > HERO_REGION_NAV_ENTRIES`.
- **Problème :** Les 8 slugs régions (`cote-d-azur`, `provence`, `alpes`, `bordeaux`,
  `champagne`, `corse`, `pays-basque`, `loire`) sont routés vers
  `/classements/[axe]/[valeur]` (axe `lieu`) — choix **assumé et documenté** pour
  éviter les 404 (ce ne sont pas des city slugs). Mais d'après les commentaires du
  code, seuls 4/8 ont des classements publiés ; les autres (champagne, pays-basque,
  bordeaux, provence) dégradent vers un **état vide noindex**.
- **Impact :** Pas de 404, mais jusqu'à ~4 liens par page mènent à une page « thin »
  noindex — surface de maillage interne partiellement creuse. Tolérable mais
  sous-optimal.
- **Recommandation :** Prioriser la seeding des hubs régionaux éditoriaux
  (`/destination/region/[slug]` mentionné en TODO Phase 2), ou masquer les régions
  sans inventaire de classement tant que le hub n'existe pas.

---

### 🔵 [SUGGESTION] — Pages internes `/dev/*` joignables publiquement

- **Page/Fichier :** `app/[locale]/dev/logo-preview/page.tsx`,
  `app/[locale]/dev/photo-filter-preview/page.tsx`.
- **Problème :** Aucune des deux n'est liée depuis la nav (vérifié : 0 référence
  `Link`). Les deux portent `robots: { index: false, follow: false }` et ne sont pas
  dans le sitemap. **MAIS** étant sous `app/[locale]/`, elles restent rendues
  publiquement par URL directe (`/dev/logo-preview`, `/en/dev/logo-preview`,
  idem photo-filter-preview) sans aucun gating (auth / env).
- **Impact :** Faible (noindex + non liées), mais des outils de dev internes sont
  exposés en production.
- **Recommandation :** Gater derrière un check env (`NODE_ENV !== 'production'` →
  `notFound()`) ou déplacer hors de l'arbre public.

---

### 🔵 [SUGGESTION] — `categorie/[categorySlug]` lie un pays via le pathname dynamique `/guide/[citySlug]`

- **Page/Fichier :** `app/[locale]/categorie/[categorySlug]/page.tsx:361`
  (`pathname: '/guide/[citySlug]', params: { citySlug: 'suisse' }`).
- **Problème :** Le lien utilise le pathname dynamique `/guide/[citySlug]` avec un
  **slug pays** (`suisse`). À la navigation, l'URL produite `/guide/suisse` matche
  la page statique `/guide/suisse` (priorité segment statique > dynamique), donc
  **pas de redirection** — le lien fonctionne. Mais l'usage est fragile/ambigu :
  `/guide/[citySlug]` est par ailleurs une route 308-redirigeante.
- **Impact :** Aucun bug aujourd'hui (atterrit sur la vraie page Suisse), mais
  pattern fragile : si la priorité statique/dynamique changeait, le lien tomberait
  dans le 308.
- **Recommandation :** Utiliser le pathname statique typé `'/guide/suisse'`
  directement (comme le fait `site-header.tsx`), plutôt que le template dynamique.

---

## Points vérifiés & RÉFUTÉS (pas d'anomalie)

- **Pas de boucle de redirection `/destination/[citySlug]` ↔ `/guide/[citySlug]`.**
  `/destination/<slug>` ne 308-redirige vers `/guide/<slug>` que si
  `isHandBuiltCountrySlug(slug)` est vrai. Les 8 slugs concernés
  (`japon, italie, etats-unis, emirats-arabes-unis, suisse, thailande, maroc, maldives`,
  `lib/destinations/hand-built-country-guides.ts:24-33`) correspondent **exactement**
  aux 8 pages statiques `/guide/<slug>` ; le segment statique l'emporte sur
  `/guide/[citySlug]` dynamique → atterrissage direct, **aucune boucle**.
- **`/guides` → 308 `/destination`** (`guides/page.tsx:26`) : cible réelle, déjà
  retiré du footer. Aucun lien interne de nav ne pointe vers `/guides`.
- **`/a-propos` → 308 `/le-concierge`** (`a-propos/page.tsx:25`) : cible réelle ;
  aucun lien interne (uniquement `routing.ts`, le mapping breadcrumb correct, et le
  redirect legacy EN). Page orpheline-redirect, pas un 404.
- **`/le-concierge-club/prestige` → `#prestige`** : l'ancre `id="prestige"` existe
  bien (`le-concierge-club/page.tsx:153`). Pas d'ancre morte. Idem variante EN
  `/en/the-concierge-club/prestige`.
- **`/itineraire` (singulier) → 308 `/itineraires`** : cible réelle.
- **Parité header / mobile / footer** : les 5 méga-menus desktop correspondent 1:1
  aux 5 sections `<details>` mobiles ; le bloc Concierge ship les **mêmes 11 entrées**
  des deux côtés ; le footer surface un sous-ensemble cohérent. Pas de destination
  désynchronisée entre desktop et mobile.
- **Liens externes** : uniquement attributions Mapbox / OpenStreetMap
  (`hotel-location-map.tsx`, `hotel-static-map.tsx`) — légitimes et requises.
  **Aucun lien vers d'anciens projets / domaines non pertinents** détecté.
- **Slugs de catégories** footer/menu (`palaces-france`, `hotels-5-etoiles`,
  `boutique-hotels`, `chateaux-hotels`, `chalets-luxe`, `villas`, …) cohérents avec
  `nav-data.ts` ; mapping type→axe (`navHotelTypeToAxisValue`) protège contre les
  `/classements/type/<slug-inconnu>` (404 historique corrigé, garde-fou +
  `nav-data.test.ts`).
- **Redirects legacy EN** (`/en/recherche`→`/en/search`, `/en/compte`→`/en/account`,
  etc.) : cibles toutes déclarées dans `routing.pathnames`, ordonnées plus-long-préfixe-d'abord.

---

## Score Navigation /10

**7.5 / 10**

Justification :

- **Forces (+)** : architecture de nav mûre et testée (`nav-data.test.ts` comme
  garde-fou CI contre les liens morts), parité desktop/mobile/footer rigoureuse,
  fallbacks gracieux documentés (régions héros → axe `lieu` au lieu de 404,
  états vides noindex), pas de boucle de redirection, pas de lien externe douteux,
  ancres internes valides, redirects legacy EN propres.
- **Faiblesses (−)** : 2 problèmes MAJEUR — (1) trois redirects `/selection/*`
  morts aboutissant à 404 pour le trafic legacy, (2) chaîne de redirection sur le
  maillage interne (`/guide/[citySlug]` 308 → `/destination/[citySlug]`) propagée
  par plusieurs composants dont le link-map éditorial. Plus des MINEUR (double slug
  `dorchester`, fil d'ariane absent sur ~6 routes réelles, pages régions thin) et
  2 SUGGESTION (dev pages publiques, pathname dynamique pour un pays).

Aucun **404 réel sur lien interne de navigation** ni boucle de redirection — d'où un
score solide. Le retrait des points vient surtout des redirects `/selection`
cassés et des sauts de redirection internes vers `/guide/[citySlug]`, tous deux à
faible effort de correction.
