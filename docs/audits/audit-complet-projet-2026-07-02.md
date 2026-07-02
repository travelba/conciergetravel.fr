# Audit complet du projet — front, back, parcours utilisateur, SEO/GEO

**Date** : 2026-07-02
**Méthode** : 4 volets menés en parallèle —
(1) parcours utilisateur A→Z sur la production `myconciergehotel.com` (fr + en,
desktop + mobile, mesures TTFB/cache, captures Playwright/Chromium) ;
(2) audit code front `apps/web` ; (3) audit code back (packages, DB/RLS,
sécurité, API) ; (4) audit couche SEO/GEO/AEO + benchmark yonder.fr.
**Périmètre** : lecture seule, aucun changement appliqué.

---

## 1. Verdict d'ensemble

Le socle est **solide et au-dessus du marché sur la couche machine** :
JSON-LD le plus riche du secteur (jusqu'à 20 blocs/fiche), hreflang et
canonicals corrects partout, sitemaps 7 familles avec alternates (2 929
hôtels + 1 051 classements + 79 guides + 1 158 lieux), robots.txt
pro-LLM, surface agentique complète (llms.txt, hotels.jsonl,
agent-skills.json 28 skills, 27 endpoints `/api/agent/*`), CSP nonce
stricte, RLS sur les 27 tables `public.*`, layering 4-tiers respecté,
~135 tests unitaires + 29 specs E2E.

Le plafond n'est **pas la structure on-page**. Quatre murs bloquent la
croissance :

1. **Autorité / indexation** — ~2,3 % des 8 202 URLs soumises reçoivent
   des impressions GSC ; absent du top-20 sur « meilleurs hôtels
   {ville} » quand yonder.fr est #1-2.
2. **Performance serveur** — `force-dynamic` généralisé (contrat nonce
   CSP) → **aucune page HTML servie depuis le cache CDN** ; TTFB mesurés
   en prod : home 2,7 s, fiche 3-4,5 s, classement 10,6 s,
   `/destination/paris` **12,2 s** (stable sur hits répétés,
   `x-vercel-cache: MISS` systématique).
3. **Contenu à risque indexé** — claims Palace périmés/faux en prod,
   FAQ à langue mélangée, meta cassés (plan DataSEO du 29/06 planifié
   mais **non exécuté**).
4. **Parité EN** — 795/863 classements avec `intro_en` stub (92 %),
   texte FR non traduit visible sur des pages EN indexées.

---

## 2. Parcours utilisateur A→Z (production, 2026-07-02)

### 2.1 Ce qui marche

| Étape                          | Constat                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Home fr + en                   | Rendu premium, hero + barre de recherche above the fold, mobile propre                         |
| Nav                            | Header 5 mega-menus + footer ~55 liens ; toutes les surfaces majeures atteignables             |
| Fiche hôtel (Le Meurice fr/en) | 35 `<h2>`, 20 blocs JSON-LD, 297 refs Cloudinary, Conseil du Concierge, FAQ, galerie           |
| Classement (Palaces Paris)     | TOC sticky, 24 sections, ItemList + FAQPage, « révisé le 24 juin 2026 »                        |
| Lieux                          | Fiche `Museum` + FAQ + BreadcrumbList (Museum = sous-type TouristAttraction, OK)               |
| Auth                           | `/compte` → 307 `/compte/connexion?next=…`, formulaire présent, `noindex,nofollow`             |
| Contact                        | Formulaire complet (9 inputs + textarea)                                                       |
| 404                            | Vraie 404 (status code correct)                                                                |
| Hygiène SEO                    | hreflang fr-FR/en/x-default OK partout, canonical self, 0 `Offer`, `bestRating: 5`             |
| Sitemaps                       | 7 familles, alternates xhtml:link, `guides.xml` réparé (79 URLs — le fix du 29/06 est déployé) |

### 2.2 Problèmes constatés en prod

| #   | Problème                                                                                                                                                                                                                                                  | Preuve                                                                       | Priorité |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| W1  | **Cache CDN inexistant** : `x-vercel-cache: MISS` sur 100 % des hits, y compris répétés                                                                                                                                                                   | TTFB home 2,7 s / fiche 3-4,5 s / classement 10,6 s / destination **12,2 s** | **P0**   |
| W2  | **`/hotels` = 10,4 Mo de HTML**, 2 740 liens hôtel, zéro pagination                                                                                                                                                                                       | mesure directe                                                               | **P0**   |
| W3  | **Claims Palace faux indexés** : `/en/categorie/palaces-paris` cite Ritz + Park Hyatt comme Palaces, « twelve Palaces », « reviewed every five years » — la liste officielle Atout France (juin 2026) = 13 Palaces, révision 3 ans, ni Ritz ni Park Hyatt | extrait SERP + PDF Atout France                                              | **P0**   |
| W4  | **EN mélangé au FR** : `/en/classements/lieu/paris` affiche « Sélection éditoriale de 8 hôtels raffinés à/en Paris » (FR brut) + « 8-star hotels » (mistranslation) + dates « 2023 » périmées                                                             | extrait SERP                                                                 | **P0**   |
| W5  | Copy « Amadeus net rates, no commission intermediary » dans du contenu indexé (angle Phase 6 gelée)                                                                                                                                                       | `/en/categorie/palaces-paris`, `/en/classements/lieu/paris`                  | P1       |
| W6  | **Titre dupliqué site-wide** : template ajoute « à MyConciergeHotel » même quand le titre contient déjà la marque → « MyConciergeHotel - … · MyConciergeHotel », « Lieux à visiter \| MyConciergeHotel à MyConciergeHotel »                               | titres home, lieux, itinéraires                                              | P1       |
| W7  | Header homepage ≠ header intérieur (ancres `#hotels`… + EXPÉRIENCES/MAGAZINE vs mega-menus INSPIRATION) — maillage réduit + taxonomie incohérente                                                                                                         | captures + HTML                                                              | P1       |
| W8  | llms.txt liste des URLs `/fr/…` qui font toutes 307 vers la canonique sans préfixe                                                                                                                                                                        | test `/fr/hotel/le-meurice` → 307                                            | P2       |
| W9  | robots.txt bloque `/fr/compte/` alors que le vrai chemin FR est `/compte/…` (rattrapé par le meta noindex)                                                                                                                                                | robots.txt live                                                              | P2       |
| W10 | Poids HTML fiche ~1,05-1,07 Mo (fr et en) — crawl budget + parse mobile                                                                                                                                                                                   | mesure                                                                       | P2       |
| W11 | llms.txt annonce « 2 929 hôtels / 128 pays » vs AGENTS.md « 2 219 / 127 » — drift documentaire                                                                                                                                                            | comparaison                                                                  | P2       |

Captures : home desktop + mobile, fiche desktop + mobile, classement
desktop (Playwright/Chromium, boîte Windows sans Chrome — voir skill
`windows-dev-environment`).

---

## 3. Front (`apps/web`) — synthèse

66 routes locale + 51 handlers hors-locale inventoriés. Nav pilotée par
`nav-data.ts` avec tests anti-404. Fiche hôtel ~16 blocs CDC, lecteurs
défensifs Zod → 404 propre au lieu de 500.

**P0**

- Mentions légales **draft avec placeholders `[À COMPLÉTER]`** liées
  dans le footer de toutes les pages (`(legal)/mentions-legales/page.tsx`).
- Chaînes UI FR hardcodées rendues sur les pages classements EN
  (`classement/[slug]/page.tsx` L544/743, `classements/page.tsx` L369,
  `classements/[axe]/[valeur]/page.tsx` L355).

**P1**

- `force-dynamic` site-wide (nonce CSP lu via `headers()`) — cause
  racine du W1 ; seuls llms.txt/sitemaps ont un `revalidate`.
- `loading.tsx` absent sur fiche hôtel / destination / classement ;
  pas d'`error.tsx` segment sur `/hotel/[slug]` ; `global-error.tsx`
  monolingue FR.
- Vidéo hôtel : JSON-LD `VideoObject` émis sans aucun lecteur dans le
  DOM (CDC §2 bloc 2 partiel).
- Homepage : `HomeKitHeader`/`HomeKitFooter` remplacent le chrome
  standard (voir W7).

**P2** — ~65 client components, breadcrumb client global, double stack
fiche (legacy vs kit), routes `/dev/*` exposées, redirects sans
metadata.

---

## 4. Back (packages, DB, sécurité, API) — synthèse

Layering vérifié par échantillonnage réel : domain pur, integrations
sans next/react, composition dans les apps. 78 migrations forward-only,
~115 policies RLS. API agent : Zod aux frontières + rate limit 60/min +
erreurs sans stack.

**P0**

- **Incohérence Phase 6** : le flag `PHASE_6_BOOKING_ENABLED` (OFF) ne
  gate que le JSON-LD `Offer` — mais `prepareHotelBookingRail` appelle
  Amadeus (`getBestOfferForHotel`) sur toute fiche `booking_mode`
  payant, `getAmadeusHotelSentiment` tourne sur chaque fiche, et
  Travelport est actif (`/api/travelport/search`, cron prewarm,
  `TravelportLiveRooms`). Cela explique aussi une partie des TTFB de
  3-12 s constatés (appels vendors dans le chemin de rendu).
  → soit c'est un dé-gel assumé (alors mettre à jour AGENTS.md §4ter),
  soit c'est une fuite de phase à couper.
- **Rate limit fail-open** : Redis absent ou Upstash en erreur →
  `/api/agent/*` sans aucune limite
  (`apps/web/src/server/agent/rate-limit.ts` L69-80).

**P1**

- `dangerouslySetInnerHTML` sur le HTML kit fiche
  (`hotel-page-kit.tsx` — `prefixHtml`/`mainHtml` depuis la DB).
- `@mch/observability` (pino + redaction PII) **jamais importé** —
  logs `console.*` en prod server.
- Prédicat d'indexabilité dupliqué SQL (`0078_…rpc.sql`) ↔ TS
  (`indexability.ts`) — risque de divergence sitemap vs noindex.
- Pipelines éditoriaux legacy **sans grounding DFS ni `hasLeak()`** :
  `premium-section-generator.ts` (Tavily only),
  `description-extend-generator.ts`, `concierge/run-humanizer-faq.ts`,
  `guides/generate-guide.ts` v1, `rankings/generate-ranking.ts` v1,
  `rankings/meta-desc-generator.ts`.

**P2** — health endpoint sans checks, `Date.now()` défauts dans
domain/reviews, sync `cms.hotels → public.hotels` non implémentée,
tests manquants sur vendors secondaires.

---

## 5. SEO / GEO — synthèse

Couche machine en avance sur yonder (~10 types JSON-LD/page vs ~6,
FAQPage + Speakable + hreflang systématiques, surface agent unique au
secteur). Gel `Offer` correctement implémenté et vérifié en prod.

**P0**

- **Autorité/indexation** : ~191 pages avec impressions sur 8 202
  soumises (~2,3 %) ; 2 keywords classés vs 15 568 pour yonder
  (ETV 2,5 vs 437 k). Le chantier n'est plus on-page : backlinks,
  crawl budget (aggravé par W1/W2/W10), résoumissions GSC.
- **795/863 classements `intro_en` stub (92 %)** + 274 justifications
  EN stub + 272 sections sans EN.
- **Plan DataSEO 29/06 non exécuté** (224 modify / 162 create /
  110 remove sur 200 entités auditées) — les cas W3/W4 vus en prod en
  sont la matérialisation exacte. La Vague 1 P0 (10 fiches, corrections
  déterministes) est prête et documentée.
- **Lexique** : 521 slugs `meilleurs-*` vs ~1 `hotel-de-luxe-*` alors
  que le volume est sur « hôtel de luxe {ville} » / « luxury hotels
  {city} » (10-30×).

**P1** — EEAT (~150 hôtels sans external_sources, 27 % sans
AggregateRating Google), 12 destinations couvertes par yonder sans
ranking MCH (Vienne, Crète, Lisbonne…), `dfs_paa_coverage` non persisté
en DB (audit catalogue impossible sans re-run), slug EN des classements
= slug FR.

**P2** — photos CDC (0,2 % ≥ 30 photos), alt vignettes rankings non
enrichis, tests JSON-LD manquants (Article, Breadcrumb, HotelRoom),
35 country guides `guide-*` non renderables.

---

## 6. Backlog consolidé priorisé

### P0 (ordre d'attaque recommandé)

| #   | Action                                                                                                                                                                                                   | Volet       | Effort      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| 1   | Exécuter **Vague 1 DataSEO P0** (10 fiches + claims Palace : corriger `/en/categorie/palaces-paris` et consorts avec la liste Atout France juin 2026)                                                    | Contenu     | 1 j         |
| 2   | **Parité EN classements** — pipeline `intro_en` + justifications sur les 795 stubs                                                                                                                       | Contenu     | 2-3 j       |
| 3   | **Perf serveur** : ADR nonce→hash CSP (ou split JSON-LD/nonce) pour réactiver l'ISR HTML ; sortir les appels Amadeus/Travelport du chemin de rendu ; viser `x-vercel-cache: HIT` sur fiche + destination | Front/Back  | ADR + 2-4 j |
| 4   | **Paginer `/hotels`** (10,4 Mo → pages pays/ville ou pagination)                                                                                                                                         | Front       | 1 j         |
| 5   | **Trancher Phase 6** : geler réellement Amadeus/Travelport sur les routes publiques OU documenter le dé-gel dans AGENTS.md §4ter                                                                         | Gouvernance | 0,5 j       |
| 6   | **Fail-open rate limit** → fail-closed (429) quand Redis indisponible                                                                                                                                    | Back        | 0,25 j      |
| 7   | **Mentions légales** : compléter ou retirer le lien footer                                                                                                                                               | Front       | 0,25 j      |
| 8   | i18n des chaînes hardcodées classements                                                                                                                                                                  | Front       | 0,5 j       |
| 9   | Pack autorité : backlinks + résoumission sitemaps GSC (guides.xml désormais OK)                                                                                                                          | SEO         | continu     |

### P1

Matrice lexicale `hotel-de-luxe-{ville}` / `luxury-hotels-{city}` ;
12 rankings géo gap vs yonder ; grounding DFS sur premium-sections +
gate PAA sur long_description/lieux ; title template dupliqué ;
`loading.tsx`/`error.tsx` fiche ; vidéo hôtel DOM ; header homepage
aligné ; pino branché ; `dangerouslySetInnerHTML` kit sécurisé ;
indexabilité SQL/TS unifiée ; EEAT (external_sources + ratings).

### P2

llms.txt URLs canoniques ; robots.txt `/compte` ; poids HTML fiche ;
photos CDC (Phase 2) ; tests JSON-LD manquants ; nettoyage scripts
v1/v2 dupliqués ; drift AGENTS.md (2 219 vs 2 929 hôtels).

---

## 7. Références

- Plan d'exécution DataSEO : `docs/audits/dataseo-action-plan-2026-06-29.md`
- Indexation GSC : `docs/audits/gsc-indexation-2026-06-29.md`
- Benchmark concurrent : `docs/audits/competitor-travellers-yonder-audit-2026-06-23.md`
- Parité EN classements : `docs/audits/rankings-enriched-content-audit-2026-06-29.md`
- Grand audit fiches : `docs/audits/hotel-fiche-grand-audit-2026-06-29.md`
