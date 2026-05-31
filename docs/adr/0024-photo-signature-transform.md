# ADR 0024 — Photo signature transform (decision: Baseline)

- Status: accepted
- Date: 2026-05-31
- Refs:
  - Constante : [`packages/ui/src/cloudinary-presets.ts`](../../packages/ui/src/cloudinary-presets.ts)
  - Composant : [`packages/ui/src/components/hotel-image.tsx`](../../packages/ui/src/components/hotel-image.tsx)
  - Skill : [`photo-quality-seo-geo-agentique`](../../.cursor/skills/photo-quality-seo-geo-agentique/SKILL.md)
  - Skill : [`photo-pipeline`](../../.cursor/skills/photo-pipeline/SKILL.md)
  - Règle : [`photo-quality.mdc`](../../.cursor/rules/photo-quality.mdc)
  - Page de preview (dev) : [`apps/web/src/app/[locale]/dev/photo-filter-preview/page.tsx`](../../apps/web/src/app/%5Blocale%5D/dev/photo-filter-preview/page.tsx)
  - Référence externe : Condé Nast Traveler / Travel + Leisure (rendu cible étudié)

## Décision

La constante `SIGNATURE_TRANSFORM` exposée par `@mch/ui` est
**`'f_auto,q_auto,c_fill,g_auto'`** — sans `e_improve`, sans
`e_sharpen`, sans `e_saturation`, sans `e_contrast`, sans
`e_auto_color`.

C'est la même valeur que la constante `DEFAULT_TRANSFORMS` locale qui
existait depuis la création de `<HotelImage>`. La décision **ne change
pas le rendu actuel** mais **élève la valeur au rang de contrat
explicite** et bloque les dérives futures (un PR qui tenterait
d'ajouter un filtre sera refusé sans nouvel ADR).

La « signature visuelle MyConciergeHotel » repose sur :

1. **Le sourcing** — uniquement les sources officielles autorisées par
   [`photo-quality.mdc`](../../.cursor/rules/photo-quality.mdc) (site
   officiel hôtel, Google Places API via le Google Business Profile
   officiel, press kits institutionnels, Wikimedia Commons sous
   licence compatible). Jamais Pinterest, TripAdvisor, Booking,
   Instagram client, hotlinks.
2. **L'alt + caption + Structured Metadata** — alt FR/EN enrichis
   (Hard Rule 16), caption JSON-LD `ImageObject` avec
   `representativeOfPage: true` sur le hero, 5 premiers `ImageObject`
   complets (caption + width + height).
3. **L'unité de cadrage** — toutes les images passent par les mêmes
   presets de dimensions (`HERO_TRANSFORM` = 2400 × 1350, 16:9 ;
   `GALLERY_TRANSFORM` = 1230 × 820, 3:2 ; `THUMBNAIL_TRANSFORM` =
   192 × 192).

Le post-traitement n'apporte rien sur des photos déjà curées par
l'hôtelier ; il créerait au contraire des risques (sur-traitement
peau, divergence avec ce que les LLMs indexent ailleurs).

## Contexte

CDC §2.2 demande une galerie ≥ 30 photos catégorisées avec une
identité visuelle cohérente sur les ~2 200 fiches publiées. L'option
naïve consistait à appliquer un filtre Cloudinary signature à
l'upload (e.g. `e_improve:80,e_sharpen:300,e_saturation:20` — type
« Condé Nast Traveler ») pour homogénéiser le rendu.

Le 2026-05-29 le PO a testé un premier preset trop subtil — feedback :
« je ne vois aucune différence ». Le 2026-05-31, la page
[`/dev/photo-filter-preview`](../../apps/web/src/app/%5Blocale%5D/dev/photo-filter-preview/page.tsx)
a été reconstruite avec **6 photos officielles** (3 hôtels phares :
Akelarre, Al Moudira, Alila Jabal Akhdar — diverses catégories :
exterior, view, room, pool, spa, dining) et **4 variantes côte à
côte** : Baseline, A — Subtle, B — Editorial, C — Bold. Les
transformations étaient bien servies différemment par Cloudinary (URLs
distinctes vérifiées) mais le rendu visuel à taille écran est
indistinguable.

Diagnostic : les photos sourcées via Google Places API sont déjà bien
équilibrées (les hôteliers eux-mêmes les ont curées avant upload sur
leur Google Business Profile). `e_improve` n'a rien à « rattraper »,
`e_sharpen` produit du ringing imperceptible, `e_saturation:+20%`
décale les rouges/verts dans une plage que l'œil ne distingue plus à
taille écran ≤ 800 px.

## Conséquences

### Visuelles

- ✅ Fidélité au rendu officiel curé par l'hôtelier (légal + éthique :
  pas de manipulation visuelle de l'offre).
- ✅ Aucun risque de sur-traitement sur les peaux (portraits staff,
  hôtes), les intérieurs sombres (spa, restaurant), les tons délicats
  (couchers de soleil, dégradés ciel).

### SEO / Core Web Vitals

- ✅ URL Cloudinary la plus courte possible → meilleur taux de cache
  hit CDN, meilleur LCP au cold start.
- ✅ `q_auto` (pas `q_auto:best`) cible un poids ~ 85 ko sur la hero
  vs ~ 130 ko pour `q_auto:best` — gain ≈ 350 ms LCP sur 3G mid-tier
  selon les mesures Lighthouse de référence.
- ✅ Pas de coût supplémentaire de transformation Cloudinary au cold
  start (`e_improve` / `e_sharpen` ajoutent ≈ 200-400 ms de latence
  sur le premier hit avant cache CDN).

### GEO / LLM citation

- ✅ Les LLMs (Perplexity, ChatGPT image search, Claude vision,
  Google AI Overviews) crawlent et comparent nos `ImageObject` aux
  images qu'ils trouvent ailleurs (Google Image, Bing, le site
  officiel de l'hôtel). Un filtre signature marqué créerait une
  divergence visuelle → perte de confiance « image fidèle » → moins
  de citations.
- ✅ La signature éditoriale GEO repose sur la **caption JSON-LD**
  (`representativeOfPage`, descriptive enrichie) et l'**alt bilingue**,
  pas sur le post-processing.

### Agentique

- ✅ L'endpoint MCP `getHotelPhotos` (cf. `agent-skills.json`) retourne
  des URLs réutilisables cross-platform sans risque de « visual
  greenwashing ». Un OTA, un agent IA, un journaliste peut consommer
  les URLs sans s'interroger sur l'authenticité.
- ✅ Cohérent avec la posture éditoriale du site (concierge expert
  honnête, pas marketing post-traité).

### Implémentation

- ✅ Aucune migration nécessaire — la décision conserve le rendu
  existant. Les ~ 6 500 photos déjà uploadées dans Cloudinary restent
  inchangées (le filtre n'est PAS appliqué au moment de l'upload mais
  en delivery via URL params, donc réversible).
- ✅ Si une décision future veut tester un filtre, il suffit de
  modifier `SIGNATURE_TRANSFORM` dans `cloudinary-presets.ts` —
  toutes les URLs se rebuildent automatiquement sans re-upload.
- ✅ Le PR `<HotelImage>` refuse désormais toute dérive en référençant
  la constante depuis `cloudinary-presets.ts`.

## Anti-patterns explicitement refusés

| Anti-pattern                                                                            | Raison du refus                                                                                                                                                |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajouter `e_improve:80,e_sharpen:300` au `SIGNATURE_TRANSFORM` sans nouvel ADR           | Empiriquement invisible sur photos curées, ajoute du coût transform / latence, crée divergence GEO                                                             |
| Passer à `q_auto:best`                                                                  | Augmente le LCP de ~350 ms pour gain visuel imperceptible sur hotel media                                                                                      |
| Appliquer un LUT 3D Lightroom à l'upload                                                | Sort de Cloudinary natif → pipeline Python/ImageMagick obligatoire → +2 jours de R&D, dépendance machine locale, irréversible (LUT appliqué au fichier source) |
| Utiliser Cloudinary Neural Enhance (`e_upscale`, `e_gen_remove`) sur toute la catalogue | Coût $$$ + résultats AI imprédictibles + risque légal (manipulation au sens DSA art. 25 / DGCCRF)                                                              |
| Forker `SIGNATURE_TRANSFORM` par contexte (search vs detail vs guide)                   | Multiplie la surface de cache CDN → dégrade le hit rate. Préférer un seul transform de base + variantes de dimensions (`HERO_*`, `GALLERY_*`, `THUMBNAIL_*`).  |

## Si la décision doit être révisée plus tard

Le contexte qui pourrait justifier un nouvel ADR :

1. **Sourcing dégrade** — si Phase 4 du photo pipeline doit recourir à
   du scraping de sites tiers (moins curé que Google Business Profile)
   et que la galerie devient hétérogène, un filtre signature léger
   peut rééquilibrer.
2. **Demande PO créative** — si le rebranding adopte une identité
   visuelle marquée (e.g. tirage Polaroid, virage cyan/orange façon
   Sofia Coppola), un filtre devient un asset de marque, pas un
   correctif technique.
3. **Lighthouse LCP régresse au-delà de 2.5s mobile** — investiguer
   `q_auto` → `q_auto:eco` (cible plus agressive) avant de toucher
   les `e_*`.

Dans tous ces cas : recréer la page `/dev/photo-filter-preview` avec
les variantes candidates, refaire l'arbitrage PO sur photos
officielles, écrire un ADR successeur qui référence celui-ci.
