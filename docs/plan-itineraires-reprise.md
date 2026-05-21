# Plan de reprise — Feature Itinéraires

> **Statut** : draft de reprise rédigé le 2026-05-21.
> **Spec source** : [`docs/cdc-itineraires.md`](./cdc-itineraires.md)
> **Skill** : [`.cursor/skills/itinerary-editorial-pipeline/SKILL.md`](../.cursor/skills/itinerary-editorial-pipeline/SKILL.md)
> **Rule** : [`.cursor/rules/itinerary-page.mdc`](../.cursor/rules/itinerary-page.mdc)

---

## 0. Contexte de la reprise

Trois commits ont déjà posé les fondations (`542ba64` CDC, `0da0148` rule, `ae43031` skill), plus une refonte navigation (`827393d` ADR-0014) qui a ajouté un placeholder **coming-soon** pour `/itineraire`. La table `itineraries` n'existe pas encore en base, le détail `/itineraire/[slug]` retourne `notFound()`, et aucun helper de query n'a été écrit.

On reprend donc sur le **Sprint 1 — DB & API**, après avoir tranché deux points qui bloquent toute écriture de code.

---

## 1. Décisions verrouillées avant code

### 1.1 URL du hub : on aligne sur la convention du repo

Le CDC §3.2 et la convention `apps/web/src/app/[locale]/` sont cohérents : **hub pluriel**, **détail singulier**, **deux dossiers Next.js séparés**.

| Section         | Hub                | Détail                   |
| --------------- | ------------------ | ------------------------ |
| Hôtels          | `/hotels`          | `/hotel/[slug]`          |
| Classements     | `/classements`     | `/classement/[slug]`     |
| Guides          | `/guides`          | `/guide/[citySlug]`      |
| Marques         | `/marques`         | `/marque/[brandSlug]`    |
| **Itinéraires** | **`/itineraires`** | **`/itineraire/[slug]`** |

Le placeholder coming-soon actuellement à `/itineraire` (singulier, hors convention) sera **déplacé en `/itineraires`** lors de la PR Sprint 1 ou Sprint 2. Une **redirection 308** `/itineraire` → `/itineraires` est ajoutée à `apps/web/src/middleware.ts` (ou via `redirects()` dans `next.config.ts`) pour ne casser aucun lien externe éventuel — la fenêtre d'exposition est ~1 jour, donc le risque est nul, mais la propreté SEO le justifie.

### 1.2 Numéro de migration : 0045 (pas 0038)

Le CDC parle de la migration `0038`, mais ce numéro a été pris par `0038_hotels_source_layering.sql`. La dernière appliquée est `0044_hotel_hero_video.sql`. La table `itineraries` devient donc **`0045_itineraries.sql`**.

### 1.3 Slugs identiques FR/EN (ADR-0008)

Le CDC §3.2 mentionne un slug EN distinct (`slug_en`), mais l'ADR-0008 a tranché : **tous les slugs éditoriaux sont identiques entre locales**, en français. On garde quand même la colonne `slug_en` dans le schéma pour préserver la flexibilité future, mais elle reste systématiquement nulle ou égale à `slug_fr` en V1. Le routing `/itineraire/[slug]` est donc identique pour `fr` et `en`.

---

## 2. Architecture cible — Pattern miroir de `rankings`

L'implémentation suit strictement les helpers `apps/web/src/server/rankings/` qui sont la référence canonique pour ce type de contenu éditorial structuré (Zod inline, `unstable_cache` retournant un POJO, fallback gracieux si Supabase manque).

```
packages/db/migrations/0045_itineraries.sql
  └── public.itineraries (table) + RLS policies + indexes + trigger updated_at

apps/web/src/server/itineraries/
  ├── get-itinerary-by-slug.ts        — Zod schemas + unstable_cache
  ├── list-itineraries.ts             — paginé, filtres (destination, theme, duration)
  ├── get-related-itineraries.ts      — pour le maillage interne
  └── itineraries.test.ts             — Vitest (3 tests minimum : happy path, locale fallback, AEO validation)

packages/seo/src/agent-skills.ts      — ajouter get-itinerary + list-itineraries

apps/web/src/app/[locale]/
  ├── itineraires/                    — NOUVEAU dossier
  │   └── page.tsx                    — hub (déplacé depuis /itineraire/page.tsx)
  └── itineraire/
      └── [slug]/
          └── page.tsx                — détail réel (15 blocs CDC §4.2)

apps/web/src/components/itineraire/   — NOUVEAU
  ├── itinerary-steps.tsx
  ├── itinerary-hotel-card.tsx
  ├── itinerary-aeo-block.tsx
  ├── related-itineraries.tsx
  └── related-rankings-for-itinerary.tsx

apps/web/src/app/sitemaps/itineraries.xml/route.ts  — NOUVEAU sub-sitemap
apps/web/src/app/llms.txt/route.ts                  — section "Itinéraires" à ajouter

scripts/editorial-pilot/itineraries/                — NOUVEAU dossier
  ├── seed-paris-luxe-3-jours.sql
  ├── prompts/01-brief.md
  ├── prompts/02-aeo.md
  ├── prompts/03-sections.md
  ├── prompts/04-faq.md
  └── pipeline.ts
```

---

## 3. Plan par PR — 4 PR séquentielles

### **PR 1 — Sprint 1 : DB & API** (env. 600-800 LOC, 1 séance)

**Branche** : `feat/itineraries-db-api`
**Issue** : « feat(itinerary): table + helpers + agent-skills (Sprint 1) »

#### 3.1.1 Migration `0045_itineraries.sql`

Reprendre **exactement** le DDL du CDC §2.1 avec ces ajustements :

- Ajouter `insert into public._cct_sql_migrations (version, name) values ('0045', 'itineraries') on conflict do nothing;` à la fin (rule `supabase-rls.mdc`).
- RLS : `select` ouvert à `anon` + `authenticated` quand `status = 'published'`, `all` réservé aux JWT `role IN ('admin', 'editor')`.
- Wrapper `auth.jwt()` dans `(select auth.jwt())` (rule `supabase-rls.mdc` § RLS performance).
- FK index sur `author_id` (rule § Indexes).
- `set search_path = public, pg_temp` sur tout `SECURITY DEFINER` (aucun introduit ici, mais à vérifier).

#### 3.1.2 Helpers `apps/web/src/server/itineraries/`

`get-itinerary-by-slug.ts` :

- Zod schemas inline pour `sections`, `faq_content`, `gallery_images` — accepter les données vides/partielles (pattern miroir de `get-ranking-by-slug.ts` lignes 7-50).
- `unstable_cache` avec tags `[itinerary-${slug}, itineraries-hub, itinerary-${country}]` et `revalidate: 3600`.
- **Retourner un `Record<string, …>` POJO**, jamais `Map`/`Set` (cf. rule `itinerary-page.mdc` §6 et hotfix `4d02187`).
- Fallback gracieux si `getSupabaseAdminClient()` retourne `null` (env non configuré) → retourner `null`.

`list-itineraries.ts` :

- Filtres optionnels : `destination_country`, `destination_city`, `themes` (array overlap), `travel_style`, `duration_min_days`/`duration_max_days`, `priority`.
- Pagination `cursor` ou `page/limit` — viser le pattern `cursor` pour rester compatible avec un éventuel infinite-scroll côté hub.
- Cache tag global : `itineraries-hub`, revalidate 86400.

`get-related-itineraries.ts` :

- Input : `itinerary_id` ou `slug`, `limit = 3`.
- Logique : items partageant ≥ 1 thème ET la même `destination_country`, ordonnés par priority puis last_updated DESC.
- Exclut l'itinéraire courant.

#### 3.1.3 Tests Vitest

`itineraries.test.ts` minimum :

1. **Happy path** : insert via Supabase admin → `getItineraryBySlug` rend le payload Zod-validé.
2. **AEO contract** : itinéraire avec `aeo_answer_fr` < 40 mots → flag warning (pas crash, mais loggé).
3. **Locale fallback** : si `slug_en` null → renvoyer le contenu FR avec `lang_fallback: 'fr'`.

(Tests bypassent les rate limits via `MCH_DISABLE_RATE_LIMITS=1`, cf. rule `e2e-testing.mdc`.)

#### 3.1.4 `agent-skills.ts`

Ajouter `get-itinerary` et `list-itineraries` dans `DEFAULT_AGENT_SKILLS.skills` (texte exact du CDC §6.1). Pas d'`endpoint` HTTP à ce stade — uniquement des deep-links vers les pages. Une PR ultérieure (post-Sprint 2) pourra ajouter `/api/agent/itinerary/[slug]` si on veut exposer du JSON.

#### 3.1.5 PR shape attendue

| Fichier                                               | LOC approx |
| ----------------------------------------------------- | ---------- |
| `packages/db/migrations/0045_itineraries.sql`         | ~150       |
| `apps/web/src/server/itineraries/*.ts` (3 fichiers)   | ~350       |
| `apps/web/src/server/itineraries/itineraries.test.ts` | ~120       |
| `packages/seo/src/agent-skills.ts` (delta)            | ~40        |
| **Total**                                             | **~660**   |

#### 3.1.6 Definition of done PR 1

- [ ] Migration appliquée sur Supabase live (`apply_migration` MCP).
- [ ] `pnpm --filter @mch/web typecheck` ✅
- [ ] `pnpm --filter @mch/web test apps/web/src/server/itineraries` ✅
- [ ] `agent-skills.json` rendu via une route éphémère et validé par Zod.
- [ ] Aucune RLS warning dans Supabase advisor.

---

### **PR 2 — Sprint 2 : Routes & UI** (env. 1200-1500 LOC, 2 séances)

**Branche** : `feat/itineraries-routes-ui`
**Issue** : « feat(itinerary): hub `/itineraires` + détail `/itineraire/[slug]` (15 blocs CDC §4.2) »

#### 3.2.1 Refonte URL hub

1. **Créer** `apps/web/src/app/[locale]/itineraires/page.tsx` — copie du contenu actuel de `/itineraire/page.tsx`, mais :
   - `revalidate = 86400` (hub).
   - `generateMetadata` : canonical = `/${locale}/itineraires`, hreflang complets.
   - Dès qu'il y a ≥ 1 itinéraire publié, basculer du mode coming-soon vers le mode listing avec `<ItineraryCard>`.
2. **Supprimer** `apps/web/src/app/[locale]/itineraire/page.tsx` (ne laisser que `[slug]/page.tsx`).
3. **Routing** `apps/web/src/i18n/routing.ts` :
   ```ts
   '/itineraires': '/itineraires',         // remplace '/itineraire'
   '/itineraire/[slug]': '/itineraire/[slug]',
   ```
4. **Header** `site-header.tsx` ligne 512 : `<MegaLink href="/itineraires" ... />`.
5. **Mobile nav** : même update.
6. **Sitemap hubs** `apps/web/src/app/sitemaps/hubs.xml/route.ts` ligne 67 : `{ href: '/itineraires', priority: 0.4 }`.
7. **Redirection 308** dans `next.config.ts` ou `middleware.ts` : `/itineraire` → `/itineraires` (les deux locales).
8. **i18n messages** : le namespace `itineraire` peut rester ou être renommé `itineraires` (préférence : renommer pour cohérence, mais attention au pattern de nesting i18n — règle `nextjs-app-router.mdc` § Internationalization).

#### 3.2.2 Détail `/itineraire/[slug]/page.tsx`

Remplacer le `notFound()` placeholder par une vraie page Server Component :

- `export const revalidate = 3600`.
- `generateMetadata` complet (canonical, hreflang, OG, robots).
- `generateStaticParams` : retourne `[]` si Supabase indispo (rule `nextjs-app-router.mdc`).
- 15 blocs dans l'ordre du CDC §4.2 — composer en RSC le plus possible, n'utiliser `'use client'` que pour `<ItineraryHotelCard>` qui peut afficher un prix live Amadeus.
- AEO block : valider avec `buildAeoBlock` AVANT le render, throw fail-fast si invalide (rule `itinerary-page.mdc` §4).
- 5 JSON-LD via `<JsonLdScript>` (jamais `<script>` inline) :
  1. `HowTo` via `buildHowTo` de `packages/seo/src/jsonld/howto.ts` (déjà existant, réutiliser tel quel).
  2. `ItemList` via `packages/seo/src/jsonld/item-list.ts`.
  3. `FAQPage` via `packages/seo/src/jsonld/faq.ts` (premier item rendu `<details open>`).
  4. `BreadcrumbList`.
  5. `Article` avec `dateModified = last_updated`, **jamais d'`AggregateRating` fabriquée** (rule `seo-geo.mdc`).

#### 3.2.3 Composants

`apps/web/src/components/itineraire/` :

| Composant              | RSC ou Client        | Rôle                                                                            |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `<ItineraryHero>`      | RSC                  | Image Cloudinary + titre + badges (durée/thème/saison) + `<LastUpdatedBadge />` |
| `<ItineraryAeoBlock>`  | RSC                  | `<section data-aeo>` 40-80 mots validé `buildAeoBlock`                          |
| `<ItinerarySteps>`     | RSC                  | Map sur `sections[]`, chaque step = `<StepCard>`                                |
| `<ItineraryHotelCard>` | Client (auth island) | Lien fiche + CTA réservation, prix live optionnel                               |
| `<RelatedRankings>`    | RSC                  | Cartes vers `/classement/[slug]` × ≥ 2                                          |
| `<RelatedGuides>`      | RSC                  | Carte vers `/guide/[citySlug]` × ≥ 1                                            |
| `<RelatedItineraries>` | RSC                  | Cartes vers `/itineraire/[slug]` × ≥ 2                                          |
| `<ItineraryFaq>`       | RSC                  | `<details>` × N, premier `open`                                                 |

Toutes les CTA respectent l'a11y (`role`, `aria-label` localisés) et la voix Concierge (cf. `EDITORIAL_VOICE.md`).

#### 3.2.4 Definition of done PR 2

- [ ] `/itineraires` répond 200 et passe Lighthouse SEO ≥ 95.
- [ ] `/itineraire/[slug]` répond 200 sur ≥ 1 slug seedé manuellement (test data).
- [ ] Google Rich Results Test : HowTo + FAQPage + Article valides.
- [ ] Tous les liens sortants minimums respectés (1 hôtel/step, 2 classements, 1 guide, 2 itinéraires).
- [ ] axe scan : 0 violation sérieuse.
- [ ] Pas de `'use client'` injustifié — seul `<ItineraryHotelCard>` est client si prix live.
- [ ] Redirection 308 `/itineraire` → `/itineraires` testée.

---

### **PR 3 — Sprint 3 : Maillage & GEO** (env. 400-600 LOC, 1 séance)

**Branche** : `feat/itineraries-mesh-geo`
**Issue** : « feat(itinerary): sitemap + llms.txt + rétroliens guides/hôtels »

#### 3.3.1 Sub-sitemap dédié

`apps/web/src/app/sitemaps/itineraries.xml/route.ts` — query Supabase `select slug_fr, last_updated, priority from public.itineraries where status = 'published'`, render XML, priority `0.9 / 0.8 / 0.7` selon `P0/P1/P2`, `changefreq = monthly`, `lastmod = last_updated`. Référencer dans `sitemap.xml` parent.

#### 3.3.2 `llms.txt` + `llms-full.txt`

Ajouter section "Itinéraires de voyage" (texte exact CDC §6.2). Pour `llms-full.txt`, ajouter une entrée `LlmsFullTxtPage` par itinéraire `priority = 'P0'` avec `keyFacts` du CDC §6.3.

#### 3.3.3 Rétroliens guides pays

Modifier le composant ou la query du `/guide/[citySlug]` pour, lorsque `country = 'FR'` (ou autre), récupérer `select slug_fr, title_fr, duration_min_days, duration_max_days from public.itineraries where destination_country = $country and status = 'published' order by priority limit 4`. Ajouter un bloc `<RelatedItinerariesForCountry>` en bas du guide.

#### 3.3.4 Rétroliens fiches hôtels

Modifier `apps/web/src/app/[locale]/hotel/[slug]/page.tsx` pour, lorsque `hotel.id` est dans `itineraries.hotel_ids @> array[$id]`, ajouter un widget `<HotelInItineraries>` (bloc CDC fiche hôtel non listé dans les 15 — extension agréable, accord ADR-0014 pour valider).

> **Garde-fou** : ne pas dupliquer ces sections si `itineraries` est vide en V1 — le composant doit retourner `null` quand 0 résultat (pas d'« orphelin de bloc »).

#### 3.3.5 Definition of done PR 3

- [ ] `sitemap.xml` parent référence le sub-sitemap.
- [ ] `llms.txt` + `llms-full.txt` validés par les fixtures `packages/seo/__tests__/`.
- [ ] Guide pays FR + 1 fiche hôtel testés visuellement avec ≥ 1 itinéraire seedé.

---

### **PR 4 — Sprint 4 : Contenu P0** (split en 4a smoke + 4b scale)

**Stratégie validée** : on ship 1 seul itinéraire (`paris-luxe-3-jours`) en smoke-test pour déverminer la chaîne de bout en bout (pipeline LLM, audit, rendu, JSON-LD, indexation), **puis on scale** sur les 20 P0 dans une PR distincte une fois le pipeline éprouvé.

#### PR 4a — Smoke test (1 itinéraire)

**Branche** : `feat/itineraries-content-smoke`
**Issue** : « feat(editorial): pipeline LLM + smoke-test `paris-luxe-3-jours` »

- Pipeline complet 6 passes (voir §3.4.1) mais lancé sur 1 seul slug.
- Audit `audit-itineraries.mjs` validé sur cette seule fiche.
- Relecture manuelle complète de la voix Concierge sur cette fiche (par toi).
- DoD : la fiche `/fr/itineraire/paris-luxe-3-jours` répond 200, passe Lighthouse SEO ≥ 95, Rich Results Test valide.

#### PR 4b — Scale 20 P0 (post-smoke)

**Branche** : `feat/itineraries-content-p0`
**Issue** : « feat(editorial): seed 19 itinéraires P0 restants (9 FR + 10 INTL) »

Lance la PR 4b uniquement après merge PR 4a et validation manuelle. Ajustements possibles au pipeline LLM en fonction des leçons du smoke (capitaliser dans la skill `itinerary-editorial-pipeline` au passage, rule `skills-capitalisation.mdc`).

---

Cette PR est la plus longue mais la moins risquée techniquement, parce qu'elle s'appuie sur :

- La skill `concierge-voice-pipeline` pour la voix.
- La skill `llm-output-robustness` pour la sécurité du multi-call.
- La skill `content-enrichment-pipeline` pour les sources factuelles (Tavily + Wikidata).
- La skill `itinerary-editorial-pipeline` qui définit le pipeline 6 passes.

#### 3.4.1 Pipeline `scripts/editorial-pilot/itineraries/pipeline.ts`

Reprendre la structure des autres pipelines (`scale-build-briefs.ts`, `scale-non-paris-palaces.ts`) :

- 6 passes séparées, chaque passe = 1 appel LLM single-concern (pattern `llm-output-robustness` rule 1).
- Schémas Zod par passe ; allowlist post-validation pour les hôtels (`is_published = true`).
- Concurrence `p-limit(3)` (rule `llm-output-robustness` rule 5).
- Idempotency : reprendre depuis `output/<slug>/<pass>.json` si existant.
- Modèle : GPT-4o (cohérent avec le reste de la chaîne éditoriale).

#### 3.4.2 Seed 10 P0 France

Reprendre la matrice CDC §7 — France (15 lignes, sélectionner les 10 premières) :

1. `paris-luxe-3-jours`
2. `cote-d-azur-luxe-7-jours`
3. `provence-culture-gastronomie-10-jours`
4. `alsace-couple-week-end`
5. `bordeaux-vignobles-gastronomie-5-jours`
6. `paris-famille-5-jours`
7. `megeve-ski-luxe-5-jours`
8. `saint-tropez-ete-5-jours`
9. `reims-champagne-week-end`
10. `paris-lune-de-miel`

#### 3.4.3 Seed 10 P0 International

CDC §7 — International, 10 premières :

1. `japon-culture-2-semaines`
2. `bali-lune-de-miel-10-jours`
3. `maldives-luxe-7-jours`
4. `toscane-gastronomie-7-jours`
5. `maroc-culture-10-jours`
6. `italie-culture-2-semaines`
7. `grece-iles-couple-10-jours`
8. `new-york-luxe-5-jours`
9. `dubai-luxe-week-end`
10. `safari-kenya-afrique-du-sud`

#### 3.4.4 Audit `audit-itineraries.mjs`

Adapter `audit-pushed-drafts.mjs` pour itinéraires :

- Word count `aeo_answer_fr/en` ∈ [40, 80].
- `sections[].body_fr` ≥ 150 mots.
- ≥ 1 `hotel_id` résolvable par itinéraire.
- `related_ranking_ids.length ≥ 2`, `related_guide_slugs.length ≥ 1`, `related_itinerary_slugs.length ≥ 2`.
- `faq_content.length ≥ 8`.
- `meta_desc_fr.length ∈ [140, 160]`.
- Slug regex.

#### 3.4.5 Definition of done PR 4

- [ ] 20 itinéraires en `status = 'published'` dans Supabase live.
- [ ] Audit script PASS sur 100% des fiches publiées.
- [ ] Contrôle manuel d'1 fiche FR + 1 fiche INTL : voix Concierge OK, faits vérifiables, hôtels nommés cohérents.
- [ ] `sitemap-itineraries.xml` indexé par GSC.
- [ ] Lighthouse SEO + Performance ≥ 90 sur 3 fiches échantillon.

---

## 4. Risques, dépendances, garde-fous

| Risque                                                   | Impact                                               | Mitigation                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pipeline LLM hallucine des hôtels hors catalogue**     | Liens 404 + perte de confiance                       | Allowlist Zod stricte sur `hotel_id` (rule `llm-output-robustness` rule 7) + audit allowlist post-LLM                                                                             |
| **Hôtels INTL sous-représentés en base**                 | Étapes sans hôtel recommandé pour 60% des seeds INTL | Vérifier en pré-seed combien d'hôtels `country_code = 'JP'`, `'IT'`, `'MA'` sont publiés ; sinon fallback `hotel_id = null` autorisé sur les étapes (mention "Sélection à venir") |
| **`unstable_cache` retourne un `Map` par erreur**        | 500 sur cache hit (déjà vu commit `4d02187`)         | Test dédié + assertion `JSON.stringify(result).startsWith('{')` au build du cache                                                                                                 |
| **CSP nonce manquant sur les 5 JSON-LD**                 | Erreurs CSP en prod                                  | Tous les `JsonLdScript` consomment `headers().get('x-nonce')` (rule `security-csp.mdc`)                                                                                           |
| **Cannibalisation guide ↔ itinéraire**                   | Pénalité SEO                                         | Audit Algolia : interdire le seed d'un itinéraire si `intro_fr` matche ≥ 70% du texte d'un guide (jaccard sur shingles)                                                           |
| **Indicateurs urgence fabriqués**                        | Sanction DGCCRF/DSA                                  | Voix Concierge + rule `seo-geo.mdc` interdisent déjà ; rappel dans le prompt LLM passe 1                                                                                          |
| **Manque d'hôtels en base pour `paris-famille-5-jours`** | Itinéraire publiable mais creux                      | Pré-flight check par seed ; si 0 match, déclasser P0 → P1 et passer le suivant                                                                                                    |

---

## 5. Capitalisation continue (rule `skills-capitalisation.mdc`)

À ajouter dans la skill `itinerary-editorial-pipeline` au fil des PR si un pattern non-trivial émerge :

- **Si** la query `getRelatedItineraries` rencontre un cold-start lent (>500ms) → capitaliser une stratégie de pré-warming.
- **Si** le pipeline LLM produit régulièrement des `aeo_answer_en < 40 mots` → capitaliser dans rule 4 du skill (déjà couvert mais à enrichir avec exemples concrets).
- **Si** Supabase RLS rejette un insert seed via le service role → capitaliser dans `supabase-rls.mdc`.

---

## 6. Calendrier prévisionnel

| PR                    | Effort dev              | Effort éditorial                                      | Bloque              |
| --------------------- | ----------------------- | ----------------------------------------------------- | ------------------- |
| PR 1 — DB & API       | 1 séance (~3h)          | —                                                     | Tout le reste       |
| PR 2 — Routes & UI    | 2 séances (~6h)         | —                                                     | PR 3 et démo client |
| PR 3 — Maillage & GEO | 1 séance (~3h)          | —                                                     | Indexation GSC      |
| PR 4 — Contenu P0     | 2 séances dev + ~6h LLM | Relecture native FR + EN par toi-même ou un rédacteur | Acquisition SEO     |

**Total** : ~14h dev + temps LLM + relecture éditoriale. Réaliste sur 1-2 semaines selon la disponibilité éditoriale.

---

## 7. Ce qu'on fait MAINTENANT après validation

Une fois ce plan validé :

1. **Créer la branche** `feat/itineraries-db-api`.
2. **Écrire la migration `0045_itineraries.sql`** depuis le DDL CDC §2.1 + ajustements §3.1.1.
3. **Appliquer la migration sur Supabase live** via l'outil MCP `apply_migration`.
4. **Écrire les 3 helpers** + les tests Vitest.
5. **Étendre `agent-skills.ts`** avec les 2 nouvelles skills.
6. **Ouvrir la PR 1** avec la check-list 3.1.6.

Toutes les autres PR enchaînent dans l'ordre (chaque branche partira de `main` une fois la précédente mergée).
