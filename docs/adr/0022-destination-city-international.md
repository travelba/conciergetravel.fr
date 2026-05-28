# ADR 0022 — `/destination/[citySlug]` international (relâchement filtre FR)

- Status: accepted
- Date: 2026-05-28
- Refs: ADR-0008 (URL plate hôtel), ADR-0014 (architecture menu v2), ADR-0015 (fusion `/guide` → `/destination`), skill `editorial-long-read-rendering` §Rule 10, skill `seo-technical` §Anti-cannibalisation, rule `seo-geo` §Décisions structurantes, migration `0033_hotels_country_support.sql`

## Décision

La route `/destination/[citySlug]` accepte désormais **toute ville publiée**, française ou internationale. Le filtre `country_code === 'FR'` historique de `listPublishedCities` et `getDestinationBySlug` ([`apps/web/src/server/destinations/cities.ts`](../../apps/web/src/server/destinations/cities.ts)) est levé. Le champ `region` devient nullable côté `CitySummary` / `DestinationDetail`, et un trio (`countryCode` + `countryLabelFr` + `countryLabelEn`) est propagé pour permettre aux consumers (page détail, JSON-LD `Place`, hub directory `/destination`) d'afficher le pays en lieu et place de la région administrative française pour les villes étrangères.

`generateStaticParams` est plafonné aux **100 premières villes** (par `count DESC`). Le reste du long tail rend via ISR à la demande sans coût de build.

## Contexte

État avant cette décision (mai 2026) :

- Le catalogue compte **615 hôtels publiés**, dont **395 internationaux** (91 pays). Top 14 villes internationales : Londres (45), New York (44), Dubaï/Dubai (50 cumulés), Tokyo (34), Istanbul (28), Berlin (23), Rome (22), Bangkok (21), Barcelone (21), Marrakech (16), Mykonos (14), Bali (11), Phuket (7), Santorin (7).
- Phase 4.A (CDC §6) demande **14 guides ville internationaux** : NYC, Dubaï, Bali, Tokyo, Marrakech, Mykonos, Santorin, St-Moritz, Phuket, Lake Como, Madère, Riviera Maya, Algarve, Côte amalfitaine.
- Les pipelines `scripts/editorial-pilot/src/guides/run-guides-v2.ts` + `push-guide-via-rest.mjs` génèrent et persistent ces guides correctement dans `editorial_guides`.
- Mais la route `/destination/[citySlug]` filtre `country_code === 'FR'` (lignes 166 + 253 historiques) — toute ville internationale renvoie `notFound()` même si un guide est publié.
- La règle 10 du skill `editorial-long-read-rendering` formalise le blocage le 27 mai 2026 et impose la résolution avant tout run de guide international.

Migration `0033_hotels_country_support.sql` (avril 2026) avait déjà rendu la colonne `region` nullable et ajouté `country_code` + `country_label_fr/en` à `public.hotels`. La donnée existe ; seule la couche applicative s'accrochait au modèle FR-only.

## Alternatives considérées

**Alternative A — Nouvelle route `/destination/[country]/[city]`.** Rejetée. Doublerait toute la surface de cross-link (rankings, itinéraires, hôtels) qui résout aujourd'hui par `citySlug`. Un slug court `marrakech` est plus quotable côté LLM (skill `geo-llm-optimization`) qu'un slug composite `morocco/marrakech`. La règle 10 du skill listait déjà cette alternative comme moins propre.

**Alternative B — Garder le filtre FR + créer un `/destination-internationale/[city]`.** Rejetée. Multiplie les routes pour le même contenu utilisateur ("où dormir à Marrakech"). Diluerait le link-juice exactement comme la fusion `/guide` ↔ `/destination` (ADR-0015) cherchait à éviter.

**Alternative C — Étendre le filtre à un allowlist `country_code IN ('FR', 'MA', 'US', …)`.** Rejetée comme demi-mesure. Chaque nouveau guide demanderait une PR pour étendre l'allowlist côté code applicatif, alors que l'éligibilité est déjà gérée par `is_published = true` côté DB.

## Conséquences

### Positives

- **14 guides internationaux** (Phase 4.A) peuvent enfin se rendre sur leur URL canonique `/destination/marrakech`, `/destination/new-york`, etc.
- **Discoverability** — l'index `/destination` ajoute une section "Monde — par ville" (cap 30) qui surface les villes internationales à côté des FR. Le PO gagne un chemin ≤ 2 clics depuis `/`.
- **Sitemap** — `apps/web/src/app/sitemaps/hubs.xml/route.ts` ré-utilise `listPublishedCities` ; les nouvelles entrées internationales seront automatiquement indexées au prochain rebuild.
- **JSON-LD `Place.address.addressCountry`** porte enfin l'ISO-2 réel (`MA` pour Marrakech, `US` pour NYC, …) au lieu du `'FR'` hard-codé. LLM crawlers obtiennent une adresse self-consistante.
- **Pas de migration DB** — toute la donnée nécessaire (`country_code`, `country_label_fr/en`) existe depuis la 0033.
- **Pas de breaking change i18n** — les routes localisées de `routing.ts` continuent à pointer sur `/destination/[citySlug]` pour `fr` + `en`.

### Négatives ou contraintes

- `region` est désormais `null` pour les villes internationales. Tous les consumers (`page.tsx` détail, `page.tsx` directory, JSON-LD `Place.addressRegion`, `containedInPlace.name`) doivent fall-back sur `countryLabel*` via le helper `pickRegionLabel`. Les anciens consumers FR-only restent corrects (région non-null en France).
- Plafond `STATIC_PARAMS_TOP_N = 100` — les villes au-delà rendent via ISR à la demande. Surveiller les Vercel build times au prochain déploiement (cap actuel ~127 villes total publiées, donc 100 couvre l'essentiel).
- Le filtre `partitionByDomesticForeign` continue à splitter FR/intl sur `country_code === 'FR'` côté `/hotels` listing (page différente). Ce point n'est PAS modifié.
- L'existence d'un slug ne garantit pas un guide éditorial — seuls les 14 villes ciblés Phase 4.A reçoivent un long-read complet. Les autres villes internationales (Londres, Berlin, Rome, Bangkok, …) rendent le hub hôtel sans guide. C'est conforme à la règle 10 (workaround : "le pipeline runner skip jusqu'à `editorial_guides` peuplé").

### Migration & rollout

1. **Pas de migration SQL** — la 0033 fait déjà le travail.
2. **Code applicatif** — modifications dans :
   - `apps/web/src/server/destinations/cities.ts` — types + helpers
   - `apps/web/src/app/[locale]/destination/[citySlug]/page.tsx` — JSON-LD + fallbacks + `STATIC_PARAMS_TOP_N`
   - `apps/web/src/app/[locale]/destination/page.tsx` — split FR / intl + nouvelle section
   - `apps/web/src/components/layout/nav-data.ts` — `TOP_INTL_DESTINATION_NAV_ENTRIES` (14 slugs)
   - `apps/web/src/server/itineraries/find-itineraries-for-context.ts` — `CITY_SLUG_TO_NEEDLES` étendu pour les cross-links itinéraires
   - i18n — clés `destinationPage.directory.intlCitiesSection.title/subtitle` ajoutées en `fr.json` + `en.json`
3. **Tests** — `apps/web/e2e/destination-international.spec.ts` couvre le rendu fr + en de `/destination/marrakech` (à ajouter dans la même PR).
4. **ISR** — la route reste `force-dynamic` à cause du nonce CSP (skill `structured-data-schema-org` §CSP-nonce-contract). Aucun changement.
5. **Sitemap** — `sitemaps/hubs.xml` se régénère au prochain rebuild ; pas d'action manuelle.

## Validation

- `pnpm --filter @mch/web typecheck` — clean.
- E2E à ajouter dans la même PR : `/fr/destination/marrakech` + `/en/destination/marrakech` rendent l'AggregateRating fall-back, les hôtels listés, le JSON-LD `Place` avec `addressCountry: 'MA'`.
- Vérification post-déploiement : la section "Monde — par ville" du `/destination` directory affiche les 14 slugs Phase 4.A après run du pipeline guides.

## Références

- [ADR-0015](0015-merge-guide-destination.md) — `/guide` → `/destination` (parent direct)
- [ADR-0008](0008-url-structure-hotel-flat.md) — politique URL flat
- [skill `editorial-long-read-rendering` §Rule 10](../../.cursor/skills/editorial-long-read-rendering/SKILL.md) — origine du blocker
- [migration `0033_hotels_country_support.sql`](../../packages/db/migrations/0033_hotels_country_support.sql)
- [`apps/web/src/server/destinations/cities.ts`](../../apps/web/src/server/destinations/cities.ts) — implémentation
- [`apps/web/src/app/[locale]/destination/[citySlug]/page.tsx`](../../apps/web/src/app/%5Blocale%5D/destination/%5BcitySlug%5D/page.tsx) — consumer principal
