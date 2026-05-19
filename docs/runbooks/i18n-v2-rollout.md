# Plan d'exécution — Rollout multilingue V2 (DE/ES/IT)

> Plan opérationnel suivant [ADR-0012](../adr/0012-multilingual-db-schema.md).
> Skill de référence : [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md)
> §V2 multilingual rollout.

## État au 2026-05-19 (fin de session)

| Phase                                          | Statut                           | Livrable                                                                             |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| 0 — ADR-0012 schéma DB multilingue             | ✅ accepted                      | `docs/adr/0012-multilingual-db-schema.md`                                            |
| 1a — `runtime.ts` helpers centralisés          | ✅ livré (commit `5fc60c4`)      | `apps/web/src/i18n/runtime.ts` + 13 tests vitest                                     |
| 1b — Codemod hotspots                          | 🟡 18 / ~50 fichiers (5 commits) | 70+ ternaires de prefix/OG/Intl supprimés, 10 duplicats `withLocalePrefix` collapsés |
| 1c — Élargir `SupportedLocale` + `assertNever` | ⏳ à faire (après 1b complet)    | `get-hotel-by-slug.ts` + readers serveur                                             |
| 2 — `routing.pathnames`                        | ⏳ à faire                       | `routing.ts` + refactor `<Link>`                                                     |
| 3 — Migrations DB + Payload                    | ⏳ à faire                       | `0034`, `0035`, `0036` + dual-table mirror étendu                                    |
| 4 — Activation V2 (DE en premier)              | ⏳ à faire                       | `messages/de.json` + contenu rédacteur natif                                         |

### Re-survey du 2026-05-19 (fin de session, 5 commits)

Le tableau d'hotspots initial était un échantillon. Survey exhaustif réalisé : **plus de 50 fichiers** contiennent au moins un ternaire `locale === 'fr' / 'en'` dans `apps/web/src/`. Les gros offenders (à traiter en priorité dans les prochains paquets) :

| Fichier                                            | Ternaires restants | Notes                                                                                                      |
| -------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `app/[locale]/guide/[citySlug]/page.tsx`           | 37                 | éditorial long-read, beaucoup de copy maps en dur → certains relèvent de 1b (URL), d'autres de 1c (data)   |
| `server/hotels/get-hotel-by-slug.ts`               | 32                 | **Phase 1c uniquement** — c'est du data layer (pickName, pickDescription, pickSlug)                        |
| `app/[locale]/classement/[slug]/page.tsx`          | 30                 | éditorial ranking, même pattern que guide                                                                  |
| `app/[locale]/categorie/[categorySlug]/page.tsx`   | 9                  | hub catégorie                                                                                              |
| `app/[locale]/hotel/[slug]/page.tsx`               | 6 (restants)       | tous data-layer (pickName, pickDescription, titleOverride, descOverride, slugForLocale) — pour Phase 1c    |
| `app/[locale]/marque/[brandSlug]/page.tsx`         | 5                  | hub marque, mix prefix + data                                                                              |
| `app/[locale]/hotels/page.tsx`                     | 5                  | landing hôtels                                                                                             |
| `app/[locale]/guides/page.tsx`                     | 6                  | landing guides                                                                                             |
| `app/[locale]/classements/page.tsx`                | 6                  | landing classements                                                                                        |
| `app/[locale]/classements/[axe]/[valeur]/page.tsx` | 6                  | landing axes/valeurs                                                                                       |
| `app/[locale]/destination/[citySlug]/page.tsx`     | 6                  | hub destination                                                                                            |
| `app/[locale]/compte/*` (5 fichiers)               | ~14 cumulés        | espace compte, plusieurs sont des ternaires de redirect URL → 1b applicable                                |
| `app/[locale]/reservation/*` (5 fichiers)          | ~12 cumulés        | tunnel booking, mix prefix + email locale                                                                  |
| `components/editorial/*` (6 fichiers)              | ~12 cumulés        | composants long-read (TOC, callouts, glossary) — copy maps `{ fr: '...', en: '...' }` → next-intl messages |
| `components/hotel/*` (5 fichiers)                  | ~8 cumulés         | TLDr, favorite, related — copy maps → next-intl                                                            |
| `lib/format-distance.ts`, `lib/poi-hours.ts`       | 5 cumulés          | formatters Intl → utiliser `intlLocaleTag` du runtime helper                                               |

Une fois Phase 1b complète, attendre **0 ternaire de prefix/OG/Intl** dans le code applicatif. Les ternaires restants doivent **tous** être des sélections de colonne FR vs EN au niveau data (que Phase 1c + Phase 3 vont collapser).

## Phase 1b — Codemod hotspots (estimé : 2 jours, par paquets)

Objectif : remplacer toutes les occurrences de `locale === 'fr'` / `locale === 'en'` qui touchent **URL prefix, OG locale, Intl tag, hreflang** par les helpers de `runtime.ts`. Aucun changement de comportement attendu pour FR/EN — diff = pure refactorisation.

**Périmètre exclu de 1b** : les ternaires qui sélectionnent une **colonne** FR vs EN (`name_fr` vs `name_en`, `slug` vs `slug_en`, etc.) — ces ternaires restent jusqu'à Phase 1c (qui élargit `SupportedLocale`) puis Phase 3 (qui collapse les colonnes en tables de translations).

**Statut au 2026-05-19 (fin de session)** : **18 / ~50 fichiers traités**. Voir la section "Re-survey" ci-dessus pour la liste à attaquer en priorité.

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

### Helpers disponibles dans `apps/web/src/i18n/runtime.ts`

| Helper                               | Remplace le pattern                                            | Locales supportées      |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------- |
| `localePathPrefix(locale)`           | `locale === 'fr' ? '' : '/en'`                                 | fr/en/de/es/it/ar/zh/ja |
| `withLocalePath(locale, path)`       | ``locale === 'en' ? `/en${path}` : path``                      | idem                    |
| `intlLocaleTag(locale)`              | `locale === 'en' ? 'en-GB' : 'fr-FR'`                          | idem                    |
| `ogLocale(locale)`                   | `locale === 'fr' ? 'fr_FR' : 'en_US'`                          | idem                    |
| `hreflangKey(locale)`                | clé brute `'fr-FR'` / `'en'` dans `alternates.languages`       | idem                    |
| `buildHreflangAlternates(buildHref)` | `{ 'fr-FR': '...', 'en': '...', 'x-default': '...' }` littéral | idem                    |

### Prochains paquets recommandés (restants)

Reprendre dans cet ordre — priorisé par impact SEO et risque :

| Paquet | Fichiers                                                 | Pourquoi                                                                                                              |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 4      | `guide/[citySlug]/page.tsx` SEUL (37 ternaires)          | gros morceau éditorial — mérite son propre commit pour la revue. Mix prefix + UI copy maps (UI copy → tracker en 1c). |
| 5      | `classement/[slug]/page.tsx` SEUL (30 ternaires)         | éditorial ranking long-read, même pattern que guide.                                                                  |
| 6      | `reservation/*` (5 fichiers, ~12 ternaires)              | tunnel booking — **vigilance sur lockAction + email locale** (impact revenu direct, tester E2E avant merge).          |
| 8a     | `components/hotel/*` (5 fichiers, ~8 ternaires)          | composants fiche (TLDr, favorite, related) — beaucoup de copy maps `{ fr: '...', en: '...' }` → next-intl messages.   |
| 8b     | `components/editorial/*` (6 fichiers, ~12 ternaires)     | composants long-read (TOC, callouts, glossary) — idem.                                                                |
| 9-bis  | `lib/format-distance.ts`, `lib/poi-hours.ts` (5 cumulés) | UI strings — migration vers `next-intl` messages plutôt que helpers runtime.                                          |
| 10     | Sub-sitemaps `sitemap-*.xml/route.ts` (à survey)         | hreflang en dur — boucle `routing.locales` + `buildHreflangAlternates`.                                               |

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

## Phase 1c — Élargir `SupportedLocale` (estimé : 0.5 jour)

Une fois 1b terminé (donc aucun ternaire FR/EN brut restant dans le code applicatif) :

1. Dans `apps/web/src/server/hotels/get-hotel-by-slug.ts`, élargir :
   ```ts
   export type SupportedLocale = 'fr' | 'en' | 'de' | 'es' | 'it';
   ```
2. Dans chaque `pickXxx(row, locale)`, remplacer le `if (locale === 'fr') return X else return Y` par un `switch (locale) { case 'fr': ...; case 'en': ...; default: assertNever(locale); }`.
3. Helper `assertNever` à créer si absent : `function assertNever(x: never): never { throw new Error('Unreachable locale: ' + x); }`.
4. Tant que la migration DB Phase 3 n'est pas faite, les cas DE/ES/IT renvoient `null` (les colonnes n'existent pas encore). Documenter dans le commentaire de chaque `pickXxx` que c'est l'attendu pendant la fenêtre 1c → 3.
5. `pnpm --filter @mch/web typecheck` doit passer.

**Garde-fou** : ne PAS ajouter `'de'` / `'es'` / `'it'` à `routing.locales` à cette étape. Le widening `SupportedLocale` est interne à la couche serveur — le routing reste FR/EN pour le moment.

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
