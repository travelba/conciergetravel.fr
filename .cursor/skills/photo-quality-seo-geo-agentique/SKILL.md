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

### Recettes Cloudinary canoniques

```ts
// Hero page hôtel (LCP, 16:9)
'f_auto,q_auto,w_2400,h_1350,c_fill,g_auto,dpr_auto';

// OG / Twitter Card
'f_jpg,q_auto,c_fill,g_auto,w_1200,h_630';

// Gallery card (3:2, responsive)
'f_auto,q_auto,w_1230,h_820,c_fill,g_auto';

// Thumbnail lightbox
'f_auto,q_auto,w_400,h_266,c_fill,g_auto';

// Room subpage hero
'f_auto,q_auto,w_1600,h_1067,c_fill,g_auto';

// JSON-LD ImageObject (hero)
'f_auto,q_auto,w_1600,h_900,c_fill,g_auto';

// Blur placeholder (LQIP)
'f_auto,q_1,w_20,h_14,c_fill,g_auto,e_blur:500';
```

Centralisées dans `packages/ui/src/cloudinary.ts` via `CLOUDINARY_PRESETS`.
Ne jamais hardcoder les transforms dans les composants.

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

| Anti-pattern                               | Conséquence                                  | Résolution                                |
| ------------------------------------------ | -------------------------------------------- | ----------------------------------------- |
| `alt=""` ou `alt="photo"`                  | Google ignore l'ImageObject, LLM ne cite pas | Script LLM seeding                        |
| `caption` absent dans ImageObject          | Perte totale du signal GEO LLM               | Obligatoire dans hotelJsonLd              |
| `next/image` sur hero/gallery              | Bypass Cloudinary CDN, LCP +300–800 ms       | `buildCloudinarySrc` + `<img>`            |
| URL Pinterest dans gallery_images          | Risque légal + instabilité CDN               | Sourcer via Wikimedia/press kit           |
| `representativeOfPage: true` sur N > 1     | Google ignore le signal hero                 | Un seul par page                          |
| `bestRating: '10'` dans AggregateRating    | Hard Rule seo-geo.mdc                        | Toujours `'5'`, `ratingValue × 2` en UI   |
| Catégorie `events` absente si MICE présent | Bloc 14 orphelin                             | ≥ 2 photos events si `mice_info` non null |
| LCP hero > 2.5 s mobile                    | Core Web Vitals rouge, déclassement GSC      | `fetchpriority="high"` + LQIP + `w_2400`  |

---

## 9. Références croisées

- `photo-pipeline/SKILL.md` — sourcing légal, migration Cloudinary, SMD setup
- `hotel-detail-page.mdc` §Hard Rules 9 + 16
- `seo-geo.mdc` §JSON-LD §LLM-actionable surfaces
- `packages/ui/src/cloudinary.ts` → `buildCloudinarySrc`, `CLOUDINARY_PRESETS`
- `packages/seo/src/jsonld/hotel.ts` → `hotelJsonLd`
- `packages/seo/src/agent-skills.ts` → `DEFAULT_AGENT_SKILLS`
- `scripts/photos/sync-hotel-photos.ts` — sync batch Cloudinary → Supabase
