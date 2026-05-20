# ADR 0015 — Fusion `/guide/[city]` → `/destination/[city]`

- Status: accepted
- Date: 2026-05-20
- Refs: ADR-0008 (URL plate hôtel), ADR-0009 (sous-pages chambres indexables), ADR-0014 (architecture menu v2), skill `seo-technical` §Anti-cannibalisation, skill `editorial-long-read-rendering`, skill `geo-llm-optimization`, rule `nextjs-app-router`, rule `seo-geo`

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
