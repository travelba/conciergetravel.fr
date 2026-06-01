# ADR 0015 — Fusion `/guide/[city]` → `/destination/[city]`

- Status: accepted — **execution complete for city guides (steps 1-7 all done; only the cluster/region guide rendering surface remains as a distinct follow-up — see §Implementation status)**
- Date: 2026-05-20 (revisited 2026-05-28, re-verified 2026-06-01)
- Refs: ADR-0008 (URL plate hôtel), ADR-0009 (sous-pages chambres indexables), ADR-0014 (architecture menu v2), ADR-0022 (international city slugs), skill `seo-technical` §Anti-cannibalisation, skill `editorial-long-read-rendering`, skill `geo-llm-optimization`, rule `nextjs-app-router`, rule `seo-geo`

## Implementation status (2026-06-01 re-verification — ✅ city inlining is LIVE)

**Update 2026-06-01** — the inlining half (steps 1 + 5) was shipped after
the 2026-05-28 audit but the doc was never refreshed. Production walk-
through (`cursor-ide-browser` MCP) confirms the long-read body now renders
on the canonical city URL:

- `/destination/marrakech` (FR) + `/en/destination/marrakech` — 200 OK,
  the hotel hub (16 properties) renders **followed by the long-read guide
  in a 2-col layout with a sticky "ON THIS PAGE" TOC** listing all 16
  sections (Marrakech the Red City → Sources & references). `Article`
  JSON-LD present (`@id` = `#guide-article`, `isPartOf` = `#place`).
- `/destination/paris` (FR, 81 H2) and `/en/destination/tokyo` (EN, 46
  H2) confirmed identically.

The code at [`apps/web/src/app/[locale]/destination/[citySlug]/page.tsx`](../../apps/web/src/app/[locale]/destination/[citySlug]/page.tsx)
fetches `getGuideBySlug`, mounts `<CityGuideArticle>` + `<TocSidebar>`,
merges the guide's global FAQ into the canonical 10-Q `FAQPage`, and emits
the composite `Article` JSON-LD. The 33 city-scope guides (paris,
marrakech, tokyo, dubai, bali, …) all surface their long-read.

All 7 steps are done: step 6's positive assertion (article element +
sticky TOC + `Article` JSON-LD with `@id #guide-article` / `isPartOf
#place`, FR + EN, on paris/marrakech/tokyo) already lives in
[`apps/web/e2e/destination-guide-merge.spec.ts`](../../apps/web/e2e/destination-guide-merge.spec.ts)
(lines 63-130).

**One residual gap** (tracked separately, NOT blocking the city-guide win):

1. **Cluster + region guides are dark** — the ~21 `scope='cluster'`
   (provence, cote-d-azur, luberon, alpes, …) and `scope='region'`
   (alsace, bretagne, occitanie, …) `editorial_guides` rows carry rich
   content (11-12 sections each) but have **no rendering route**:
   `getGuideBySlug` is only consumed by the city-hub page, which requires
   a matching `getDestinationBySlug` (a city with published hotels).
   `provence`/`alsace` are not cities → `/destination/provence` 404s.
   They are NOT in the sitemap (no 404 pollution) but are invisible to
   humans and Google. Country guides split: 8 render at `/guide/<country>`
   (italie, suisse, maroc, maldives, emirats-arabes-unis, japon,
   thailande, etats-unis); the rest (espagne, allemagne, chine, mexique,
   royaume-uni, turquie + the empty `guide-*` stubs) are also dark.
   Resolving this needs a routing decision (new `/region/[slug]` +
   `/cluster/[slug]` routes, or a `/destination/[slug]` fallback that
   renders a guide-only page when no city matches) — a distinct ADR-sized
   call, deferred.

### Original 2026-05-28 audit (historical — the inlining was pending then)

Six months after this ADR was accepted, only the **redirect** half landed.
The **inlining** half (the actual benefit: surfacing the long-read body
on `/destination/[citySlug]`) was never executed.

| Step                                                                  | Status                            | Evidence                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Inline `<CityGuideArticle>` in `/destination/[citySlug]/page.tsx` | ✅ **done (verified 2026-06-01)** | Page fetches `getGuideBySlug` in the `Promise.all` fan-out, mounts `<CityGuideArticle>` + `<TocSidebar>` in a 2-col layout, merges the guide's global FAQ into the canonical 10-Q `FAQPage`. Prod walk confirms it on marrakech/paris/tokyo (FR + EN).                                                                                                 |
| 2 — `/guide/[citySlug]/page.tsx` permanent redirect                   | ✅ done                           | The file is now a 5-line `permanentRedirect()` to `/destination/[citySlug]` — its own comment ([apps/web/src/app/[locale]/guide/[citySlug]/page.tsx](../../apps/web/src/app/[locale]/guide/[citySlug]/page.tsx) line 25-28) says "slated for inlining in the destination page in the next PR (ADR-0015 step 1)" — never happened.                      |
| 3 — `/guides` index permanent redirect                                | ✅ done                           | Removed from menu and sitemap.                                                                                                                                                                                                                                                                                                                         |
| 4 — Sitemap cleanup                                                   | ⚠ partial                         | `/sitemaps/guides.xml` still exists ([apps/web/src/app/sitemaps/guides.xml/route.ts](../../apps/web/src/app/sitemaps/guides.xml/route.ts)) for **country guides** (`/guide/<countrySlug>` — italie, japon, maldives, maroc, suisse, thailande, etats-unis, emirats-arabes-unis). Those are separate from city guides and intentionally not redirected. |
| 5 — Composite JSON-LD `Article + Place` on destination page           | ✅ done (verified 2026-06-01)     | The destination page emits `ItemList + BreadcrumbList + Place + Article + FAQPage`. The `Article` carries `@id = #guide-article` and `isPartOf = { @id: #place }`, with `dateModified` from `editorial_guides.updated_at`. Confirmed in the prod DOM.                                                                                                  |
| 6 — Playwright `destination-guide-merge.spec.ts`                      | ✅ done (verified 2026-06-01)     | Both the 308 redirect specs AND the positive inline-render assertions exist (lines 63-130): `article#city-guide-article` visible, `nav[aria-label="Sur cette page"]` present, `Article` JSON-LD with `@id …#guide-article` + `isPartOf …#place`, across paris/marrakech/tokyo in FR + EN.                                                              |
| 7 — CTA href refactor `/guide/[citySlug]` → `/destination/[citySlug]` | ✅ done                           | grep returns 0 hits in `apps/web/src` for `pathname: '/guide/[citySlug]'`.                                                                                                                                                                                                                                                                             |

### Observable consequence on production (2026-05-28)

Phase 4.A shipped 14 international city guides to `editorial_guides`
(`new-york`, `dubai`, `bali`, `tokyo`, `amalfi-coast`, `marrakech`,
`mykonos`, `santorin`, `st-moritz`, `phuket`, `lake-como`, `madeira`,
`riviera-maya`, `algarve`) — each row carrying 12-14 sections, 29-42
FAQ items, 16-18 TOC anchors, 5-10 external sources. UAT walk-through
(28 URLs, fr + en) on 2026-05-28 confirms:

- 28/28 routes return **200 OK** (ADR-0022 unblocked international slugs as intended).
- 13/14 cities render their **hotel hub** correctly (`marrakech` 16 hotels, `tokyo` 34, `new-york` 47, `dubai` 53, `bali` 22, `phuket` 7, `mykonos` 14, `santorin` 7, `riviera-maya` 12, etc.).
- 1/14 (`algarve`, zero hotels) renders the graceful **empty-state** (noindex, follow) — same `<DestinationEmptyState>` used for FR cities still in draft.
- **0/14** surface the **long-read guide body** on the canonical URL.

The 14 guide rows are visible only to:

- `llms.txt` (LLM crawlers — still indexed for ingestion).
- `/api/agent/country-guide` (the country-guide endpoint, distinct from city guides).
- The `<LocalGuideTeaser>` block on each hotel detail page (`hotel/[slug]`) — which reads `editorial_guides` and renders a short teaser linking back to `/destination/[citySlug]`, where the long-form content is then invisible.

In effect the editorial pipeline is producing high-quality JSONB rows
that are dark on every public surface but `llms.txt` and the hotel-
detail teaser. SEO-wise this is a silent regression on the long-read
EEAT signal (3 500+ words, sticky TOC, sources footer) that the
pipeline was designed to deliver.

### What still needs to happen (PR-15bis — follow-up ADR-0015 step 1)

A focused PR limited to the `/destination/[citySlug]` rendering surface:

1. **Server fetch** — add a `getGuideBySlug(citySlug, locale)` call in
   parallel to the existing `getDestinationBySlug` / ratings batch /
   related-rankings / related-itineraries fan-out. The helper already
   exists at `apps/web/src/server/guides/get-guide-by-slug.ts`.
2. **Conditional render** — when the guide row exists and `is_published =
true`, mount `<CityGuideArticle guide={…} locale={locale} />` after
   the hotel hub but before the canonical 10-Q FAQ. Re-use the
   `editorial-long-read-rendering` skill components verbatim
   (`<TocSidebar>`, `<EnrichedText>`, `<EditorialCallout>`,
   `<EditorialTable>`, `<EditorialGlossary>`, `<ExternalSourcesFooter>`).
3. **JSON-LD `Article`** — add `Article` JSON-LD with `@id =
${pageUrl}#guide-article`, `isPartOf = { @id: ${pageUrl}#place }`,
   `headline`, `description`, `author = Organization`, `inLanguage`,
   `dateModified` (from `editorial_guides.updated_at`).
4. **Two-level FAQ** — split `editorial_guides.faq` by `section_anchor`
   (skill §Rule 5) and merge with the canonical 10-Q list. The
   `FAQPage` JSON-LD already emitted on the destination page absorbs
   the guide FAQs — keep a single `FAQPage` per page (ADR-0011 C1).
5. **Layout** — switch from the current single-column `max-w-editorial`
   container to the two-column `lg:grid lg:grid-cols-[1fr_240px]` when
   a guide row is present, so the `<TocSidebar>` has its 240 px aside.
6. **Playwright** — extend `destination-guide-merge.spec.ts` to assert
   the inlined H2 / sticky TOC / `Article` JSON-LD presence on
   `marrakech`, `tokyo`, `new-york` (one FR-canonical city + two
   international from Phase 4.A).
7. **Sitemap `lastmod`** — pick `MAX(hotels.updated_at, editorial_guides.updated_at)`
   so the freshness signal moves when the editorial team re-runs a guide
   without changing the hotel catalogue.

The estimated effort is 3-5 hours (1 file changed plus 1 new Playwright
case). The blocker is no longer technical (ADR-0022 unblocked the
route, the guide rows exist, the components exist, the helper exists)
— it's purely sequencing: the inlining PR was never written.

## Décision

L'URL canonique unique d'une destination est **`/destination/[citySlug]`**. Le contenu éditorial long-read (3 500+ mots, sticky TOC, glossaire, sources EEAT) précédemment hébergé sur `/guide/[citySlug]` est **inliné** dans la page destination, après le hub des hôtels.

`/guide/[citySlug]` retourne un **301 permanent** vers `/destination/[citySlug]`. La route reste déclarée dans `routing.ts` (pour ne pas casser les anciens liens externes), mais sa page handler appelle `permanentRedirect()`.

L'index `/guides` est démantelé : son contenu est absorbé par `/destination` (annuaire). Un `301` permanent y conduit aussi.

## Contexte

État avant cette décision (audit du 20 mai 2026) :

- Deux routes existent : [`apps/web/src/app/[locale]/destination/[citySlug]/page.tsx`](../../apps/web/src/app/[locale]/destination/[citySlug]/page.tsx) (hub hôtels par ville) et [`apps/web/src/app/[locale]/guide/[citySlug]/page.tsx`](../../apps/web/src/app/[locale]/guide/[citySlug]/page.tsx) (long-read 3 500+ mots).
- Le menu actuel ([`site-header.tsx`](../../apps/web/src/components/layout/site-header.tsx)) expose les deux côte à côte (`Destinations` + `Guides`).
- Les deux pages ciblent la même requête utilisateur ("où dormir à Paris", "Paris hotels guide").
- Le `BreadcrumbList` JSON-LD de la page guide cite `Accueil → Guides → Paris`, celui du hub destination cite `Accueil → Destinations → Paris` → Google et Perplexity oscillent entre les deux dans les citations.
- Pages destination = `force-dynamic` (nonce CSP, [skill `structured-data-schema-org`](../../.cursor/skills/structured-data-schema-org/SKILL.md) §CSP-nonce-contract). Pages guide aussi.

Le brief utilisateur du 20 mai 2026 valide explicitement la fusion : « Pour moi guide c'est destination, et dans la page guide on accède à tous les hôtels de la destination. »

## Alternatives considérées

**Alternative A — Garder les deux routes mais une seule entrée de menu.** Rejetée. Le breadcrumb visible (ADR-0014) ne peut citer qu'un seul parent canonique. Garder les deux routes signifie continuer à split le link-juice entre deux URLs qui se cannibalisent.

**Alternative B — Inverser la canonicalité : `/guide/[city]` devient l'URL canonique.** Rejetée pour deux raisons :

1. La page `/destination` (annuaire) cite déjà 100 % des villes via `/destination/[citySlug]` — elle est mieux maillée que `/guides`.
2. "Destination" est un terme taxonomique fort et neutre dans l'agentique (LLM `list-cities` retourne des destinations, pas des guides).

**Alternative C — Sous-page `/destination/[city]/guide` (comme `/hotel/[slug]/chambres/[room]`).** Rejetée. Le contenu du guide n'est pas une **sous-ressource** d'une destination (comme une chambre l'est pour un hôtel) : c'est **la même ressource sous un autre angle**. Une sous-page créerait de la profondeur de path sans bénéfice SEO et alourdirait les `generateStaticParams`.

## Conséquences

### Positives

- **Pas de cannibalisation** : un seul résultat Google par destination, un seul citation LLM.
- **Link-juice consolidé** sur `/destination/[city]` : tous les liens internes (sitemap, footer, breadcrumb, `ItemList` JSON-LD du `/destination` annuaire) pointent vers une seule URL.
- **JSON-LD plus riche par page** : la page destination émet désormais `Place` + `ItemList` (hôtels) + `Article` (long-read avec `dateModified`) + `BreadcrumbList` + `FAQPage` (si la FAQ du guide existait). Le composite `@id`/`isPartOf` permet à Google de comprendre que `Article` est une vue éditoriale de `Place`.
- **UX** : l'utilisateur ne se demande plus s'il doit aller sur "destination" ou "guide". Un seul path. Le long-read est en bas de page, accessible via TOC sticky ou ancre.
- **Conformité ADR-0014** : aligne l'arborescence menu avec l'arborescence URL.

### Négatives

- **301 permanent à mettre en place** : nécessite un test E2E Playwright pour vérifier que `/fr/guide/paris` → `/fr/destination/paris` retourne bien `308 Permanent Redirect` (Next.js `permanentRedirect` émet `308`, équivalent SEO de `301`).
- **Sitemap à mettre à jour** : retirer les URLs `/guide/[citySlug]` et `/guides` du sitemap. Garder le `lastmod` sur `/destination/[citySlug]` synchronisé avec la dernière édition du guide.
- **Risque SEO transitoire (4-8 semaines)** : Google met du temps à digérer les 301 sur les pages déjà indexées. Mitigé par le fait que les pages guide étaient peu indexées (domaine jeune, V1).
- **Migration de contenu Payload** : les `editorial_pages` de type `city_guide` doivent rester rattachées à la ville mais leur rendu se fait désormais dans `/destination/[city]`. Le slug de l'`editorial_pages` reste le slug ville (déjà aligné). Aucune migration SQL nécessaire — seule la page rendu change de fichier.
- **CTAs internes à mettre à jour** : tous les `Link href="/guide/[city]"` doivent être remplacés par `Link href="/destination/[city]"` (ou `Link href="/destination/[city]#guide-article"` si on veut deep-linker la section long-read). Mitigé par grep `pathname: '/guide/[citySlug]'`.

## Plan d'exécution

PR-8 (du plan parent) découpée en étapes :

1. **Étape 1 — déplacer le rendu** : la page `/destination/[citySlug]/page.tsx` lit l'`editorial_pages` (type `city_guide`) en plus de la liste des hôtels et compose `<DestinationHero> + <HotelHub> + <CityGuideArticle>` (le composant long-read existant, juste déplacé).
2. **Étape 2 — redirect `/guide/[citySlug]/page.tsx`** : remplace tout le contenu par `permanentRedirect(getPathname({ locale, href: { pathname: '/destination/[citySlug]', params: { citySlug } } }))`.
3. **Étape 3 — redirect `/guides/page.tsx`** : remplace par `permanentRedirect('/destination')`.
4. **Étape 4 — sitemap** : retirer `/sitemaps/guides.xml` et `/sitemaps/editorial.xml` les URLs `/guide/[citySlug]`. Garder uniquement `/destination/[citySlug]` (le `lastmod` reflète la date max entre `hotels.updated_at` agrégé et `editorial_pages.updated_at`).
5. **Étape 5 — JSON-LD composite** : ajouter sur la page destination un `Article` JSON-LD avec `@id = ${url}#guide-article`, `isPartOf = { @id: place_id }`, `dateModified`, `author = Organization`, `inLanguage`.
6. **Étape 6 — Playwright** : `apps/web/e2e/destination-guide-merge.spec.ts` couvre :
   - `/fr/guide/paris` → 308 → `/fr/destination/paris`
   - `/en/guide/paris` → 308 → `/en/destination/paris`
   - `/fr/guides` → 308 → `/fr/destination`
   - La page destination contient bien le H2 long-read + sticky TOC.
   - Le `Article` JSON-LD est présent dans le DOM avec le bon `@id`.
7. **Étape 7 — référentiel CTA** : grep `pathname: '/guide/[citySlug]'` → remplacer par `pathname: '/destination/[citySlug]'`. Idem pour `href: '/guides'`.

## Notes

- L'ADR-0009 reste **inchangée** : les sous-pages chambres `/hotel/[slug]/chambres/[room-slug]` ne sont pas affectées. La fusion concerne uniquement guide↔destination par ville.
- Le `Article` JSON-LD émis sur la page destination utilise le fragment `#guide-article` comme `@id`. Cela permet à Perplexity et ChatGPT Search de citer directement la section long-read avec un deep-link.
- Si dans le futur on veut un slug localisé (`/destination` en FR → `/destination` en EN, possiblement `/destination` → `/destinations` pluriel), c'est une décision distincte (`routing.ts`) qui n'affecte pas cette ADR.
