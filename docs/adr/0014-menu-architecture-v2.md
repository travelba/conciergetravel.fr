# ADR 0014 — Architecture de navigation v2 : 5 entrées top-level + quick-search + breadcrumb

- Status: accepted
- Date: 2026-05-20
- Refs: rule `seo-geo`, rule `nextjs-app-router`, rule `architecture-layers`, skill `seo-technical`, skill `geo-llm-optimization`, skill `search-engineering`, ADR-0008 (URL plate hôtel), ADR-0015 (fusion guide↔destination), ADR-0016 (catégories non-palace)

## Décision

La navigation principale du site adopte **5 entrées top-level** (vs 4 actuelles), un **quick-search inline** dans le header (vs lien terminal "Rechercher") et un **breadcrumb visible** sous le header sur toutes les pages profondes (vs JSON-LD `BreadcrumbList` seul, invisible).

### Les 5 entrées

| #   | Label            | URL                                 | Mega-menu (3 colonnes)                                                                                                                                                                              |
| --- | ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Palaces & Hôtels | `/hotels`                           | Par distinction (5 cat. palace existantes) · Par type (5★, 4★, boutique, château, chalet, villa, maison d'hôtes, resort — 7 nouvelles pages) · Par groupe hôtelier (8-10 marques + lien `/marques`) |
| 2   | Destinations     | `/destination`                      | France · Régions héros · International                                                                                                                                                              |
| 3   | Inspiration      | `/inspiration` (nouveau hub)        | Par thème (20 `THEMES`) · Par occasion (9 `OCCASIONS`) · Par saison (5 `SAISONS`)                                                                                                                   |
| 4   | Classements      | `/classements`                      | Top curés · Par type · Par destination                                                                                                                                                              |
| 5   | Le Concierge     | `/le-concierge` (alias `/a-propos`) | Notre métier (IATA, fidélité) · Contenus (Conseil du Concierge, itinéraires, journal) · Pros (hôteliers, MICE, presse)                                                                              |

### Quick-search inline (remplace l'entrée "Rechercher")

- Champ destination autocomplete (Algolia, skill `search-engineering`) + 2 selects dates compactes.
- Submit → `/recherche?destination=...&checkin=...&checkout=...` (route existante).
- Toujours visible desktop ≥ md ; remplacé par icône loupe + dialog sur mobile.
- Le `WebSite` JSON-LD émis depuis la home expose un `SearchAction` pointant vers `/recherche?destination={search_term_string}` → eligible Google Sitelinks Search Box.

### Breadcrumb visible

- Server Component `<Breadcrumb />` rendu dans le `<RootLayout>` juste sous le `<SiteHeader>`.
- Lit la route segment via `headers()` + table de mapping (label FR/EN) gérée dans `nav-data.ts`.
- Reflète 1-pour-1 le `BreadcrumbList` JSON-LD déjà émis par chaque page.
- WCAG : `<nav aria-label="Fil d'ariane">` + séparateurs `aria-hidden`.
- Caché sur l'accueil (la home n'a pas de parent).

## Contexte

L'audit du menu actuel ([`apps/web/src/components/layout/site-header.tsx`](../../apps/web/src/components/layout/site-header.tsx) + [`mobile-nav.tsx`](../../apps/web/src/components/layout/mobile-nav.tsx)) révèle quatre déséquilibres :

1. **Taxonomie déjà déclarée mais invisible** : 12 types d'hôtels (`HOTEL_TYPES` dans [`axes.ts`](../../scripts/editorial-pilot/src/rankings/axes.ts)), 60+ lieux, 20 thèmes (`THEMES`), 9 occasions (`OCCASIONS`), 5 saisons, 13 marques (`BRAND_FAMILIES` dans [`get-related-hotels.ts`](../../apps/web/src/server/hotels/get-related-hotels.ts)). Le menu actuel n'expose que 5 catégories palace-only — la marque apparaît artificiellement limitée alors que le catalogue contient déjà des boutique-hôtels, châteaux, chalets, villas, maisons d'hôtes.
2. **Cannibalisation `/destination/[city]` ↔ `/guide/[city]`** : deux pages ciblent la même requête utilisateur, deux entrées de menu côte à côte → Google et les LLM ne savent pas laquelle citer.
3. **Trous EEAT et agentique** : `/a-propos` déclaré dans `routing.ts` mais sans page (le `TravelAgency` JSON-LD pointe vers la home, ce qui dilue l'autorité). Le `Conseil du Concierge` (USP éditorial unique, ADR-0011) n'apparaît jamais dans le menu. Le pipeline `/itineraire` est documenté ([`.cursor/skills/itinerary-editorial-pipeline/SKILL.md`](../../.cursor/skills/itinerary-editorial-pipeline/SKILL.md)) mais sans rendu.
4. **Recherche traitée comme un lien** : la conversion principale est cachée derrière un click supplémentaire, et le `SearchAction` JSON-LD (sitelinks search box) n'est pas émis.

## Alternatives considérées

**Alternative A — Garder 4 entrées et compresser l'inspiration dans `/classements`.** Rejetée. Les axes `OCCASIONS` (lune de miel, mariage, séminaire…) capturent une **intention utilisateur** (pourquoi je voyage) différente de l'autorité éditoriale qu'expriment les `Classements` (qui est le meilleur). Mélanger les deux dilue le signal AEO : les LLM qui répondent à "Quel hôtel pour ma lune de miel ?" préfèrent citer une page dédiée à l'occasion qu'un classement générique.

**Alternative B — 6+ entrées (Palaces, 5★, Destinations, Inspiration, Classements, Concierge).** Rejetée. Au-delà de 5 entrées top-level, la nav devient un strip de scan visuel et perd sa fonction de hiérarchie. La taxonomie type s'exprime mieux **à l'intérieur** du mega-menu "Palaces & Hôtels" qu'à plat.

**Alternative C — Quick-search en hero only (statu quo en header).** Rejetée. Le hero n'est visible que sur la home et est remplacé par un H1 contextuel sur toutes les autres pages — l'utilisateur qui arrive depuis Google sur une fiche hôtel n'a pas de path court vers la recherche multi-destinations.

## Conséquences

### Positives

- **Capture +30 % de requêtes Google** estimée : nouvelles pages types (5★, boutique, château, chalet, villa, maison d'hôtes, resort) + hub `/inspiration` + page `/le-concierge` + index `/marques` apportent 9-12 nouvelles pages indexables à fort potentiel.
- **AEO/GEO** : les LLM qui crawlent une page voient désormais 5 entrées de menu hiérarchisées + breadcrumb visible → meilleure compréhension de l'arborescence du site (Perplexity et ChatGPT Search citent les pages dont l'ancrage hiérarchique est explicite).
- **`SearchAction` JSON-LD** : éligibilité Google Sitelinks Search Box (rich result).
- **EEAT** : page `/le-concierge` autoritative pour le `TravelAgency` JSON-LD.
- **Composants Server-first** : le mega-menu reste CSS-only (`group-hover` + `focus-within` + `<details>` mobile) → pas de bundle JS additionnel.

### Négatives

- **Refonte transversale** : touche `SiteHeader`, `MobileNav`, `SiteFooter`, `nav-data.ts`. Risque LCP — atténué par le fait que tous ces composants restent Server-rendered (auth en client island, ADR-0007).
- **Maintenance des labels FR/EN** : `nav-data.ts` doit rester à jour avec les nouvelles entrées (types, thèmes, occasions, marques, top-destinations, top-rankings). Mitigé par un test unitaire qui vérifie que chaque slug d'`HOTEL_TYPE_NAV_ENTRIES` correspond à un `HOTEL_TYPES` de `axes.ts`.
- **Quick-search Algolia** : ajoute une dépendance client réelle dans le header (autocomplete). Atténué par le pattern "Server shell + Client island" + skeleton fallback.
- **Breadcrumb global** : doit gérer les routes dynamiques (`[slug]`, `[citySlug]`, `[axe]/[valeur]`). Mitigé par un mapping centralisé dans `nav-data.ts` + label data-driven (lecture du nom de l'entité depuis le data fetched par la page parent).

## Plan d'exécution

1. **PR-1** — Étendre `nav-data.ts` avec `HOTEL_TYPE_NAV_ENTRIES`, `THEME_NAV_ENTRIES`, `OCCASION_NAV_ENTRIES`, `BRAND_NAV_ENTRIES`, `TOP_DESTINATION_NAV_ENTRIES`, `TOP_RANKING_NAV_ENTRIES`. Code seulement, aucun rendu.
2. **PR-2** — Refonte `SiteHeader` + `MobileNav` (5 entrées + mega-menu 3 colonnes, sans quick-search).
3. **PR-3** — Refonte `SiteFooter` fat-footer 5 colonnes + section "Surface agentique" (`llms.txt`, `agent-skills.json`).
4. **PR-9** — `<HeaderQuickSearch>` + `SearchAction` JSON-LD.
5. **PR-10** — `<Breadcrumb>` Server Component visible.

PRs 4-7 (catégories non-palace, le-concierge, marques, inspiration) sont préalables visibles côté contenu mais indépendantes côté code.

## Notes

- L'entrée "Le Concierge" reste neutre côté slug : `/le-concierge` est un alias de `/a-propos` (slug FR existant dans `routing.ts`). Le composant header utilise `/a-propos` côté code pour préserver la cohérence avec le `routing.pathnames` table existante.
- Le `WebSite` + `SearchAction` JSON-LD est émis **uniquement** depuis la home et non depuis chaque page (Google ne lit le sitelinks search box qu'à la racine).
- Le breadcrumb visible reste indépendant du `BreadcrumbList` JSON-LD : l'un peut évoluer sans casser l'autre (skill `structured-data-schema-org`).
