# Competitive audit — travellers-society.com + yonder.fr vs MyConciergeHotel — 2026-06-23

**Scope** : READ-ONLY competitive teardown of the two French luxury-hotel
editorial sites that rank #1–2 on « meilleurs / plus beaux hôtels {ville} ».
Sources fraîches : their sitemaps (yonder 7 572 URLs) + Tavily map/search
(travellers-society, WP post-sitemap dead), DataForSEO (search volume FR +
SERP live FR), PostgREST inventory (2 219 hôtels publiés, 671 rankings publiés).
Same owner/editor behind both competitors. No DB/content modified.

> **Single biggest lever** : we already **out-structure** both competitors
> (10 JSON-LD blocks vs 6, we alone emit `ItemList`+`Hotel`+`FAQPage`+`Speakable`
> +hreflang) and we have **more ranking pages (671) on a deeper multi-axis
> matrix**. We lose on (1) **domain authority** (absent from every SERP checked),
> (2) **EN parity on ranking entries** (15 words EN vs 172 FR — a 91 % gap),
> (3) **concrete editorial richness per hotel** (named architect / the room to
> book / the Michelin table / celebrity anecdote vs our generic 172-word prose),
> and (4) **geographic breadth of small/secondary destinations** they cover and
> we don't (Vienne, Crète, Rajasthan, Seychelles, Lisbonne…).

## Executive summary

- **Coverage breadth** : yonder publishes **~430 ranking listicles** across two
  paths (`/hotels/hotels-du-mois/` ~68 city lists + `/les-tops/hotels/` ~360
  more) plus ~600 single-hotel reviews + 1 772 cityguides + 2 404 les-tops POI
  pages. travellers-society (WordPress/Yoast) uses **flat slugs**
  (`plus-beaux-hotels-{ville}`, `meilleurs-hotels-{N}-etoiles-{ville}`) — ~50+
  ranking pages sampled (full post-sitemap is dead/WP-error). **MCH has 671
  published rankings** — _more pages_, but concentrated as a programmatic
  multi-axis matrix (spa/romantic/piscine × big city) rather than broad geography.
- **SEO reality** : on « meilleurs / plus beaux hôtels {ville} » both competitors
  rank **#1 and #2** (Venise, Marrakech confirmed live) ; **MCH is absent from
  the top-20 on every query checked**. The gap is authority/indexation, not
  on-page structure.
- **Phrasing** : `hotel de luxe {ville}` universally outvolumes `meilleurs hotels
{ville}` — Paris **2 900 vs 110 (26×)**, Dubai 320 vs 30 (10×), New York 210 vs
  30 (7×), Marrakech 880 vs 140 (6×), Venise 170 vs 50 (3.4×). MCH has **1** `luxe`
  slug vs 521 `meilleurs-*`. `hotel de luxe {ville}` SERPs are OTA-dominated
  (Booking/Tripadvisor) — only yonder cracks them (#3 Paris).
- **Editorial gap (quantified)** : MCH Venise ranking = 8 entries, **172 words FR
  avg but only 15 words EN avg**, and the FR prose is _generic_ (« s'impose
  naturellement dans un classement ») vs competitors' _concrete_ ~150-250 words
  (architect, the room to book, the signature Michelin table, the Clooney/
  Tchaikovsky anecdote) + a structured end-block (address, keys, "prix à partir
  de", official site, Booking link) + neighbourhood grouping + a Club −25 % hook.
- **Visual gap (prior audit, still holds)** : no above-the-fold image, no
  `og:image`, 1 photo/hotel buried under 3 700-5 500 chars of prose — vs yonder's
  hero + 5-10 photos/hotel. The `#ranking` block is element 7 of 13.
- **Ready-to-create gaps** : **12 competitor-covered destinations with ≥4 published
  MCH hotels and NO ranking** — top: Vienne (13), Crète (13), Rajasthan (12),
  Seychelles (10), Genève (9), Lisbonne (7), Los Angeles (7), Île Maurice (7),
  Mallorca (6), Ibiza (6), Saint-Barthélemy (4), Sicile (4).

---

## 1. Competitor coverage map + slug taxonomy

### 1.1 Volume of ranking surface

| Site                       | Ranking listicles                                                             | Other editorial                                                                 | Slug shape                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **yonder.fr**              | **~430** (`/hotels/hotels-du-mois/` 68 city lists + `/les-tops/hotels/` ~360) | ~600 single-hotel reviews, 1 772 cityguides, 2 404 les-tops POI/resto/terrasses | `les-meilleurs-hotels-{de/a/du}-{ville}-{pays}`, `les-plus-beaux-hotels-{de}-{lieu}`, `{N}-meilleurs/plus-beaux-{lieu}`, `meilleurs-hotels-{N}-etoiles-{ville}`, `{lieu}-les-meilleurs-hotels`                           |
| **travellers-society.com** | ~50+ sampled (full count blocked — WP `post-sitemap.xml` 500s)                | category taxonomy by continent/country/theme                                    | flat root slugs: `plus-beaux-hotels-{ville}[-luxe/-charme]`, `meilleurs-hotels-{ville/pays}[-luxe/-5-etoiles]`, `les-plus-beaux-hotels-de-{ville}`, `plus-beaux-hotels-{N}-etoiles-{ville}`, `top-5-cinq-etoiles-france` |
| **MyConciergeHotel**       | **671 published** (523 geographic, 119 thematic, 23 best_of, 6 awarded)       | guides, itineraries, lieux                                                      | `/classement/{slug}` — `meilleurs-hotels-{axe}-{ville}`, `meilleurs-{N}-etoiles-{ville}`, `meilleurs-palaces-{ville}`, `hotel-de-luxe-{ville}` (×1), `plus-beaux-hotels-{ville}` (×17)                                   |

### 1.2 Destination coverage — overlap

Both competitors cover **big cities + small French towns/regions + international
islands**, the same three-tier breadth. Confirmed destinations:

- **Big cities** (all 3 cover): Venise, Rome, Marrakech, Florence/Toscane, Milan,
  Istanbul, Barcelone, Tokyo, Budapest, Dubai, Abu Dhabi, New York, Reims.
- **Competitor French regions/towns**: Provence, Bretagne, Bourgogne, Corse,
  Côte d'Azur, Luberon, Var, Alsace/Colmar, Normandie, Dordogne, Pays Basque,
  Biarritz, Haute-Savoie, Megève, Méribel, Courchevel, Saint-Tropez, Cap-Antibes,
  Cannes, Cassis, Deauville, Honfleur, Lyon, Bordeaux, Nantes, Montpellier,
  Avignon, Arles, Marseille, Aix, Nîmes, Loire (châteaux), Pyrénées, Périgord.
- **Competitor international**: Maldives, Seychelles, Île Maurice, Bali, Crète,
  Sicile, Sardaigne, Zanzibar, Rajasthan, Tahiti/Polynésie, Mexique/Riviera Maya,
  Rép. Dominicaine, Saint-Barth, Brésil, Afrique du Sud, Australie, Madagascar,
  Tenerife, Lanzarote, Mallorca, Ibiza, Açores, Slovénie, Autriche, Suisse,
  Lisbonne, Porto, Tel-Aviv, Tbilissi, Bergen, Mardin, Doha, Singapour, Montréal,
  Los Angeles.
- **yonder also slices micro-local Paris** (arrondissements 1/5/7/9/16, Opéra,
  Avenue Montaigne, Grands Boulevards, proche-Tuileries, vue-Seine) — MCH already
  matches this with its Paris arrondissement matrix.

**Net** : MCH's matrix is _deeper_ per covered city (8-15 axes) but _narrower_
geographically. Competitors win the **long tail of secondary geography**.

---

## 2. SEO reality (DataForSEO — France, FR, search_volume 12-mo avg + live SERP)

### 2.1 Phrasing: `hotel de luxe {ville}` >> `meilleurs hotels {ville}`

| Ville          | `meilleurs hotels` | `hotel de luxe` | `plus beaux hotels` | Ratio luxe/meilleurs |
| -------------- | -----------------: | --------------: | ------------------: | -------------------: |
| Paris          |                110 |       **2 900** |                  70 |              **26×** |
| Marrakech      |                140 |         **880** |                   — |                   6× |
| Dubai          |                 30 |         **320** |                   — |                  10× |
| New York       |                 30 |         **210** |                   — |                   7× |
| Venise         |                 50 |         **170** |                  20 |                 3.4× |
| Rome           |                 90 |             140 |                   — |                 1.5× |
| Istanbul       |                 40 |              90 |                   — |                2.25× |
| Tokyo          |                 50 |              90 |                   — |                 1.8× |
| Lisbonne       |                 50 |              70 |                   — |                 1.4× |
| Dubai (rappel) |                 30 |             320 |                   — |                  10× |

→ Confirms the prior audit: `hotel de luxe {ville}` is the regular transversal
intent and MCH industrialised the weakest phrasing (1 `luxe` slug vs 521
`meilleurs-*`). NB the absolute volumes are niche (luxury FR market) — read
relative between phrasings.

### 2.2 Who ranks (live SERP, FR, depth 20)

| Query                         | yonder | travellers-society |  MCH   | Other dominants                                                                |
| ----------------------------- | :----: | :----------------: | :----: | ------------------------------------------------------------------------------ |
| `meilleurs hotels venise`     | **#1** |       **#2**       | absent | lauraenvoyage, tripadvisor, admagazine, lefigaro, bonjourvenise                |
| `plus beaux hotels marrakech` | **#1** |    **#2 & #12**    | absent | leshardis, lefigaro, vogue, tripadvisor, booking                               |
| `hotel de luxe paris`         |   #3   |       absent       | absent | tripadvisor, booking, shangri-la, fourseasons, lartisien, michelin, lastminute |

**Read** : on the editorial « meilleurs/plus beaux » phrasing the two competitors
own the top 2 organic slots ; **MCH appears nowhere in the top 20 on any query**.
On the high-volume `hotel de luxe` phrasing the SERP is OTA/brand-dominated and
only yonder (via `/les-tops/`) cracks it. PAA captured for FAQ grounding incl.
« Quels sont les 10 plus beaux hôtels de {ville} ? », « Quel est le plus bel
hôtel au monde à Marrakech ? » (Royal Mansour, World's 50 Best), « Quel est
l'hôtel des stars à Paris ? », « Quel est l'hôtel le plus cher à Paris ? ».

---

## 3. On-page / structured-data teardown

### 3.1 What competitors do per ranking page (yonder + travellers-society)

- **Hero image above the fold** + a 5-10 photo strip per hotel (visual-first).
- **Per-hotel block ~150-250 words** of _concrete_ prose: the architect/designer,
  the specific room or suite to book, the signature (Michelin) restaurant + chef,
  a celebrity/historical anecdote, the view, the spa name — _named specifics_, not
  adjectives.
- **Structured end-of-entry** : address, star rating, « prix à partir de X € »,
  link to the official site + a booking/affiliate link (yonder = `/les-tops/` +
  cityguide cross-links; travellers-society = `club.` booking funnel).
- **Neighbourhood grouping** and a clear ordered numbered list (the « top 10 »
  shape the PAA literally asks for).
- **Freshness signal** : `hotels-du-mois` = monthly dated refresh; visible
  "mis à jour" date.
- **JSON-LD** : ~6 types (Article/BlogPosting, BreadcrumbList, sometimes
  ItemList, Organization, WebPage, ImageObject). **No** `FAQPage`+`Speakable`
  on most; **no** per-entry `Hotel` entity.

### 3.2 What MCH does (measured live on `/classement/meilleurs-hotels-venise`)

- **8 entries**, FR justification **avg 172 words** — but **EN avg 15 words**
  (a **~91 % FR→EN richness gap**, EN is effectively a stub).
- FR prose is **generic/templated** : « s'impose naturellement dans ce
  classement », « une adresse de référence » — _adjectives, not specifics_. No
  named room, no chef, no anecdote, no « prix à partir de ».
- **Structured-data advantage (confirmed, prior audit)** : MCH emits **~10
  JSON-LD blocks** incl. `ItemList` + per-entry **`Hotel`** + `FAQPage` +
  `Speakable` + `BreadcrumbList` + hreflang fr/en — **richer than either
  competitor**. This is our moat for GEO/AEO and Google rich results.
- **Visual deficit (prior audit, unchanged)** : no above-the-fold image, **no
  `og:image`** (broken social/Discover card), the `#ranking` list is the **7th of
  13 page blocks**, each hotel carries **1** photo under 3 700-5 500 chars of text.

### 3.3 The gap, in one line

We win the **machine read** (JSON-LD, hreflang, FAQ/Speakable) and the **page
count**; we lose the **human read** (photos, concrete per-hotel specifics, the
literal numbered "top 10", price-from, booking CTA), the **EN parity**, and the
**authority** that puts those pages in the SERP.

---

## 4. Ready-to-create gap pages (competitor-covered, ≥4 MCH hotels, NO ranking yet)

Cross-ref of competitor destinations × MCH published-hotel inventory × existing
671 ranking slugs. All below have **≥4 published MCH hotels** and **no current
ranking page** — they are generable today (≥ `MIN_ELIGIBLE`), no new sourcing.

| #   | Destination           | MCH published hotels | Competitor covers | Suggested slug                      |
| --- | --------------------- | -------------------: | :---------------: | ----------------------------------- |
| 1   | **Vienne** (Autriche) |                   13 |       both        | `meilleurs-hotels-vienne`           |
| 2   | **Crète**             |                   13 |       both        | `meilleurs-hotels-crete`            |
| 3   | **Rajasthan**         |                   12 |      yonder       | `meilleurs-hotels-rajasthan`        |
| 4   | **Seychelles**        |                   10 |       both        | `meilleurs-hotels-seychelles`       |
| 5   | **Genève**            |                    9 |      yonder       | `meilleurs-hotels-geneve`           |
| 6   | **Lisbonne**          |                    7 |       both        | `meilleurs-hotels-lisbonne`         |
| 7   | **Los Angeles**       |                    7 |      yonder       | `meilleurs-hotels-los-angeles`      |
| 8   | **Île Maurice**       |                    7 |       both        | `meilleurs-hotels-ile-maurice`      |
| 9   | **Mallorca**          |                    6 |       both        | `meilleurs-hotels-majorque`         |
| 10  | **Ibiza**             |                    6 |       both        | `meilleurs-hotels-ibiza`            |
| 11  | Saint-Barthélemy      |                    4 |       both        | `meilleurs-hotels-saint-barthelemy` |
| 12  | Sicile                |                    4 |       both        | `meilleurs-hotels-sicile`           |

> NB inventory counts come from live PostgREST aggregation on the 2 219 published
> hotels (2026-06-23). Phuket (7) is already covered → excluded. Validate each
> against `combinator.ts` `MIN_ELIGIBLE` + city-key normalisation before generating
> (some are `country`-scope, some `city`-scope).

---

## 5. Action plan — manque / améliorer / se distinguer

### 5.1 Ce qui MANQUE (create — net-new pages)

1. **The 12 geographic gap rankings above** (Vienne, Crète, Rajasthan,
   Seychelles, Genève, Lisbonne, LA, Maurice, Majorque, Ibiza, St-Barth, Sicile)
   — `run-rankings-v2-bulk.ts`, ~50-60 LLM calls, zero new sourcing.
2. **`hotel-de-luxe-{ville}` variant slugs** on the top-volume cities (Paris 2 900,
   Marrakech 880, Dubai 320, NY 210, Venise 170) — target the phrasing that
   actually has volume. Either new slugs or `slugOverride`/alias on existing
   `meilleurs-*` rows (decide canonical vs alias to avoid cannibalisation).
3. **Secondary French regions/towns competitors own** that we may under-cover:
   Périgord/Dordogne, Pays Basque, Loire châteaux, Cassis, Honfleur — verify
   inventory first (à compléter — not all counted ≥4).

### 5.2 Ce qu'il faut AMÉLIORER (existing pages)

1. **EN parity on ranking entries — P0.** Justifications EN are ~15 words vs 172
   FR (91 % gap). Reuse the `translate-*` REST pipeline pattern to bring EN to
   FR-length faithfully across all 671 published rankings. Biggest single quality
   defect found.
2. **Concrete per-hotel specifics** : rewrite generic justifications
   (« s'impose naturellement ») to _named_ facts — architect, the room to book,
   the Michelin table + chef, one anecdote, « à partir de X € TTC ». This is the
   exact richness competitors monetise.
3. **`og:image` + above-the-fold hero** on ranking pages (broken social card +
   visual aridity, both prior audits). Pull the #1 entry's hero as the page
   `og:image`.
4. **Surface the numbered "top 10" shape** the PAA literally asks for, and add a
   visible « mis à jour le » freshness date.

### 5.3 Ce qui nous DISTINGUE (defend + amplify the moat)

1. **Keep & promote the JSON-LD lead** : we alone emit `ItemList`+per-entry
   `Hotel`+`FAQPage`+`Speakable`+hreflang. This is the GEO/AEO + rich-result moat
   — competitors can't cheaply match it. Make sure every new page inherits it.
2. **Concierge voice + `⭐ Le Conseil du Concierge`** : the operational secret
   (room number, timing, access) is a genuine differentiator neither competitor
   has — lead with it, don't bury it.
3. **IATA-accredited OTA angle + Le Concierge Club −25 %** : a trust/value hook
   competitors (affiliate listicles) structurally lack. Surface it in the entry
   end-block where they put a bare Booking link.
4. **Multi-axis depth** (spa / romantique / piscine / vue × ville) already beats
   their flat one-list-per-city — keep mining it, it's our long-tail engine.

---

## 6. Recommended next sprint (top 5, ordered by ROI)

1. **P0 — EN parity sweep on all 671 published rankings.** Bring entry
   justifications EN from ~15 → ~170 words via the faithful `translate-*` REST
   pipeline + `hasLeak()` gate. Closes the single largest measured defect and
   doubles the indexable EN surface for free. (No new sourcing.)
2. **P0 — Generate the 12 geographic gap rankings** (Vienne, Crète, Rajasthan,
   Seychelles, Genève, Lisbonne, LA, Maurice, Majorque, Ibiza, St-Barth, Sicile)
   via `run-rankings-v2-bulk.ts`. ~50-60 LLM calls, all inventory already exists.
3. **P1 — `og:image` + above-the-fold hero on ranking pages.** Reuse the #1
   entry's Cloudinary hero. Fixes the broken social/Discover card + the
   visual-aridity gap in one change; templated, applies to all 671.
4. **P1 — `hotel-de-luxe-{ville}` phrasing** for the 5 top-volume cities (Paris
   2 900, Marrakech 880, Dubai 320, NY 210, Venise 170). Decide alias vs canonical
   to avoid cannibalising the `meilleurs-*` rows.
5. **P2 — Concrete-specifics rewrite** of generic justifications (named architect
   / room to book / Michelin chef / anecdote / prix-à-partir-de) on the highest-
   traffic 20-30 city rankings first, then fan out. Matches competitor richness
   while keeping the Concierge voice + JSON-LD moat.

### Methodology + freshness notes

- Inventory + ranking counts: live PostgREST on Supabase (2 219 published hotels,
  671 published rankings), 2026-06-23.
- yonder coverage: full sitemap (7 572 URLs across 2 pages) — 68 `hotels-du-mois`
  - ~360 `les-tops/hotels` ranking listicles enumerated.
- travellers-society coverage: **partial** — WordPress `post-sitemap.xml` returns
  a WP critical-error 500, so the full ranking count is **(à compléter)**; ~50+
  pages discovered via Tavily map/search confirm the slug taxonomy. A
  `club.travellers-society.com` booking subdomain exists (not fully mapped).
- SEO: DataForSEO `google_ads_search_volume` (FR) + `serp_organic_live_advanced`
  (FR, depth 20) on a 20-keyword / 3-SERP sample — representative, not exhaustive.
- Prior audits cross-referenced: `rankings-seo-geo-audit-2026-06-22.md`,
  `rankings-appearance-photo-audit-2026-06-22.md`.
