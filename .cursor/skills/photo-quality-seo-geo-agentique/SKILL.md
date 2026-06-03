---
name: photo-quality-seo-geo-agentique
description: |
  Garantir la qualité maximale des photos sur les fiches hôtels de MyConciergeHotel.com,
  dans une triple optique SEO (Core Web Vitals / LCP / ImageObject), GEO (captions
  citables par les LLMs, alt bilingue enrichi, Schema.org ImageObject avec
  `representativeOfPage`) et AGENTIQUE (surface MCP `getHotelPhotos`, `agent-skills.json`,
  llms.txt photo-endpoints).
  Lire avant de toucher HotelGallery, HotelHero, buildCloudinarySrc, gallery_images,
  le script scripts/photos/sync-hotel-photos.ts, ou tout composant photo.
---

# Photo Quality — SEO / GEO / Agentique

Ce skill complète `photo-pipeline/SKILL.md` (sourcing, legal hygiene, Cloudinary migration).
Il couvre les **standards de qualité** que chaque photo doit atteindre, les **recettes de
transformation Cloudinary**, les **obligations JSON-LD / alt-text** pour le SEO et le GEO,
et la **surface agentique** exposée aux LLMs.

---

## 1. Quotas et catégories obligatoires

### Minimum absolu pour publish

| Seuil                                    | Règle                                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| ≥ 30 photos par fiche                    | Hard Rule 9 (`hotel-detail-page.mdc`) — bloque le publish Payload |
| ≥ 10 catégories couvertes                | Une photo par catégorie minimum                                   |
| ≥ 1 hero Cloudinary                      | `hero_image` = public_id `cct/hotels/<slug>/hero`                 |
| ≥ 5 photos gallery + hero → noindex levé | Guard EEAT dans `generateMetadata` (`isIndexable`)                |

### 10 catégories canoniques (CDC §2 bloc 2)

```
exterior   — façade, entrée, vue aérienne, jardin
lobby      — réception, hall, couloirs communs
room       — chambre standard, suite, salle de bain
dining     — restaurant gastronomique, bar, petit-déjeuner
spa        — espace bien-être, salle de soins, hammam, fitness
pool       — piscine intérieure, extérieure, rooftop
view       — vue depuis chambre, terrasse, panorama
detail     — décoration, oeuvres d'art, finitions, lits habillés
concierge  — conciergerie, équipe, service
events     — salle de séminaire, mariage, réception MICE
```

Une catégorie vide → **publish bloqué** (Payload `beforeChange` hook).

### Répartition cible (≥ 50 photos)

| Catégorie | Min recommandé | Remarque                                   |
| --------- | -------------- | ------------------------------------------ |
| room      | 8              | Au moins 1 par type de chambre publié      |
| exterior  | 4              | Façade nuit + jour                         |
| dining    | 5              | Si restaurant, au moins 1 assiette dressée |
| spa       | 4              | Si spa présent                             |
| pool      | 3              | Si piscine présente                        |
| lobby     | 3              |                                            |
| view      | 4              |                                            |
| detail    | 5              | Détails différenciants = signal EEAT fort  |
| concierge | 2              | Signal humain = GEO fort                   |
| events    | 2              | Si MICE présent                            |

---

## 2. Standards de qualité technique

### Résolution minimale

| Usage              | Dimensions min | Ratio       |
| ------------------ | -------------- | ----------- |
| Hero (LCP cible)   | 2400 × 1600 px | 3:2 ou 16:9 |
| OG / Twitter Card  | 1200 × 630 px  | 1.91:1      |
| Gallery card       | 1230 × 820 px  | 3:2         |
| Thumbnail lightbox | 400 × 266 px   | 3:2         |
| Room subpage hero  | 1600 × 1067 px | 3:2         |

Les originaux uploadés sur Cloudinary doivent mesurer **≥ 2400 px** sur le petit côté.

### Formats et Core Web Vitals

- **AVIF first, WebP fallback, JPEG ultimate fallback** : toujours utiliser `f_auto`.
- **Ne jamais** utiliser `next/image` pour les assets Cloudinary hôtels — bypass CDN.
- `loading="lazy"` sur toutes les photos de galerie sauf la 1ère.
- Hero = `loading="eager"` + `fetchpriority="high"`.
- **LCP budget** : hero < 2.5 s sur 4G mobile. LCP > 4 s bloque le merge.
- `decoding="async"` sur toutes les `<img>` non-hero.

### Signature transform LOCKED — ADR-0024 (2026-05-31)

La constante canonique de transformation Cloudinary est :

```ts
export const SIGNATURE_TRANSFORM = 'f_auto,q_auto,c_fill,g_auto';
```

Exposée par `@mch/ui` depuis [`packages/ui/src/cloudinary-presets.ts`](../../packages/ui/src/cloudinary-presets.ts).
**Ne JAMAIS ajouter** `e_improve`, `e_sharpen`, `e_saturation`,
`e_contrast`, `e_auto_color`, `e_upscale`, `e_gen_remove`, ou tout
autre filtre `e_*` sans un nouvel ADR qui révoque
[ADR-0024](../../docs/adr/0024-photo-signature-transform.md).

Rationale empirique (page de preview
[`/dev/photo-filter-preview`](../../apps/web/src/app/%5Blocale%5D/dev/photo-filter-preview/page.tsx),
2026-05-31, 4 variantes × 6 photos officielles) :

- Les photos sourcées Google Places API sont déjà curées par
  l'hôtelier → `e_improve` n'a rien à corriger, effet visuel
  imperceptible à taille écran.
- Un filtre signature marqué crée une **divergence GEO** avec ce
  que les LLMs indexent ailleurs (Google Image, Bing) → perte de
  confiance « image fidèle » sur les citations.
- `q_auto:best` ajoute ~ 350 ms de LCP pour gain visuel
  imperceptible sur hotel media. **Toujours `q_auto`, jamais
  `q_auto:best`** sur les pages indexables.

La signature visuelle MyConciergeHotel repose sur **le sourcing**
(officiel only, cf. `.cursor/rules/photo-quality.mdc`) + **l'alt /
caption / ImageObject** + **l'unité de cadrage** (presets ci-dessous),
**pas** sur le post-processing.

### Recettes Cloudinary canoniques (presets de dimensions)

Toutes basées sur la même `SIGNATURE_TRANSFORM` + variantes de
cadrage. Centralisées dans [`packages/ui/src/cloudinary-presets.ts`](../../packages/ui/src/cloudinary-presets.ts),
exposées via `CLOUDINARY_PRESETS`.

```ts
// Hero page hôtel (LCP, 16:9)
HERO_TRANSFORM = 'w_2400,h_1350,f_auto,q_auto,c_fill,g_auto';

// Gallery card (3:2, responsive)
GALLERY_TRANSFORM = 'w_1230,h_820,f_auto,q_auto,c_fill,g_auto';

// Thumbnail (search results, sidebar suggestions)
THUMBNAIL_TRANSFORM = 'w_192,h_192,f_auto,q_auto,c_fill,g_auto';

// LQIP placeholder (blur-up hero)
SIGNATURE_LQIP = 'w_20,q_1,e_blur:1000,f_auto';

// Cas particulier : OG / Twitter Card forcée JPG (Twitter ne supporte pas AVIF)
// Construit côté seo/og-image.ts (PAS dans cloudinary-presets car non-rendu UI)
('f_jpg,q_auto,c_fill,g_auto,w_1200,h_630');
```

**Ne jamais hardcoder les transforms dans les composants.** Importer
depuis `@mch/ui` (`SIGNATURE_TRANSFORM`, `HERO_TRANSFORM`,
`GALLERY_TRANSFORM`, `THUMBNAIL_TRANSFORM`, `SIGNATURE_LQIP`,
`CLOUDINARY_PRESETS`).

---

## 3. Alt text — SEO + GEO

### Format obligatoire (Hard Rule 16)

```
[Qualificatif descriptif] [Hôtel X] [Ville] — [détail différenciant]
```

- ✅ FR : `"Piscine extérieure chauffée avec vue sur la mer — Hôtel Martinez Cannes"`
- ✅ EN : `"Heated outdoor pool with sea view — Hôtel Martinez Cannes"`
- ❌ Interdit : `"piscine"`, `"photo hotel"`, `"image.jpg"`, chaîne vide

### Prompt LLM seeding (`scripts/photos/generate-alt-text.ts`)

```
Système : Tu génères des alt-texts SEO pour des photos d'hôtels de luxe.
Contraintes :
- Commence TOUJOURS par un adjectif descriptif visuel
- Inclus le nom de l'hôtel et la ville
- 10-18 mots maximum
- Décris ce qui est visuellement distinctif (vue, matériaux, ambiance)
- Ne mentionne jamais de prix ni de disponibilité
- Langue cible : {locale}

Hôtel : {hotel_name}, {city}
Catégorie de la photo : {category}
[Image attachée ou URL Cloudinary]
```

**Validation** : `AltTextSchema` Zod dans `packages/seo/src/alt-text.ts`
(10–100 chars, pas de substring "photo", "image", "img", chaîne vide).

### Catalogue-wide Vision categorize — batch d'enrichissement (2026-05-31)

Le pipeline `scripts/editorial-pilot/src/photos/categorize-with-vision.ts`
est la voie canonique pour enrichir alt + category + caption + scores en
batch sur tout le catalogue. Run éprouvé 2026-05-31 (catalogue 2 219 publishés) :

| Métrique              | Avant run | Après run   | Delta |
| --------------------- | --------- | ----------- | ----- |
| Total photos publiées | 22 206    | 22 110      | -96   |
| `alt_fr` non-null     | 99.3 %    | 99.99 %     | +0.7  |
| `alt_en` non-null     | 85.7 %    | **99.88 %** | +14.2 |
| `category` non-null   | 85.7 %    | **99.88 %** | +14.2 |
| `caption_fr` non-null | 85.6 %    | **99.88 %** | +14.3 |
| `representativeness`  | 0 %       | **98.19 %** | +98.2 |
| `hero_suitable`       | 0 %       | **98.19 %** | +98.2 |

Cost : **$1.94** for 2 774 photos classified (en parallèle avec un autre
agent `--backfill-scores`), 195 dropped (URLs Cloudinary invalides ou
LLM error). 43.7 min wall-clock @ concurrency=4. Tokens : 91M in / 403K
out (gpt-4o-mini est ~$0.0007 / image classifiée).

**Mode par défaut** (sans flag) : ne touche que les photos sans
`category`. Les photos déjà catégorisées passent par le filtre
`hotelNeedsCategorisation` qui les SKIP. C'est sûr par défaut — ne
relance pas l'enrichissement sur les photos déjà traitées.

**Concurrent-safe** : le pipeline filtre les photos missing-category
au niveau Vision call, donc lancer en parallèle d'un autre run (par
exemple `--backfill-scores`) ne crée pas de conflit — les targets sont
disjoints.

**Limites observées** :

1. **Floor 10 catégories distinctes (CDC §2.2) toujours à 0/2219**
   après le run. Cause : les hotels ont en moyenne ~10 photos couvrant
   4.7 catégories distinctes. Le Vision ne crée pas de catégories — il
   les attribue à des photos existantes. Pour atteindre le floor, il
   faut **sourcer plus de photos** (Phase 2 sourcing + sync), pas
   relancer Vision.
2. **`width` / `height` toujours à 1.7 %** après le run (376 photos
   sur 22 110). Vision ne backfill PAS les dimensions Cloudinary —
   il faut un pipeline séparé qui appelle l'admin API
   `GET /resources/image/upload/<public_id>` et patch les meta. C'est
   un blocker pour la Hard Rule 16 (JSON-LD `ImageObject` complet) — à
   chantier ouvrir si la Phase 2 sourcing n'inclut pas déjà le
   width/height à l'upload.

### GEO — captions LLM-citables

Les LLMs citent les photos par leur `caption` dans le JSON-LD `ImageObject`.
Caption = phrase complète, auto-explicative, ≤ 120 chars :

```ts
// ✅ Bon :
caption: 'La piscine intérieure voûtée du Ritz Paris, entourée de colonnes en marbre blanc';

// ❌ Mauvais :
caption: 'pool-3'; // identifiant technique
caption: 'Piscine'; // trop court, non citable
```

Règle : `caption` = alt_fr légèrement étoffé (hôtel + contexte si l'alt est court).

---

## 4. JSON-LD ImageObject — obligations SEO/GEO

### Structure minimale

```ts
{
  "@type": "ImageObject",
  "url": "https://res.cloudinary.com/{cloud}/{public_id}",
  "width": 1600,
  "height": 900,
  "caption": "...",            // phrase complète ≤ 120 chars — OBLIGATOIRE
  "name": "...",               // = alt_fr tronqué à 80 chars — OBLIGATOIRE
  "representativeOfPage": true // UNIQUEMENT sur le hero (1 seul par page)
}
```

### Quantité émise dans le JSON-LD Hotel

- **Hero** : 1 ImageObject avec `representativeOfPage: true`
- **Gallery** : les **5 premiers** avec caption + width/height
- **Total minimum** : 6 ImageObject rich

Builder : `JsonLd.hotelJsonLd` dans `packages/seo/src/jsonld/hotel.ts` — ne pas contourner.

### Room subpage

- ≥ 5 `ImageObject`, 1 avec `representativeOfPage: true`, `isPartOf` → Hotel parent

### Provenance & Licensable (`credit` / `licence` → JSON-LD)

Les colonnes `gallery_images.credit` (attribution) et `gallery_images.licence`
(enum SMD : `cc-by-sa-4.0` · `cc-by-4.0` · `cc0` · `all-rights-reserved` ·
`fair-use`) alimentent le `ImageObject` via `hotel.ts` :

- **Provenance** (dès qu'un `credit` existe) : `creditText`, `creator`
  (`Organization`), `copyrightNotice` (`© <credit>`). Signal EEAT, n'allume
  **pas** le badge Licensable.
- **Licensable** (`license` + `acquireLicensePage`) : **uniquement** pour une
  licence **Creative Commons** — `licence` ∈ {`cc-by-4.0`, `cc-by-sa-4.0`,
  `cc0`} → URL CC canonique. Ce sont typiquement les fichiers **Wikimedia**.
- **Press kit / `all-rights-reserved` / `fair-use`** (ex. Airelles, source
  `press`) : provenance seulement, **jamais** de `license`/`acquireLicensePage`
  — on n'est pas le licencieur, un lien de licence serait un markup trompeur
  (violation Google + risque juridique).
- `license`/`acquireLicensePage` doivent être **HTTPS** (le builder drop sinon).

Conséquence catalogue : le badge « Licensable » de Google Images se déclenche
sur les ~hôtels sourcés **Wikimedia (CC)**, pas sur les press kits.

---

## 5. Indexabilité EEAT — guard `generateMetadata`

```ts
const isIndexable = heroPublicId !== null && (galleryCount >= 5 || hasSections);
```

**Ne pas modifier ce guard sans ADR.** Dès que le pipeline photo hydrate une fiche,
la page passe en `index, follow` sur la prochaine requête (`force-dynamic`).

---

## 6. Surface agentique (MCP + agent-skills.json)

### Skill à ajouter dans DEFAULT_AGENT_SKILLS

```ts
{
  skill: 'getHotelPhotos',
  description: 'Returns the hero image and categorised gallery for a hotel, with Cloudinary URLs at standard sizes and bilingual alt text.',
  inputSchema: z.object({
    slug: z.string(),
    locale: z.enum(['fr', 'en']),
    category: z.enum(['exterior','lobby','room','dining','spa','pool','view','detail','concierge','events']).optional(),
    limit: z.number().int().min(1).max(50).default(30),
  }),
  outputSchema: z.object({
    hero: z.object({ url: z.string(), alt: z.string(), caption: z.string() }).nullable(),
    gallery: z.array(z.object({
      url: z.string(), alt: z.string(), caption: z.string(),
      category: z.string(), width: z.number(), height: z.number(),
    })),
    totalCount: z.number(),
  }),
}
```

Endpoint : `GET /api/mcp/hotel-photos?slug=<slug>&locale=fr`
(Zod-validated, public, rate-limited à 60 req/min, listé dans `agent-skills.json` et `llms.txt`).

### llms.txt — section à ajouter

```
## Hotel photos (MCP)
GET /api/mcp/hotel-photos?slug={slug}&locale={fr|en}
Returns hero + categorised gallery with alt text and captions.
```

### Rebuild après modification

```bash
pnpm build:agent-skills
# Commiter public/agent-skills.json dans la même PR
```

---

## 7. CI photo (pre-commit)

1. `pnpm photo:lint` — vérifie `alt_fr`, `alt_en`, `category`, `public_id`, pas de hotlink
2. `pnpm photo:quota` — ≥ 30 photos + ≥ 10 catégories par hôtel publié
3. `pnpm photo:lcp` — Lighthouse CI : LCP < 2.5 s mobile, CLS < 0.1

---

## 8. Anti-patterns bloquants

| Anti-pattern                                                                                                                | Conséquence                                                                                                    | Résolution                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `alt=""` ou `alt="photo"`                                                                                                   | Google ignore l'ImageObject, LLM ne cite pas                                                                   | Script LLM seeding                                                                              |
| `caption` absent dans ImageObject                                                                                           | Perte totale du signal GEO LLM                                                                                 | Obligatoire dans hotelJsonLd                                                                    |
| `next/image` sur hero/gallery                                                                                               | Bypass Cloudinary CDN, LCP +300–800 ms                                                                         | `buildCloudinarySrc` + `<img>`                                                                  |
| URL Pinterest dans gallery_images                                                                                           | Risque légal + instabilité CDN                                                                                 | Sourcer via Wikimedia/press kit                                                                 |
| `representativeOfPage: true` sur N > 1                                                                                      | Google ignore le signal hero                                                                                   | Un seul par page                                                                                |
| `bestRating: '10'` dans AggregateRating                                                                                     | Hard Rule seo-geo.mdc                                                                                          | Toujours `'5'`, `ratingValue × 2` en UI                                                         |
| Catégorie `events` absente si MICE présent                                                                                  | Bloc 14 orphelin                                                                                               | ≥ 2 photos events si `mice_info` non null                                                       |
| LCP hero > 2.5 s mobile                                                                                                     | Core Web Vitals rouge, déclassement GSC                                                                        | `fetchpriority="high"` + LQIP + `w_2400`                                                        |
| Ajouter `e_improve` / `e_sharpen` / `e_saturation` / `e_contrast` / `e_auto_color` au `SIGNATURE_TRANSFORM` sans nouvel ADR | Effet invisible sur photos officielles + divergence GEO + LCP +200-400 ms cold start                           | Garder Baseline ADR-0024 ; pour explorer un filtre, rebuild la page `/dev/photo-filter-preview` |
| Hardcoder un transform Cloudinary dans un composant (`<img src="…/upload/w_1230,h_820,…/…"/>`)                              | Drift entre composants, cache CDN fragmenté                                                                    | Importer `HERO_TRANSFORM` / `GALLERY_TRANSFORM` / `THUMBNAIL_TRANSFORM` depuis `@mch/ui`        |
| `q_auto:best` sur une page indexable                                                                                        | LCP +350 ms pour gain visuel imperceptible                                                                     | `q_auto` (la valeur par défaut de `SIGNATURE_TRANSFORM`)                                        |
| Curation qui **exclut** le hero de `gallery_images` (le stocke seul dans `hero_image`)                                      | Perte des métadonnées hero (alt/caption/scores), curation **non idempotente** (le hero churne à chaque re-run) | Garder le hero en `gallery_images[0]` ; la page exclut l'index 0 du mosaïque/lightbox (cf. §9)  |

---

## 9. Curation TOP 5 — hero + 4 tuiles (`curate-top-photos.ts`)

La sélection des 5 photos affichées en haut de fiche (hero + 4 tuiles
mosaïque) est produite par
[`scripts/editorial-pilot/src/photos/curate-top-photos.ts`](../../scripts/editorial-pilot/src/photos/curate-top-photos.ts)
(+ helpers purs `pickHero` / `selectTop4` / `orderGallery` dans
[`gallery-coverage.ts`](../../scripts/editorial-pilot/src/photos/gallery-coverage.ts)).
C'est une passe **DB-only** (aucun appel Cloudinary/OpenAI) qui lit les
scores Vision déjà écrits.

### Les deux scores Vision qui pilotent la sélection

Le prompt `categorize-with-vision.ts` produit, en plus de `quality_score`
(technique : netteté, compo, lumière), deux signaux **éditoriaux** :

- `representativeness` (1-10) — « cette photo donne-t-elle tout de suite
  la _tendance_ / le caractère de l'hôtel ? ». Pondéré **×2** dans
  `combinedScore = representativeness*2 + quality_score` : le TOP 5 doit
  _communiquer l'âme_ de l'hôtel, pas juste être net.
- `hero_suitable` (bool) — cadrage large + sujet emblématique, éligible
  au slot hero.

`pickHero` : cascade `hero_suitable` ∈ catégorie signature
(`exterior/lobby/pool/view/dining/exterior`) → tout `hero_suitable` → top
`combinedScore`. `selectTop4` : 4 catégories distinctes (hors catégorie
du hero) par priorité, puis remplissage au score.

### Règle d'or — le hero reste DANS `gallery_images[0]`

`sync-hotel-photos.ts` historiquement **excluait** le hero de
`gallery_images` (`galleryWithoutHero`). **Ne pas reproduire ce pattern
dans la curation.** Stocker le hero uniquement comme `public_id` nu dans
`hotels.hero_image` a deux conséquences graves :

1. **Perte de métadonnées** — `alt_fr/en`, `caption_fr/en`, `category`,
   `representativeness`, `hero_suitable` vivent sur la _ligne galerie_.
   Exclure le hero les jette → la page perd l'alt/caption du hero pour le
   JSON-LD `ImageObject` + l'a11y (fallback au nom de l'hôtel).
2. **Non-idempotence** — au re-run, `combinePool` replie le hero nu (score
   0, pas `hero_suitable`) ; une autre photo gagne donc le slot et le hero
   **churne à l'infini** (writes DB + revalidation ISR + `lastmod` sitemap
   inutiles).

`orderGallery` renvoie donc `orderedGallery = [hero, ...top4, ...rest]`
(hero **inclus** à l'index 0). Conséquences côté rendu
([`hotel/[slug]/page.tsx`](../../apps/web/src/app/%5Blocale%5D/hotel/%5Bslug%5D/page.tsx)) :
le hero est rendu séparément (`heroDescriptor`), donc on **exclut
l'index 0** du mosaïque + lightbox (`galleryTiles = galleryImages.filter(
g => g.publicId !== heroPublicId)`) et des 4 tuiles JSON-LD (le hero est
émis une seule fois, avec `representativeOfPage: true`).

### Garde-fou intégrité (perte de photos silencieuse)

`orderGallery` indexe par `public_id` dans une `Map`. Une galerie avec
`public_id` manquant (lignes legacy pré-Cloudinary stockées sous `url`,
CDN interdits TripAdvisor/Instagram/momondo…) ou dupliqué ferait
**collapser** des entrées → PATCH d'une galerie **rétrécie** (perte de
photos). `curate-top-photos.ts` **skip** donc tout hôtel dont une entrée
n'a pas de `public_id` string non vide (ou en a un dupliqué). Ces ~320
fiches relèvent du chantier Phase-2 de re-sourcing, pas de la curation.

### Mode `--backfill-scores` (run « sur tout » reprenable)

Pour scorer `representativeness`/`hero_suitable` sur tout le catalogue
sans re-payer en cas d'interruption : `pnpm photos:categorize:backfill`
(flag `--backfill-scores`). Éligibilité = hôtels dont ≥ 1 photo manque
`representativeness` ; cibles = photos sans `representativeness` **ET**
avec un `public_id` Cloudinary utilisable (les lignes legacy sans
`public_id` sont ignorées — inutile d'envoyer une URL 404 à OpenAI).
Coût réel observé 2026-05-31 : ~9 000 photos scorées pour ≈ 6,3 $.

### Séquence de convergence (si le hero a déjà été exclu par un run antérieur)

Si une passe a déjà exclu les heros (métadonnées perdues) : (1) re-curate
(ré-injecte le hero nu dans la galerie), (2) `--backfill-scores`
(re-score les heros nus), (3) re-curate (le meilleur cliché redevient
hero, **idempotent** ensuite — vérifié : 2027/2197 `noop` au re-run).

---

## 10. Références croisées

- `photo-pipeline/SKILL.md` — sourcing légal, migration Cloudinary, SMD setup
- `hotel-detail-page.mdc` §Hard Rules 9 + 16
- `seo-geo.mdc` §JSON-LD §LLM-actionable surfaces
- [`packages/ui/src/cloudinary-presets.ts`](../../packages/ui/src/cloudinary-presets.ts) → `SIGNATURE_TRANSFORM`, `HERO_TRANSFORM`, `GALLERY_TRANSFORM`, `THUMBNAIL_TRANSFORM`, `SIGNATURE_LQIP`, `CLOUDINARY_PRESETS`
- [`packages/ui/src/components/hotel-image.tsx`](../../packages/ui/src/components/hotel-image.tsx) → `buildCloudinarySrc`, `buildCloudinaryFetchSrc`, `<HotelImage>`
- `packages/seo/src/jsonld/hotel.ts` → `hotelJsonLd`
- `packages/seo/src/agent-skills.ts` → `DEFAULT_AGENT_SKILLS`
- `scripts/photos/sync-hotel-photos.ts` — sync batch Cloudinary → Supabase
- [`docs/adr/0024-photo-signature-transform.md`](../../docs/adr/0024-photo-signature-transform.md) — décision Baseline + rationale visuel/SEO/GEO/agentique
- [`apps/web/src/app/[locale]/dev/photo-filter-preview/page.tsx`](../../apps/web/src/app/%5Blocale%5D/dev/photo-filter-preview/page.tsx) — page de preview filtre, à recréer pour tout nouvel ADR successeur
