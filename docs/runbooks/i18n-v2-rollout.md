# Plan d'exécution — Rollout multilingue V2 (DE/ES/IT)

> Plan opérationnel suivant [ADR-0012](../adr/0012-multilingual-db-schema.md).
> Skill de référence : [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md)
> §V2 multilingual rollout.

## État au 2026-05-19

| Phase                                          | Statut                | Livrable                                          |
| ---------------------------------------------- | --------------------- | ------------------------------------------------- |
| 0 — ADR-0012 schéma DB multilingue             | ✅ accepted           | `docs/adr/0012-multilingual-db-schema.md`         |
| 1a — `runtime.ts` helpers centralisés          | ✅ livré              | `apps/web/src/i18n/runtime.ts` + 13 tests vitest  |
| 1b — Codemod 32 hotspots                       | ⏳ à faire            | PRs dédiés par paquets de 5 fichiers              |
| 1c — Élargir `SupportedLocale` + `assertNever` | ⏳ à faire (après 1b) | `get-hotel-by-slug.ts` + readers serveur          |
| 2 — `routing.pathnames`                        | ⏳ à faire            | `routing.ts` + refactor `<Link>`                  |
| 3 — Migrations DB + Payload                    | ⏳ à faire            | `0034`, `0035`, `0036` + dual-table mirror étendu |
| 4 — Activation V2 (DE en premier)              | ⏳ à faire            | `messages/de.json` + contenu rédacteur natif      |

## Phase 1b — Codemod 32 hotspots (estimé : 1 jour)

Objectif : remplacer toutes les occurrences de `locale === 'fr'` / `locale === 'en'` par les helpers de `runtime.ts`. Aucun changement de comportement attendu pour FR/EN — diff = pure refactorisation.

### Helpers disponibles dans `apps/web/src/i18n/runtime.ts`

| Helper                               | Remplace le pattern                                            | Locales supportées      |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------- |
| `localePathPrefix(locale)`           | `locale === 'fr' ? '' : '/en'`                                 | fr/en/de/es/it/ar/zh/ja |
| `withLocalePath(locale, path)`       | ``locale === 'en' ? `/en${path}` : path``                      | idem                    |
| `intlLocaleTag(locale)`              | `locale === 'en' ? 'en-GB' : 'fr-FR'`                          | idem                    |
| `ogLocale(locale)`                   | `locale === 'fr' ? 'fr_FR' : 'en_US'`                          | idem                    |
| `hreflangKey(locale)`                | clé brute `'fr-FR'` / `'en'` dans `alternates.languages`       | idem                    |
| `buildHreflangAlternates(buildHref)` | `{ 'fr-FR': '...', 'en': '...', 'x-default': '...' }` littéral | idem                    |

### Hotspots par ordre de priorité

| Ordre | Fichier                                                                                         | Occurrences    | Type de ternaire                                                                     | Helper à utiliser                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1     | `app/[locale]/hotel/[slug]/page.tsx`                                                            | 12             | path prefix, hreflang, og:locale, intl tag, lockAction                               | `withLocalePath`, `buildHreflangAlternates`, `ogLocale`, `intlLocaleTag`                                 |
| 2     | `app/[locale]/hotel/[slug]/chambres/[roomSlug]/page.tsx`                                        | 5              | mêmes patterns                                                                       | mêmes helpers                                                                                            |
| 3     | `app/[locale]/recherche/page.tsx`                                                               | 2              | canonical, hreflang                                                                  | `withLocalePath`, `buildHreflangAlternates`                                                              |
| 4     | `app/[locale]/destination/[citySlug]/page.tsx`                                                  | 6              | idem                                                                                 | idem                                                                                                     |
| 5     | `app/[locale]/guide/[citySlug]/page.tsx`                                                        | 37             | déjà gros, mérite son propre paquet                                                  | idem + composants éditoriaux                                                                             |
| 6     | `app/[locale]/classement/[slug]/page.tsx`                                                       | 30             | idem                                                                                 | idem                                                                                                     |
| 7     | `app/[locale]/classements/[axe]/[valeur]/page.tsx`                                              | 6              | idem                                                                                 | idem                                                                                                     |
| 8     | `app/[locale]/marque/[brandSlug]/page.tsx`                                                      | 5              | idem                                                                                 | idem                                                                                                     |
| 9     | `app/[locale]/categorie/[categorySlug]/page.tsx`                                                | 9              | idem                                                                                 | idem                                                                                                     |
| 10    | `app/[locale]/layout.tsx`                                                                       | 2              | hreflang home + og:locale                                                            | `buildHreflangAlternates`, `ogLocale`                                                                    |
| 11    | Sub-sitemaps `sitemaps/{hotels,rooms,hubs,guides,rankings}.xml/route.ts`                        | ~5 par fichier | hreflang alternates en dur                                                           | `buildHreflangAlternates` + boucle `routing.locales`                                                     |
| 12    | `server/hotels/get-hotel-by-slug.ts`                                                            | 32             | **PAS** path/hreflang — c'est `pickXxx(row, locale)` qui choisit la colonne FR vs EN | **NE PAS toucher dans 1b** — fait en 1c en même temps que l'élargissement `SupportedLocale`              |
| 13    | Composants client : `hotel-tldr.tsx`, `concierge-advice.tsx`, `hotel-favorite-button.tsx`, etc. | ~2-5 chacun    | maps de copy `{ fr: ..., en: ... }` en dur                                           | À traiter en 1c (besoin des tables `*_translations` ? non — ces maps UI restent dans next-intl messages) |

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
