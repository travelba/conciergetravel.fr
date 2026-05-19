# Plan d'exécution — Rollout multilingue V2 (DE/ES/IT)

> Plan opérationnel suivant [ADR-0012](../adr/0012-multilingual-db-schema.md).
> Skill de référence : [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md)
> §V2 multilingual rollout.

## État au 2026-05-19 (fin de session 3)

| Phase                                            | Statut                             | Livrable                                                                              |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------- |
| 0 — ADR-0012 schéma DB multilingue               | ✅ accepted                        | `docs/adr/0012-multilingual-db-schema.md`                                             |
| 1a — `runtime.ts` helpers centralisés            | ✅ livré (commit `5fc60c4`)        | `apps/web/src/i18n/runtime.ts` + 13 tests vitest                                      |
| 1b — Codemod hotspots                            | ✅ ~43 / ~50 fichiers (12 commits) | 100+ ternaires de prefix/OG/Intl supprimés, 11 duplicats `withLocalePrefix` collapsés |
| 1c-α — Élargir `SupportedLocale` + `assertNever` | ✅ livré (session 3)               | `supported-locale.ts` + `assertNever` + tous les `pickXxx` data-layer exhaustifs      |
| 1c-β — Copy maps + email subjects → `next-intl`  | ✅ livré (session 3)               | Editorial / hotel / rankings / SEO / email subjects tous migrés vers ICU messages     |
| 2 — `routing.pathnames`                          | ⏳ à faire                         | `routing.ts` + refactor `<Link>`                                                      |
| 3 — Migrations DB + Payload                      | ⏳ à faire                         | `0034`, `0035`, `0036` + dual-table mirror étendu                                     |
| 4 — Activation V2 (DE en premier)                | ⏳ à faire                         | `messages/de.json` + contenu rédacteur natif                                          |

### Re-survey du 2026-05-19 (fin de session 2, 12 commits cumulés)

Après les 7 paquets de la session 2 (4, 5, 6, 8a, 8b, 10, 11), un `rg` exhaustif sur `apps/web/src/` ne renvoie plus que **~85 ternaires `locale === 'fr' / 'en'`**, contre ~300+ au démarrage. Le reliquat est de deux natures :

| Catégorie                                                                                                                                                                                                                                     | Reste | Phase |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| Picks de colonne `name_fr` / `name_en`, `slug` / `slug_en`, `description_fr` / `description_en` dans `server/**` et components data-driven                                                                                                    | ~70   | 1c    |
| Copy maps `{ fr: '...', en: '...' }` et ternaires de chaîne UI (labels, sentence templates) dans `components/editorial/*`, `components/hotel/*`, `components/rankings/*`, `lib/format-distance.ts`, `lib/poi-hours.ts`, server email subjects | ~15   | 1c    |
| Tests + commentaires du helper `runtime.ts` (intentionnel, fixtures `'fr'` / `'en'`)                                                                                                                                                          | 5     | —     |

Plus aucun ternaire de **URL prefix / OG locale / Intl tag / hreflang** ne reste dans le code applicatif Phase 1b (les 7 paquets ont fait le tour des routes `app/[locale]/**`, des `sitemaps/*.xml/route.ts`, du `server/booking`, du `server/auth`, des helpers SEO et du price comparator).

Décision : **arrêter Phase 1b ici** et enchaîner sur Phase 1c (élargissement `SupportedLocale` + migration `next-intl` des copy maps). Les ~15 ternaires UI restants seront migrés en même temps que les copy maps, dans Phase 1c.

## Phase 1b — Codemod hotspots (terminé)

Objectif : remplacer toutes les occurrences de `locale === 'fr'` / `locale === 'en'` qui touchent **URL prefix, OG locale, Intl tag, hreflang** par les helpers de `runtime.ts`. Aucun changement de comportement attendu pour FR/EN — diff = pure refactorisation.

**Périmètre exclu de 1b** : les ternaires qui sélectionnent une **colonne** FR vs EN (`name_fr` vs `name_en`, `slug` vs `slug_en`, etc.) et les copy maps UI — ces ternaires restent jusqu'à Phase 1c (qui élargit `SupportedLocale` et migre les copy maps vers `next-intl`) puis Phase 3 (qui collapse les colonnes en tables de translations).

**Statut final** : **~43 / ~50 fichiers traités, 12 commits cumulés**. Aucun ternaire de prefix/OG/Intl/hreflang ne reste dans le code applicatif. Phase 1b close.

### Déjà traités

**Paquet 1 — fiche détaillée hôtel + recherche (commit `381bedd`)**

- ✅ `app/[locale]/recherche/page.tsx` (2 ternaires)
- ✅ `app/[locale]/hotel/[slug]/chambres/[roomSlug]/page.tsx` (5 ternaires + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/hotel/[slug]/page.tsx` (7 ternaires de prefix/OG/Intl + local `withLocalePrefix` supprimé ; les 5 ternaires data-layer restants annotés pour Phase 1c)
- ✅ `app/[locale]/layout.tsx` (2 ternaires : hreflang home + og:locale)

**Paquet 2 — 4 routes de hub/landing (commit `ee7472e`)**

- ✅ `app/[locale]/destination/[citySlug]/page.tsx` (4 URL + 1 Intl + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/hotels/page.tsx` (2 URL + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/guides/page.tsx` (3 URL + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/classements/page.tsx` (4 URL + 1 hreflangKey + local `withLocalePrefix` supprimé)
- ✅ `packages/seo/src/jsonld/{article,collection-page,hotel}.ts` — schéma `inLanguage` élargi à `string` (V2-ready, 89 tests SEO passent)

**Paquet 3 — 3 hubs secondaires (commit `b9a8002`)**

- ✅ `app/[locale]/marque/[brandSlug]/page.tsx` (4 URL + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/categorie/[categorySlug]/page.tsx` (5 URL + local `withLocalePrefix` supprimé)
- ✅ `app/[locale]/classements/[axe]/[valeur]/page.tsx` (4 URL + 1 hreflangKey + local `withLocalePrefix` supprimé)

**Paquet 9 — formatters Intl (commit `4819ee0`)**

- ✅ `lib/format-indicative-price.ts` (2 Intl ternaires → `intlLocaleTag`)
- ⏸️ `lib/format-distance.ts` et `lib/poi-hours.ts` **reclassifiés Phase 1c** — leurs ternaires sélectionnent du texte visible (`"sur place"` / `"on site"`), pas des Intl tags. Migration vers `next-intl` messages.

**Paquet 7 — espace compte (commit `7196bd0`)**

- ✅ `app/[locale]/compte/page.tsx` (3 URL + 2 Intl ternaires)
- ✅ `app/[locale]/compte/connexion/page.tsx` (1 URL ternaire)
- ✅ `app/[locale]/compte/inscription/page.tsx` (1 URL ternaire)
- ✅ `app/[locale]/compte/nouveau-mot-de-passe/page.tsx` (1 URL ternaire)
- ✅ `app/[locale]/compte/favoris/page.tsx` (2 URL ternaires)
- ✅ `app/[locale]/compte/deconnexion/route.ts` (1 URL ternaire)

**Paquet 4 — éditorial guide ville (commit `5c6eb77`, sous-agent)**

- ✅ `app/[locale]/guide/[citySlug]/page.tsx` : 9 ternaires migrés (canonical URL + `alternates.languages` + `openGraph.locale` + `Intl.DateTimeFormat` tag + Article JSON-LD `inLanguage` + 4 sites `withLocalePrefix` ; local helper supprimé). 32 ternaires restants (28 data-layer column picks + 4 UI copy) annotés `Phase 1c`.

**Paquet 5 — éditorial ranking détail (commit `9631937`, sous-agent)**

- ✅ `app/[locale]/classement/[slug]/page.tsx` : 10 ternaires migrés (canonical URL + `alternates.languages` + `openGraph.locale` + `Intl.DateTimeFormat` tag + Article JSON-LD `inLanguage` + 4 sites `withLocalePrefix` ; local helper supprimé). 25 ternaires restants (23 data-layer + 2 UI copy) annotés `Phase 1c`.

**Paquet 6 — tunnel booking (commit `2f0b3e5`)**

- ✅ `app/[locale]/reservation/start/page.tsx` (1 URL prefix)
- ✅ `app/[locale]/reservation/recap/page.tsx` (1 URL prefix + 1 Intl tag)
- ✅ `app/[locale]/reservation/invite/page.tsx` (2 URL + 1 `FIXME` annoté pour un bug pré-existant de chemin de redirect FR)
- ✅ `app/[locale]/reservation/payment/page.tsx` (1 URL prefix + 1 Intl tag)
- ✅ `app/[locale]/reservation/offer/[offerId]/lock/route.ts` (signatures `locale: string` → `locale: Locale`, 2 URL prefix)
- ✅ `app/[locale]/reservation/confirmation/[ref]/page.tsx` (1 URL prefix + 1 Intl tag)

**Paquet 8a — composants fiche hôtel (commit `fe1576a`, sous-agent)**

- ✅ `components/hotel/display-only-booking-card.tsx` (1 URL — `form action`)
- ✅ `components/hotel/hotel-favorite-button.tsx` (2 URL — `router.push` post-signin, query string `?next=…` préservée)
- ✅ `components/hotel/hotel-featured-reviews.tsx` (1 Intl tag — DateTimeFormat)
- ✅ `components/hotel/hotel-mice-events.tsx` (1 Intl tag — NumberFormat ; `localeFmt` hoisté supprimé, inliné)
- ✅ `components/hotel/hotel-tldr.tsx` (1 Intl tag ; 1 ternaire `firstSentence` annoté Phase 1c)
- ✅ `components/hotel/related-hotels.tsx` (1 URL — `Link href` ; 3 picks `slug_en`/`name_en`/`description_en` + 1 UI copy annotés Phase 1c)

**Paquet 8b — composants éditoriaux (commit `b6c4cd6`)**

- ✅ `components/editorial/enriched-text.tsx` (local `withLocalePrefix` supprimé, type prop élargi `'fr' | 'en'` → `Locale`, 2 sites refactorés)
- ✅ `components/editorial/editorial-table.tsx` (`cell.toLocaleString(intlLocaleTag(locale))`)

**Paquet 10 — sub-sitemaps (commit `bc7468c`)**

- ✅ `lib/sitemap-alternates.ts` créé — `buildSitemapAlternates(hrefForLocale)` itère `routing.locales` + `hreflangKey` (V2-ready, ajout d'une locale = 0 ligne à changer)
- ✅ `app/sitemaps/hotels.xml/route.ts` (alternates dynamiques + `withLocalePath`)
- ✅ `app/sitemaps/rooms.xml/route.ts` (idem)
- ✅ `app/sitemaps/guides.xml/route.ts` (idem)
- ✅ `app/sitemaps/rankings.xml/route.ts` (idem, hub + détails + sous-hubs `/classements/[axe]/[valeur]`)
- ✅ `app/sitemaps/hubs.xml/route.ts` (idem, directory + entrées villes)

**Paquet 11 — catch-all routes (commit `f9af676`)**

- ✅ `app/[locale]/page.tsx` (homepage — narrowing `isRoutingLocale` + `withLocalePath` pour TravelAgency `url`)
- ✅ `app/[locale]/destination/page.tsx` (local helper supprimé, `generateMetadata` canonical + hreflang + ItemList URL)
- ✅ `app/[locale]/(legal)/_components/legal-metadata.ts` (canonical + hreflang + `ogLocale`)
- ✅ `app/[locale]/(legal)/_components/legal-shell.tsx` (Intl tag)
- ✅ `app/[locale]/auth/callback/route.ts` (`accountPath` via `withLocalePath`, types `'fr' | 'en'` → `Locale`)
- ✅ `server/auth/actions.ts` (`accountPath` + 2 URL callback `withLocalePath`)
- ✅ `server/booking/confirm-payment.ts` (`fmtPrice` Intl tag — sujet email FR/EN laissé Phase 1c)
- ✅ `components/seo/last-updated-badge.tsx` (Intl tag — label UI annoté Phase 1c)
- ✅ `components/price-comparator/price-comparator-client.tsx` (Intl tag dans `formatEuroAmount`)

### Helpers disponibles dans `apps/web/src/i18n/runtime.ts`

| Helper                               | Remplace le pattern                                            | Locales supportées      |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------- |
| `localePathPrefix(locale)`           | `locale === 'fr' ? '' : '/en'`                                 | fr/en/de/es/it/ar/zh/ja |
| `withLocalePath(locale, path)`       | ``locale === 'en' ? `/en${path}` : path``                      | idem                    |
| `intlLocaleTag(locale)`              | `locale === 'en' ? 'en-GB' : 'fr-FR'`                          | idem                    |
| `ogLocale(locale)`                   | `locale === 'fr' ? 'fr_FR' : 'en_US'`                          | idem                    |
| `hreflangKey(locale)`                | clé brute `'fr-FR'` / `'en'` dans `alternates.languages`       | idem                    |
| `buildHreflangAlternates(buildHref)` | `{ 'fr-FR': '...', 'en': '...', 'x-default': '...' }` littéral | idem                    |

### Reliquat post-Phase 1b (suite directe en Phase 1c)

Tous les paquets initialement prévus en Phase 1b sont livrés. Le reliquat de ternaires est compilé ci-dessous pour traçabilité — il sera adressé en bloc dans la session Phase 1c.

| Famille                                                                       | Fichiers                                                                                                                                                                                                                                                                                                                                                                                                    | Phase ciblée |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Picks de colonne data-layer (`name_fr` / `name_en`, `slug` / `slug_en`, etc.) | `server/hotels/{get-hotel-by-slug,get-room-by-slug,dev-fake-hotel-detail}.ts`, `server/destinations/cities.ts`, `components/hotel/{related-hotels,hotel-featured-in-rankings}.tsx`, toutes les routes `app/[locale]/**` déjà passées en 1b qui gardent leurs picks annotés                                                                                                                                  | 1c           |
| Copy maps `{ fr: '...', en: '...' }` et chaînes UI hardcodées                 | `components/editorial/{toc-sidebar,external-sources-footer,editorial-glossary,editorial-callout}.tsx`, `components/rankings/rankings-facets.tsx`, `components/hotel/{hotel-tldr,related-hotels}.tsx`, `components/seo/last-updated-badge.tsx`, `lib/{format-distance,poi-hours}.ts`, `app/[locale]/compte/*` quelques labels résiduels, `app/[locale]/reservation/invite/page.tsx` (FIXME bug pré-existant) | 1c           |
| Email subjects et corps email FR/EN                                           | `server/booking/{email-request,confirm-payment}.ts`                                                                                                                                                                                                                                                                                                                                                         | 1c           |
| Tests + fixtures de `runtime.ts`                                              | `i18n/runtime.test.ts` (intentionnel — `'fr'` / `'en'` sont des fixtures de test)                                                                                                                                                                                                                                                                                                                           | hors phase   |

### Hors périmètre Phase 1b (reportés explicitement)

| Fichier                                                      | Pourquoi                                                             | Phase ciblée |
| ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------ |
| `server/hotels/get-hotel-by-slug.ts` (32)                    | sélecteurs `pickName / pickDescription / pickSlug` — pure data layer | Phase 1c     |
| Composants UI avec `{ fr: '...', en: '...' }` maps           | doivent migrer vers `next-intl` messages, pas vers les helpers       | Phase 1c     |
| 5 ternaires data-layer restants dans `hotel/[slug]/page.tsx` | annotés en code, picks name/description/slug                         | Phase 1c     |

### Procédure pour chaque fichier

1. Importer les helpers nécessaires depuis `@/i18n/runtime`.
2. Pour chaque ternaire `locale === 'fr' ? a : b` ou `locale === 'en' ? c : d`, identifier le helper correspondant (tableau ci-dessus).
3. Si le pattern n'est dans aucun helper, **ajouter le helper dans `runtime.ts`** (avec test) plutôt que dupliquer le ternaire. Discutable au cas par cas.
4. `pnpm --filter @mch/web typecheck` après chaque fichier.
5. PR par paquets de 5 fichiers max. Reviewer doit vérifier qu'aucun comportement FR/EN ne change (diff visuel : `localePathPrefix('en')` retourne bien `'/en'`).

### Anti-patterns à refuser en revue

- Importer `routing` directement pour reconstruire un ternaire — utiliser le helper.
- Ajouter un cas `else if (locale === 'de')` dans un ternaire existant au lieu d'utiliser le helper — c'est exactement le problème qu'on cherche à éliminer.
- Toucher `pickXxx(row, locale)` dans cette phase — laisse à Phase 1c.

## Phase 1c — Élargir `SupportedLocale` + migrer les copy maps (livré, session 3)

Phase 1c est désormais close, en deux sous-phases livrées dans la même session :

### Phase 1c-α — Élargissement `SupportedLocale` (data layer)

Livrables :

1. ✅ `apps/web/src/lib/assert-never.ts` — helper d'exhaustivité TypeScript :
   ```ts
   export function assertNever(x: never): never {
     throw new Error('Unreachable: ' + JSON.stringify(x));
   }
   ```
2. ✅ `apps/web/src/i18n/supported-locale.ts` — type V2 + helpers de policy :
   - `type SupportedLocale = 'fr' | 'en' | 'de' | 'es' | 'it'`
   - `pickLocalizedText(locale, fr, en)` — policy V2 (FR/DE/ES/IT → `fr ?? en`, EN → `en ?? fr`)
   - `pickByLocale(locale, frBranch, enBranch)` — variante pour branches non-textuelles (slugs, candidate keys, colonnes SQL)
   - `isV1Locale(locale)` — narrowing helper
3. ✅ Élargissement des helpers de présentation dans `runtime.ts` (`localePathPrefix`, `withLocalePath`, `intlLocaleTag`, `ogLocale`, `hreflangKey`) à `KnownLocale` (superset V3-ready), pour qu'un caller passant `SupportedLocale` compile.
4. ✅ Refactorisation de **tous** les `pickXxx(row, locale)` data-layer pour utiliser le pattern `switch + assertNever`, avec FR fallback documenté pour DE/ES/IT pendant la fenêtre 1c → 3 :
   - `server/destinations/cities.ts` (3 picks)
   - `server/hotels/get-room-by-slug.ts` (3 picks + `readAmenityList` + `localizeImages`)
   - `server/hotels/get-hotel-by-slug.ts` (32 picks — le plus gros)
   - `server/hotels/dev-fake-hotel-detail.ts` (drop no-op spread)
5. ✅ Routes `app/[locale]/**` avec ternaires data-layer migrées (`classement/[slug]/page.tsx`, etc.) — utilisent `pickLocalizedText` / `pickByLocale`.
6. ✅ Bug pré-existant `reservation/invite/page.tsx#expiredPath` (branche FR donnait un 404) corrigé en alignant sur `recap/page.tsx#expiredPath` via `withLocalePath`.
7. ✅ Utilitaires `lib/format-distance.ts` + `lib/poi-hours.ts` et composants `hotel-location.tsx` + `hotel-events.tsx` élargis à `SupportedLocale` (utilisent `pickByLocale` pour le séparateur décimal, l'unité, le format d'heures, le mois en lettres long vs court).

### Phase 1c-β — Migration des copy maps vers `next-intl`

Livrables :

1. ✅ **Composants éditoriaux** — copy maps `{ fr: '...', en: '...' }` remplacées par `getTranslations` (async server components) ou `useTranslations` (client) :
   - `components/seo/last-updated-badge.tsx` (variante inline / block)
   - `components/editorial/toc-sidebar.tsx` (client — `useTranslations`)
   - `components/editorial/editorial-glossary.tsx` (sorting via `intlLocaleTag` natif)
   - `components/editorial/editorial-callout.tsx` (5 `kind` mappés via `KIND_MESSAGE_KEY`)
   - `components/editorial/editorial-table.tsx` (helper `pickLocalized` interne)
   - `components/editorial/external-sources-footer.tsx` (8 groupes via `TYPE_GROUP_KEY`)
2. ✅ **Composants hotel + rankings** — TL;DR, "featured in rankings", related hotels, facets :
   - `components/hotel/hotel-tldr.tsx` — devenu async server component ; 14-key `T` copy map remplacée par messages `hotelTldr.*`. Sentence templates split en deux clés (`firstSentencePalace` / `firstSentenceFiveStar`) car FR/EN diffèrent structurellement (présence du mot "hôtel" avant le statut). ICU plural sur l'inventaire chambres/suites.
   - `components/hotel/hotel-featured-in-rankings.tsx` — async server component, `rankLabel` en ICU `{rank}` (DE peut écrire `Nr.{rank}`).
   - `components/hotel/related-hotels.tsx` — async server component ; 8 templates avec `{city}` / `{brand}` / `{region}` ; helper local `blankToNull` pour normaliser le legacy "empty string = absent" avant `pickLocalizedText`.
   - `components/rankings/rankings-facets.tsx` (client) — `useTranslations` ; la prop `locale` devenue inutilisée a été retirée du composant ET du consumer `classements/page.tsx`.
3. ✅ **Email subjects** — sujets Brevo migrés vers ICU templates :
   - `server/booking/confirm-payment.ts` — `bookingConfirmedSubject` ; `fmtPrice` élargi à `SupportedLocale`. La signature `sendConfirmationEmail.locale` reste `'fr' | 'en'` pour matcher le template React-Email `BookingConfirmationGuest` qui n'a pas encore de copy DE/ES/IT (commentaire en code).
   - `server/booking/email-request.ts` — `emailRequestGuestSubject` ; le sujet ops reste EN-only (lu par l'équipe interne, pas par le client — commentaire en code).

### Re-survey final (post-session 3)

`rg "locale === ['\"]fr['\"]|locale === ['\"]en['\"]" apps/web/src` ne renvoie plus que **9 lignes**, toutes intentionnelles :

| Catégorie                                       | Fichiers                                                                         | Raison                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Doc des helpers                                 | `i18n/runtime.ts`, `lib/assert-never.ts`                                         | exemples dans les JSDoc pour expliquer ce que le helper remplace                    |
| Tests des helpers                               | `i18n/runtime.test.ts` (2 lignes)                                                | fixtures de test ciblant explicitement V1                                           |
| Predicate intentionnel                          | `i18n/supported-locale.ts` (`isV1Locale`)                                        | narrowing officiel V1 ↔ V2                                                          |
| Picks alternates dans `buildHreflangAlternates` | `app/[locale]/hotel/[slug]/page.tsx`, `app/sitemaps/{hotels,rooms}.xml/route.ts` | `l: Locale` à l'intérieur du callback — devient moot dès Phase 3 (`*_translations`) |
| Sélecteur de langue UI                          | `components/layout/locale-switcher.tsx`                                          | toggle binaire intentionnel — sera ré-architecturé en Phase 2/4                     |

Plus **aucun ternaire applicatif** à migrer. Phase 1c close.

### Si vous reprenez Phase 1c (rappel des étapes originelles)

Conservé pour mémoire ; toutes les étapes ont été exécutées :

1. ✅ Type `SupportedLocale = 'fr' | 'en' | 'de' | 'es' | 'it'` défini dans `apps/web/src/i18n/supported-locale.ts`.
2. ✅ Chaque `pickXxx(row, locale)` réécrit en `switch (locale) { case 'fr': ...; case 'en': ...; case 'de': case 'es': case 'it': /* FR fallback */; default: return assertNever(locale); }`.
3. ✅ Helper `assertNever` créé dans `apps/web/src/lib/assert-never.ts`.
4. ✅ FR fallback documenté dans chaque `pickXxx` jusqu'à Phase 3.
5. ✅ `pnpm --filter @mch/web typecheck` passe ; `pnpm --filter @mch/web test` → 43/43 pass (3 suites failure pre-existantes par variables d'env manquantes en local, hors scope).

**Garde-fou** (toujours valable jusqu'en Phase 4) : ne PAS ajouter `'de'` / `'es'` / `'it'` à `routing.locales`. Le widening `SupportedLocale` est interne aux couches serveur et présentation ; le routing reste FR/EN tant que le contenu DE/ES/IT n'est pas produit.

## Phase 2 — `routing.pathnames` (estimé : 0.5 jour)

Implémenter le mapping promis dans la rule [`seo-geo.mdc`](../../.cursor/rules/seo-geo.mdc) §Slugs d'URL :

```ts
// apps/web/src/i18n/routing.ts
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  pathnames: {
    '/recherche': { fr: '/recherche', en: '/search' },
    '/a-propos': { fr: '/a-propos', en: '/about' },
    '/compte': { fr: '/compte', en: '/account' },
    // ... voir rule seo-geo.mdc pour la liste complète
    '/hotel/[slug]': '/hotel/[slug]', // identique partout (ADR-0008 flat slug)
  },
});
```

Refactorer tous les `<Link href="/recherche">` pour qu'ils utilisent la signature compatible `pathnames` (objet `{ pathname, params }` au lieu de string). Voir la doc next-intl 3.x.

## Phase 3 — Migrations DB + Payload (estimé : 2-3 jours)

### Migration 0034 — créer les 5 tables `*_translations`

Schéma cible : voir ADR-0012 (option B retenue).

Lockstep avec [`supabase-rls.mdc`](../../.cursor/rules/supabase-rls.mdc) :

- RLS activé sur chaque table, policies héritent du parent via FK CASCADE
- Index unique composite `(locale, slug)` sur chaque `*_translations` qui porte un slug
- Index covering sur la FK (règle non-négociable Supabase advisor)
- Entrée dans `public._cct_sql_migrations`

### Migration 0035 — backfill idempotent

Pivot des 37 colonnes texte existantes en lignes. Pseudo-code :

```sql
insert into public.hotel_translations (hotel_id, locale, name, description, slug, meta_title, meta_desc)
select id, 'fr', name, description_fr, slug, meta_title_fr, meta_desc_fr from public.hotels
on conflict (hotel_id, locale) do nothing;

insert into public.hotel_translations (hotel_id, locale, name, description, slug, meta_title, meta_desc)
select id, 'en', coalesce(name_en, name), description_en, coalesce(slug_en, slug), meta_title_en, meta_desc_en
from public.hotels
where description_en is not null or slug_en is not null
on conflict (hotel_id, locale) do nothing;
```

Idempotent — re-runnable sans risque.

### Migration 0036 — DROP des colonnes legacy

À appliquer **seulement après 2 semaines d'observation production stable** avec instrumentation Sentry `hotel_translations_fallback_used = 0` (cf. ADR-0012 §Validation).

Forward-only — irréversible sans dump pré-migration.

### Payload — ADR-0010 dual-table mirror étendu

Le hook `afterChange` de la collection Hotels doit :

1. Mapper les translations Payload → `cms.hotel_translations` (UPSERT par locale)
2. Mapper `cms.hotel_translations` → `public.hotel_translations` (UPSERT par locale)
3. Revalidate ISR par locale : `revalidateTag('hotel:<slug>:<locale>')`

Voir [ADR-0010](../adr/0010-payload-dual-table-mirror.md) §Plan de Phase 8.1 pour le pattern.

## Phase 4 — Activation V2 (DE en premier)

Suivre la checklist 13 surfaces de [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md) §"Add a new locale". Pré-requis : Phase 1c + Phase 3 terminées, contenu DE produit par un rédacteur natif (pas de traduction LLM brute non-relue).

## Décisions ouvertes pour la prochaine session

1. **Stratégie de slugs DE/ES/IT** : actuellement la rule `seo-geo.mdc` dit que les slugs hôtels restent identiques entre langues (ADR-0008 flat slug). À confirmer : est-ce qu'on garde `/de/hotel/le-bristol` ou on localise en `/de/hotel/das-bristol` ? Recommandation : garder identique pour les hôtels (cohérent avec ADR-0008), localiser seulement les slugs de navigation (`/recherche` → `/suche` etc.). À acter en révisant l'ADR-0008 ou en ouvrant un ADR-0013 dédié.

2. **Rédacteur DE** : sourcer un rédacteur natif allemand expérimenté hôtellerie luxe avant Phase 4. Budget à provisionner (≈ 80-120 €/h, ~106 hôtels × 30 min de relecture par fiche = ~50-80h pour la première vague).

3. **Localisation du programme de fidélité et emails Brevo** : touche `packages/emails/` et impacte la conformité légale (CGV par locale ?). À cadrer en parallèle de Phase 4.
