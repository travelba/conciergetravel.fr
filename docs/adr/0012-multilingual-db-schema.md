# ADR 0012 — Schéma DB multilingue pour le rollout V2 (DE/ES/IT) et V3 (AR/ZH/JA)

- Status: **accepted**
- Date: 2026-05-19
- Accepted: 2026-05-19 (porteur produit, par délégation explicite à l'analyse i18n)
- Refs:
  - ADR 0001 (stack), ADR 0003 (Payload CMS), ADR 0010 (dual-table mirror), ADR 0011 (voix Concierge)
  - Skill [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md) §V2 multilingual rollout — état réel (audit mai 2026, 8 blocages structurels)
  - Rule [`seo-geo.mdc`](../../.cursor/rules/seo-geo.mdc) §Rollout multilingue V2
  - Audit i18n du 2026-05-19 — analyse complète conduite avant rédaction de cet ADR

## Décision (proposée)

Adopter l'**option B — table normalisée `*_translations`** : pour chaque entité éditoriale qui porte du texte localisé, créer une table sœur `<entity>_translations(<entity_id>, locale, …)` clé primaire composite. Les colonnes `_fr` / `_en` actuelles sont pivotées en lignes, puis supprimées en migration N+2.

Cinq nouvelles tables au total :

- `public.hotel_translations`
- `public.hotel_room_translations`
- `public.editorial_page_translations`
- `public.editorial_guide_translations`
- `public.editorial_ranking_translations`

Les ~20 champs **JSONB** déjà keyed par locale (`faq_content`, `long_description_sections`, `signature_experiences`, `concierge_advice`, `policies`, `mice_info`, `restaurant_info`, `spa_info`, `featured_reviews`, `highlights`, `amenities`, `editorial_sections`, `editorial_callouts`, `tables`, `glossary`, `external_sources`, `toc_anchors`, `axes`, `points_of_interest`, `transports`) **restent en place** : leur schéma interne accepte déjà une clé `de` / `es` / `it` sans DDL. Seuls les readers Zod sont à étendre.

## Contexte

Le projet est aujourd'hui FR/EN live (rule [`seo-geo.mdc`](../../.cursor/rules/seo-geo.mdc) §Décisions structurantes). L'audit i18n du 2026-05-19 documenté dans le skill [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md) identifie **8 blocages structurels** entre l'état actuel et le rollout V2 promis dans la rule. Le blocage n°5 est le seul **non récupérable sans décision irréversible** : le schéma DB ne sait stocker que du contenu FR + EN.

Inventaire précis des **37 colonnes texte localisées FR/EN** à transposer :

| Table                       | Colonnes texte localisées                                                                                                           | Migration source                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `public.hotels`             | `name` (FR canonical), `name_en`, `description_fr`, `description_en`, `slug` (FR), `slug_en`, `meta_title_fr/en`, `meta_desc_fr/en` | `0001_init_core_schema.sql`                            |
| `public.hotel_rooms`        | `name_fr/en`, `description_fr/en`, `long_description_fr/en`                                                                         | `0001` + `0010_hotel_room_subpage_columns.sql`         |
| `public.editorial_pages`    | `slug_fr/en`, `title_fr/en`, `meta_desc_fr/en`, `content_fr/en`                                                                     | `0001`                                                 |
| `public.editorial_guides`   | `name_fr/en`, `meta_title_fr/en`, `meta_desc_fr/en`                                                                                 | `0026_editorial_guides_rankings.sql`                   |
| `public.editorial_rankings` | `title_fr/en`, `meta_title_fr/en`, `meta_desc_fr/en`, `factual_summary_fr/en`                                                       | `0026` + `0030_editorial_rankings_factual_summary.sql` |

Cette décision conditionne le **refactor Phase 1** (élargir `SupportedLocale`, centraliser les helpers locale, codemod des 32 fichiers à ternaires `locale === 'fr' / 'en'`) — la signature des readers serveur change selon l'option retenue ici.

## Alternatives considérées

### Option A — Colonnes plates par locale (`name_de`, `slug_de`, …)

Pattern : continuer le passage historique FR → EN en ajoutant `_de`, `_es`, `_it`.

**Avantages**

- Aucun JOIN, perf de lecture maximale
- Contraintes SQL fortes directement applicables (`slug_de_ck` regex, `slug_de_unique`)
- Pattern de migration identique à celui appliqué historiquement pour EN — aucune surprise opérationnelle
- ADR-0010 dual-table mirror (Payload `cms.hotels → public.hotels`) inchangé : un seul UPSERT par save

**Inconvénients**

- **Explosion à V3** : 37 × 3 (DE/ES/IT) = 111 nouvelles colonnes en V2, puis 37 × 3 (AR/ZH/JA) = 111 supplémentaires en V3. Table `public.hotels` à terme = ~250 colonnes dont 185 localisées, plus 5 indices unique sur `slug_<xx>`
- Chaque nouvelle colonne business **doit** naître avec ses 5+ variants ou risquer un trou de schéma
- Tests de parité (toutes les locales remplies ?) demandent de grep le nom des colonnes — fragile
- Payload back-office : 37 × 5 = 185 fields à plat dans l'éditeur d'hôtel — UX dégradée
- Migration de schéma à chaque ajout de locale → friction permanente

### Option B — Table normalisée `*_translations` (recommandée)

Pattern : pivot relationnel propre. Schéma cible (illustratif) :

```sql
create table public.hotel_translations (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  locale text not null check (locale in ('fr','en','de','es','it','ar','zh','ja')),
  name text not null,
  description text,
  slug text not null,
  meta_title text,
  meta_desc text,
  long_description_sections jsonb,  -- déjà localisé en interne, reste localisable globalement
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (hotel_id, locale),
  constraint hotel_translations_slug_ck check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index hotel_translations_slug_per_locale_unique
  on public.hotel_translations (locale, slug);

-- RLS : hérite des permissions du parent via FK CASCADE + policy parent-aware
alter table public.hotel_translations enable row level security;
create policy hotel_translations_select_published on public.hotel_translations
  for select to authenticated, anon
  using (
    exists (
      select 1 from public.hotels h
      where h.id = hotel_translations.hotel_id and h.is_published = true
    )
  );
```

**Avantages**

- **Scalable proprement à V3** sans migration DDL — étendre le CHECK constraint suffit
- **Tests de parité SQL triviaux** :
  ```sql
  select h.id, h.slug from public.hotels h
  left join public.hotel_translations t on t.hotel_id = h.id and t.locale = 'de'
  where h.is_published and t.hotel_id is null;
  ```
- **Pattern industriel reconnu** : Sanity, Strapi, Shopify, Stripe utilisent tous le pattern `translations` table. Payload supporte nativement via le field `relationship` + `hasMany`
- **Contraintes SQL fortes préservées** : slug unique per-locale via index composite, regex CHECK, FK CASCADE
- **UX Payload** : un repeater field `translations` avec sub-form par locale → l'éditorial voit les locales côte-à-côte, pas 185 fields à plat
- **RLS lisible** : 1 policy par `*_translations` qui interroge le parent → cohérent avec le pattern `supabase-rls.mdc`
- L'ADR-0010 dual-table mirror reste applicable — voir §"Impact sur ADR-0010" ci-dessous

**Inconvénients**

- **1 JOIN par lecture détaillée d'hôtel**. Mesurable mais probablement < 1 ms (PG joint deux tables sur PK + FK indexés) — à valider en EXPLAIN ANALYZE avant DROP des colonnes legacy
- **Backfill non trivial** : ~1 jour de travail pour le script SQL idempotent qui pivote les 37 colonnes existantes en lignes, plus dry-run et apply
- **ADR-0010 doit étendre le sync** : `cms.hotel_translations → public.hotel_translations` = N UPSERTs par save (1 par locale active), à ajouter au hook `afterChange`
- **Tous les readers `pickName(row, locale)` à refactorer en `pickTranslation(translations, locale)`** — mais c'est précisément ce que le refactor Phase 1 anticipe, donc le coût marginal est nul

### Option C — JSONB localisé sur les colonnes existantes

Pattern : `hotels.name jsonb = { fr: 'Le Bristol', en: 'Le Bristol', de: '…' }`.

**Avantages**

- Pas de table de plus, pas de JOIN
- Cohérent avec les ~20 JSONB déjà localisés en interne
- Ajouter une locale = aucune migration DDL ni de schéma — modifie seulement le contenu

**Inconvénients**

- **Perte des contraintes SQL fortes** : le CHECK regex sur slug et le UNIQUE constraint sur slug ne s'appliquent plus directement sur un `jsonb`. Restauration possible via indices fonctionnels par locale (`create unique index on hotels ((slug->>'de'))`) mais 5+ indices par champ → opacité opérationnelle
- **Payload UX inadaptée** : Payload n'a pas de field natif "JSONB libre keyé par locale". Soit on traite chaque locale comme un sub-field (et on retombe sur l'option A camouflée), soit l'éditeur back-office devient un JSON editor brut → erreurs de frappe non détectées
- **Migration chirurgicale** : transformer `description_fr text` + `description_en text` → `description jsonb` casse **simultanément** tous les `select description_fr` du code (~32 fichiers). Sans Phase 1 refactor préalable, c'est un déploiement à risque maximal
- **Indexation externe (Algolia)** plus complexe : le mapping `slug_fr` → field "slug" devient `slug.fr` → besoin d'aplatir des deux côtés
- **Pas réversible** : une fois en JSONB, repasser en colonnes plates demande une seconde migration de complexité équivalente

## Recommandation

**Option B**, pour cinq raisons hiérarchisées :

1. **Scalabilité à V3 sans douleur** — ajouter `ar`, `zh`, `ja` = 0 migration DDL, contre 111 colonnes pour l'option A. À l'échelle d'un produit 5 ans, l'option A devient ingérable.
2. **Parité testable trivialement en CI** — un SELECT LEFT JOIN détecte les hôtels sans traduction DE en une requête. L'option A demande de grep le nom des colonnes ; l'option C demande des `where slug ? 'de'` qui ne sont pas testables uniformément.
3. **Pattern industriel** — c'est ce que Sanity, Strapi, Shopify et Stripe utilisent. Tout rédacteur ou freelance back-end le reconnaît instantanément. L'option A est un anti-pattern reconnu (column explosion) ; l'option C est exotique pour Payload.
4. **Contraintes SQL préservées** — slug unique par locale, regex CHECK, FK CASCADE restent applicables. C'est notre garantie principale contre les bugs de saisie (slug invalide, doublon) que le RLS seul ne couvre pas.
5. **Backfill réversible** — la migration de création des tables peut être déployée et observée avant que les colonnes legacy ne soient droppées. Deux semaines de fenêtre d'observation, rollback trivial pendant cette fenêtre.

L'option A est **rejetée** sur le critère 1 (explosion). L'option C est **rejetée** sur le critère 3 (Payload UX) et le critère 4 (perte des contraintes fortes).

## Conséquences

### Positives

- Schéma applicatif clair : `public.hotels` porte les champs non-localisés (lat/lng, stars, is_palace, booking_mode, prix, etc.), `public.hotel_translations` porte le texte par locale
- Couche serveur simplifiée : un seul reader `pickTranslation(translations, locale)` remplace ~30 `pickXxx(row, locale)` éparpillés
- Couche Payload cohérente : un repeater field `translations` avec sub-form par locale active
- V3 (AR/ZH/JA, RTL inclus) : aucune migration de schéma, juste extension du CHECK + ajout du contenu
- Tests de parité automatisables en CI (`pnpm --filter @mch/db test:parity` à créer)
- RLS lisible et auditable via Supabase advisor

### Négatives

- **Coût de migration** : ≈ 2-3 jours dev (3 migrations + script de backfill + tests + déploiement progressif)
- **+1 JOIN par lecture détaillée** : impact perf à mesurer mais probablement < 1 ms p99 (PK + FK indexés). À comparer aux 20+ JSONB déjà parsés par hôtel
- **ADR-0010 dual-table mirror** doit étendre son hook `afterChange` : N UPSERTs par save (1 par locale active). Charge éditoriale limitée (≤ 200 fiches palace), pas de souci de perf
- **Tests E2E + fixtures de dev-fake** à mettre à jour : `dev-fake-hotel-detail.ts` doit générer les translations synthétiques
- **Pas réversible après migration N+2 (DROP des colonnes legacy)** sans restauration d'un dump — d'où la fenêtre d'observation imposée

### Impact sur ADR-0010 (dual-table mirror Payload)

Le hook `afterChange` actuel mappe `cms.hotels → public.hotels`. Il doit être étendu pour également mapper `cms.hotel_translations → public.hotel_translations` :

- Pour chaque locale présente dans l'enregistrement Payload, exécuter un UPSERT sur `public.hotel_translations`
- En cas de suppression d'une locale côté Payload, exécuter un DELETE ciblé (les FK CASCADE ne couvrent que la suppression du parent)
- L'idempotence reste garantie par la PK composite `(hotel_id, locale)`
- Le revalidate ISR (`revalidateTag('hotel:<slug>')`) doit être déclenché **par locale active** pour invalider les caches `/de/hotel/<slug>` indépendamment de `/fr/hotel/<slug>`

Pas de modification de la décision ADR-0010 elle-même (le pattern dual-table reste valide). Seulement extension de la liste des tables synchronisées.

### Impact sur ADR-0011 (voix Concierge)

Aucun. Le champ `concierge_advice` est déjà un JSONB keyé par locale (`{ fr: { body, tip_for }, en: { … } }`). L'extension à DE/ES/IT se fait par ajout de clés dans le JSONB existant — pas de DDL. Le pass 8 du pipeline éditorial (skill `concierge-voice-pipeline`) doit être étendu pour produire les translations DE/ES/IT, dans le respect de la voix Concierge culturellement adaptée.

## Plan d'exécution

Le plan détaillé est suivi dans [`docs/runbooks/i18n-v2-rollout.md`](../runbooks/i18n-v2-rollout.md). Sommairement, 6 phases séquentielles :

1. **Phase 0 — Cet ADR** : validation par le porteur produit, basculement en `accepted`.
2. **Phase 1 — Refactor type-safe** (1-2 jours, sans contenu) : voir [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md) §V2 multilingual rollout.
3. **Phase 2 — Création des tables** : migration `0034_create_translations_tables.sql` (5 tables + indices + RLS).
4. **Phase 3 — Backfill** : migration `0035_backfill_translations_from_legacy_columns.sql` (script SQL idempotent qui pivote les 37 colonnes en lignes).
5. **Phase 4 — Refactor des readers serveur** : `pickName(row, locale)` → `pickTranslation(translations, locale)`. Lectures duales pendant la fenêtre d'observation (2 semaines en production stable) : si `translations` retourne null, fallback sur les colonnes legacy.
6. **Phase 5 — DROP des colonnes legacy** : migration `0036_drop_legacy_localized_columns.sql`. Forward-only. À déclencher seulement quand le monitoring confirme 0 fallback observé pendant 2 semaines.
7. **Phase 6 — Extension Payload** : ADR-0010 sync étendu, repeater field `translations` dans la collection Hotels.
8. **Phase 7 — Activation V2** : ajout `'de'` à `routing.locales`, `messages/de.json` complet, contenu DE par rédacteur natif (cf. checklist [`seo-technical`](../../.cursor/skills/seo-technical/SKILL.md) §"Add a new locale").

## Plan de rollback

**Avant la migration `0036` (DROP des colonnes legacy)** :

- Rollback = `drop table public.<entity>_translations cascade`. Aucune donnée perdue (les colonnes legacy sont encore là). Re-applicable plus tard.

**Après la migration `0036`** :

- Rollback = restauration d'un dump Postgres pré-migration. Conséquence : downtime de quelques minutes, perte des éditions effectuées depuis le dump.
- **C'est pourquoi la migration 0036 ne doit être appliquée qu'après 2 semaines d'observation production stable**, avec un dump Supabase manuel pris juste avant (procédure documentée dans le runbook à créer `docs/runbooks/migration-0036-drop-legacy-columns.md`).

## Validation

- **Smoke** : appliquer les migrations 0034 + 0035 en preview, faire UPSERT depuis Payload, lire depuis `apps/web` un hôtel pilote (Le Bristol) en FR + EN. Comparer le rendu avec la version actuelle (colonnes plates) — diff doit être vide.
- **Performance** : EXPLAIN ANALYZE sur `getHotelBySlug` avant/après. Accepter +5 ms p99 maximum. Si > 5 ms, ajouter un index ou caching Redis (skill `redis-caching`).
- **Parité SQL** :
  ```sql
  select count(*) from public.hotels h
  left join public.hotel_translations t on t.hotel_id = h.id and t.locale = 'fr'
  where h.is_published and t.hotel_id is null;
  -- Doit retourner 0 après backfill.
  ```
- **RLS** : audit Supabase advisor complet, vérifier qu'aucun warning `multiple_permissive_policies` ou `auth_rls_initplan` n'apparaît (cf. `supabase-rls.mdc`).
- **Tests E2E** : Playwright doit passer sur `/fr/hotel/<top-palace>` et `/en/hotel/<top-palace>` avec les readers refactorés en Phase 4.
- **Sentry** : monitorer pendant 2 semaines le compteur `hotel_translations_fallback_used` (à instrumenter en Phase 4) — doit tendre vers 0 avant DROP.
