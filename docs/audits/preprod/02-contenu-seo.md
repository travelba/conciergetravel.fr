# Audit pré-production — Cluster 2 : Contenu & Cohérence éditoriale + SEO & Métadonnées + cohérence FR/EN

> Périmètre : `apps/web` (Next.js 16 App Router, i18n `fr` défaut + `en` préfixé,
> contenu `force-dynamic` Supabase `fsmfozxgujskluxakeoq`). Audit **lecture seule**
> du code + de la DB (aucune modification, aucun commit). Sources : `packages/seo`
> (metadata, jsonld, llms, sitemaps), `generateMetadata` des 62 `page.tsx`,
> helpers `lib/seo/hotel-page-seo.ts` + `i18n/runtime.ts`, requêtes PostgREST
> lecture seule sur le catalogue publié, et **inspection live prod** (`curl` sur
> `/` et `/en/` : `<title>`, meta description, OG, canonical, hreflang, H1).
>
> Règle PO appliquée : benchmark explicite vs **yonder.fr / travellers-society.com**
> (`.cursor/rules/competitor-benchmark-yonder.mdc`) + conformité **EDITORIAL_VOICE.md**.
>
> Date : 2026-06-23.

---

## Méthode

- **Code** : lecture de `buildPageMetadata` (`packages/seo/src/metadata.ts`),
  des `generateMetadata` représentatifs (`hotel/[slug]`, `classement/[slug]`,
  `lieux/[citySlug]/[placeSlug]`, `destination/[citySlug]`), des helpers
  `hotel-page-seo.ts` + `i18n/runtime.ts` (hreflang / og:locale / canonical).
- **DB (read-only)** : agrégations PostgREST sur `hotels` (2219 publiés),
  `editorial_rankings` (688 publiés) + `editorial_ranking_entries` (5442),
  `places` (1147 publiés), `editorial_guides` — couverture FR/EN, parité,
  doublons meta, contenu mince, hero.
- **Live prod** : `curl` sur fiche hôtel (`le-bristol-paris`), classement
  (`meilleurs-hotels-venise`), destination (`paris`), pages institutionnelles
  - vérification des `robots` sur surfaces gelées Phase 6.
- Patterns récurrents regroupés en un seul ticket.

---

## Issues

### 🔴 [CRITIQUE] — La prod est en retard sur le repo : les correctifs SEO « P0 ranking » (og:image, hero above-the-fold, TL;DR, millésime courant) ne sont PAS déployés → 688 pages classement live sans carte sociale

- **Page/Fichier :** `apps/web/src/app/[locale]/classement/[slug]/page.tsx`
  (blocs `generateMetadata` → `resolveRankingHeroPublicId` / `ogImages`, bloc
  `P0-A` podium, bloc `P0-2` TL;DR, `stampYear`) — **présents dans le code**,
  **absents du rendu prod**.
- **Problème :** Le code émet un `og:image` 1200×630 (dérivé du hero du n°1),
  un hero podium above-the-fold, un bloc « verdict en bref » `#tldr`, et stampe
  le **millésime courant** dans le `<title>`/H1. La DB confirme que **les 688
  classements publiés ont au moins une entrée dont l'hôtel porte un
  `hero_image`** (Venise : 8/8 entrées avec hero) → l'`og:image` devrait
  toujours s'émettre. Or l'inspection live de `/classement/meilleurs-hotels-venise`
  montre :
  - `og:image` : **0** (seuls `og:title`/`description`/`locale`/`type` rendus) ;
  - `rk-podium` : **0**, `#tldr` : **0**, image podium `w_1280` : **0** ;
  - `<title>` : « …notre sélection **2025** » (millésime de l'an passé).

  La fiche hôtel, elle, émet bien le set `og:image` complet → le défaut est
  **spécifique au template classement non déployé**, pas à `packages/seo`.

- **Impact :** Sur **toute** la surface d'acquisition classement (688 pages —
  le levier #1 vs yonder) : carte sociale / Google Discover **cassée** (pas
  d'`og:image`), aridité visuelle above-the-fold, et signal de fraîcheur
  affichant l'année précédente. Les correctifs payés existent mais sont
  invisibles pour Google et les réseaux. C'est aussi la cause-racine du
  ticket S2 (`/a-propos` 404, même symptôme de prod en retard).
- **Recommandation :** **Re-déployer `main` en prod et re-vérifier** (`curl`
  `og:image` + `rk-podium` + millésime sur 3 classements). Aucun nouveau code
  requis — c'est un problème de pipeline de livraison. Ajouter un check post-deploy
  (smoke test : `og:image` présent sur `/classement/<slug>`).

---

### 🟠 [MAJEUR] — Parité EN faible sur les justifications de classement (entrées) : EN ≈ 58 % de la longueur FR, 42 % « minces », 85 stubs

- **Page/Fichier :** `editorial_ranking_entries.justification_en` (rendu dans
  `classement/[slug]/page.tsx`, bloc `#ranking` + TL;DR + ItemList).
- **Problème :** Mesure DB live sur les 5442 entrées des 688 classements publiés :
  - `justification_fr` moy. **898 caractères** (~150 mots) ;
  - `justification_en` moy. **521 caractères** (~85 mots) → **58 % du FR** ;
  - **2309 / 5442 (42 %)** entrées où l'EN fait **moins de la moitié** du FR ;
  - **85** entrées avec EN nul ou stub (< 60 c).

  La balise `pickByLocale(locale, e.justification_fr, e.justification_en ?? …_fr)`
  rend donc, sur `/en`, soit une justification EN appauvrie, soit (85 cas) un
  fallback FR. L'audit concurrent du 2026-06-23 mesurait même ~15 mots EN sur
  Venise — cohérent avec la queue basse de cette distribution.

- **Impact :** La surface EN des classements (locale V1) est éditorialement
  deux fois plus pauvre que la FR → GEO/SEO EN dégradé, parité hreflang
  « mensongère » (la page EN existe mais sous-livre). C'est le **plus gros
  défaut de contenu** mesuré sur le cluster, et le P0 du benchmark yonder.
- **Recommandation :** Lancer un sweep de parité EN fidèle (pipeline
  `translate-*` REST + gate `hasLeak()` déjà éprouvé sur sections/descriptions)
  sur les `justification_en` < 50 % FR, en priorisant les 85 stubs puis les
  classements à fort volume (Paris, Venise, Marrakech, Dubaï, NY).

---

### 🟠 [MAJEUR] — 67 classements sans `intro_en` + 70 sans `factual_summary_en` → texte FR rendu sur les pages `/en` (mélange de langue)

- **Page/Fichier :** `classement/[slug]/page.tsx` (intro :
  `pickByLocale(locale, intro_fr, intro_en ?? intro_fr)` ; résumé factuel :
  `pickLocalizedText(locale, factual_summary_fr, factual_summary_en)`).
- **Problème :** DB live (688 publiés) : **67** lignes `intro_en` nul/vide,
  **70** lignes `factual_summary_en` nul/vide (les titres et meta_desc EN sont
  à 100 %). Sur ces pages, la version `/en` rend l'**intro FR** et/ou le **résumé
  factuel FR** sous une URL `hreflang="en"` — incohérence de langue visible
  above-the-fold (le résumé factuel est le bloc `data-aeo` juste sous le H1).
- **Impact :** Mélange FR/EN sur ~10 % des classements EN, juste à l'endroit le
  plus extrait par les moteurs de réponse (AEO factual summary). Dégrade la
  confiance EN + le ciblage GEO.
- **Recommandation :** Compléter `intro_en` + `factual_summary_en` sur ces
  67/70 lignes (même pipeline de traduction fidèle gaté). Tant que c'est vide,
  envisager de masquer le bloc plutôt que de rendre du FR sous `/en`.

---

### 🟠 [MAJEUR] — `/a-propos` et `/en/about` renvoient un **404** en prod (la redirection 308 vers `/le-concierge` échoue)

- **Page/Fichier :** `apps/web/src/app/[locale]/a-propos/page.tsx`
  (`permanentRedirect({ href: '/le-concierge', locale: raw })`).
- **Problème :** Le fichier existe et redirige (même pattern que `/guides` →
  `/destination`, qui répond bien **308** live). Mais en prod :
  - `GET /a-propos` → **404** (pas de `Location`) ;
  - `GET /en/about` → **404**.

  `a-propos` est pourtant référencé dans `components/layout/breadcrumb.tsx`,
  `i18n/routing.ts` (`pathnames`) et `i18n/legacy-en-redirects.ts`
  (`/en/a-propos` → `/en/about`). Le symptôme est cohérent avec le ticket
  🔴 (prod en retard : la page redirect committée n'est pas déployée).

- **Impact :** La page institutionnelle « à propos » (EEAT, confiance) et le
  legacy `/en/about` dead-end en 404 ; le fil d'ariane et les redirects legacy
  pointent vers une 404. Perte de link-equity + UX cassée sur une entrée de
  marque.
- **Recommandation :** Re-déployer (cf. 🔴). Après deploy, re-vérifier que
  `/a-propos` et `/en/about` renvoient bien 308 → `/le-concierge` (resp.
  `/en/le-concierge`).

---

### 🟡 [MINEUR] — Justifications éditoriales génériques / templatées (manque de concret vs concurrents)

- **Page/Fichier :** `editorial_ranking_entries.justification_fr`.
- **Problème :** **104 / 5442** entrées contiennent des formules de remplissage
  (« s'impose naturellement », « adresse de référence », « incontournable… »).
  Au-delà du compte exact, le défaut qualitatif relevé par le benchmark yonder
  tient : les justifications restent souvent en **adjectifs** plutôt qu'en
  **faits nommés** (architecte, la chambre/suite à réserver, la table Michelin
  - chef, l'anecdote vérifiable, « à partir de X € TTC ») — exactement la
    richesse que les concurrents monétisent. C'est aussi un écart à
    EDITORIAL_VOICE.md §3 (« détails concrets », bannissement des superlatifs vides).
- **Impact :** Différenciation faible côté lecture humaine ; les entrées se
  ressemblent d'un classement à l'autre. Pas bloquant (le maillage + JSON-LD
  compensent côté machine) mais c'est le levier de qualité éditoriale n°1.
- **Recommandation :** Réécriture « concrete-specifics » sur les 20-30
  classements les plus exposés d'abord (architecte / chambre à booker / chef
  Michelin / anecdote / prix-à-partir-de), en conservant la voix Concierge.

---

### 🟡 [MINEUR] — Millésime de fraîcheur affiché « année précédente » sur les classements live

- **Page/Fichier :** `classement/[slug]/page.tsx` (`resolveFreshness` autorise
  `currentYear-1` ; `stampYear`).
- **Problème :** Live, Venise affiche « notre sélection **2025** » à mi-2026.
  Techniquement « valide » (la logique accepte l'an passé quand `reviewed_at`
  date de 2025), mais le correctif qui stampe le millésime courant est dans le
  code non déployé (cf. 🔴), et même déployé, `reviewed_at` en 2025 laisserait
  l'affichage à 2025 jusqu'à un re-`reviewed_at`.
- **Impact :** Signal de fraîcheur sous-optimal sur une requête saisonnière
  (« meilleurs hôtels {ville} {année} ») — yonder rafraîchit mensuellement
  (`hotels-du-mois`).
- **Recommandation :** Après deploy, bumper `reviewed_at` (ou laisser
  `resolveFreshness` retomber sur l'année courante) pour que le `<title>`/H1/badge
  affichent l'année en cours.

---

### 🔵 [INFO / À SURVEILLER] — Fallbacks FR ponctuels & empty-states (acceptables)

- **18 hôtels** sans `concierge_advice.en` (sur 2219) → le bloc « Conseil du
  Concierge » rend en FR sur `/en`. Faible volume (0,8 %), à combler au prochain
  passage de traduction.
- **Empty-state destination « selection coming soon »**
  (`destination/[citySlug]/page.tsx` l.773-789) : intentionnel et **`noindex,
follow`** — bonne pratique anti soft-404, pas un défaut. À surveiller : ne pas
  laisser ces villes vides trop longtemps (dilution du hub `/destination`).
- Aucune fuite de placeholder réel (Lorem ipsum / TODO / FIXME / « test ») dans
  le contenu rendu — les seuls hits sont des commentaires de code et le
  placeholder `booking-coming-soon` (Phase 1 assumée). Les fuites de
  « scaffolding » documentées dans AGENTS.md (vagues 5-14) sont **soldées**
  (0 leak FR/EN catalogue).

---

### 🔵 [INFO — POSITIF] — Socle SEO/i18n robuste (à préserver)

- `buildPageMetadata` + `i18n/runtime.ts` : hreflang `fr-FR` / `en` / `x-default`
  corrects, **V2 (de/es/it) non émis** (gate `routing.locales`) — pas de hreflang
  mensonger. Canonical par locale présent partout vérifié (hôtel, classement,
  lieu, destination).
- **Titres uniques** par template (hôtel : `Nom — Palace/N★ Lieu | MyConciergeHotel`,
  avec garde anti-« Gordes…Gordes » ; destination : « Hôtels 5★ & Palaces à {ville} »).
- **0 doublon** de meta description sur les 2219 hôtels publiés.
- **Surfaces Phase 6 correctement `noindex`** : `reservation/*` (`noindex,nofollow`),
  `compte/*` (`noindex,nofollow`), `recherche` (`noindex,follow`) — conforme au gel.
  Aucune surface gelée trouvée indexable par erreur.
- **`places` (1147 lieux) : parité EN à 100 %** (description_en, factual_summary_en
  tous présents ; 0 fiche mince FR) — la meilleure surface du cluster.
- **Fiche hôtel : parité EN à 100 %** sur `long_description_sections` (0 section
  sans `body_en`) + `og:image` émis live + JSON-LD complet
  (`Hotel`+`Place`+`Breadcrumb`+`FAQPage`+`AggregateRating`).

---

## MCH vs yonder.fr

> Réf. `docs/audits/competitor-travellers-yonder-audit-2026-06-23.md`. Confirmé
> sur DB + live ce jour.

**Ce qui nous distingue (moat à défendre)**

- **Structured data supérieure** : on émet seuls `ItemList` + `Hotel` par entrée
  - `FAQPage` + `Speakable` + hreflang fr/en (≈10 blocs vs ~6). Vérifié sur le
    code `classement/[slug]` + fiche hôtel. C'est le moat GEO/AEO + rich results.
- **Profondeur multi-axes** : 688 classements publiés (spa/romantique/piscine/vue
  × ville) vs la liste plate « 1 par ville » des concurrents.
- **Voix Concierge + Conseil du Concierge** + angle OTA IATA / Club −25 % : un
  différenciateur que des listicles d'affiliation n'ont pas.
- **Lieux (1147) full-EN** + maillage hôtel ↔ lieu : surface que yonder n'a pas
  sous cette forme structurée.

**Ce qui manque / à améliorer (gaps les plus tranchants)**

1. **Carte sociale & visuel above-the-fold (LIVE)** : yonder met un hero + 5-10
   photos/hôtel et une `og:image`. MCH a le correctif **mais non déployé** →
   688 pages classement sans `og:image` ni hero ATF en prod (ticket 🔴). C'est
   l'écart le plus visible aujourd'hui.
2. **Parité EN des entrées** : nos justifications EN font 58 % du FR (42 %
   minces, 85 stubs). Les concurrents écrivent ~150-250 mots **concrets** par
   hôtel ; nous sous-livrons en EN et restons souvent génériques en FR (104
   formules templatées).
3. **Phrasing à volume** : on a industrialisé `meilleurs-hotels-{ville}` ; le
   volume réel est sur `hôtel de luxe {ville}` (Paris 2900 vs 110, ×26) — 1 seul
   slug `luxe` côté MCH. Gap de ciblage requête (hors périmètre code de ce
   cluster, mais impacte titres/descriptions).
4. **Autorité/indexation** : MCH absent du top-20 sur « meilleurs/plus beaux
   hôtels {ville} » (yonder #1, travellers #2). Écart d'autorité, pas de
   structure — ne se corrige pas par le contenu seul.

**Delta actionnable (ordre ROI)** : (1) re-déployer le correctif P0 classement
(og:image + hero + millésime) ; (2) sweep parité EN sur les justifications ;
(3) compléter `intro_en`/`factual_summary_en` (67/70) ; (4) réécriture
concrete-specifics sur les top classements.

---

## Score Contenu /10

**7.5 / 10**

Justification : la couche écrite est réellement profonde et propre — 2219 hôtels
100 % peuplés FR+EN (description, sections long-read, FAQ, conseil du Concierge,
résumé factuel), 1147 lieux en parité EN totale, **0 doublon** de meta
description, **0 fuite** de placeholder/scaffolding (vagues de nettoyage soldées).
Déductions : (a) parité EN faible sur les entrées de classement (58 % du FR,
42 % minces, 85 stubs) — défaut #1 ; (b) 67/70 classements rendent intro/résumé
FR sur `/en` ; (c) 104 justifications génériques + manque de concret vs
concurrents ; (d) millésime « an passé » sur les classements live.

## Score SEO /10

**7 / 10**

Justification : le **socle SEO/i18n du code est excellent** (JSON-LD best-in-class
confirmé vs concurrents, hreflang/canonical corrects, V2 non émis, titres &
descriptions uniques, `noindex` correct sur toutes les surfaces gelées Phase 6,
`og:image` sur les fiches hôtel). Mais la **réalité live** dégrade la note : les
correctifs P0 classement (og:image + hero ATF + millésime) sont **committés mais
non déployés** → 688 pages d'acquisition sans carte sociale ni visuel ATF, et
`/a-propos` + `/en/about` en **404**. Le « machine read » vaudrait ~8,5 ; le
« live read » + l'hygiène de déploiement le ramènent à 7. Un simple re-deploy +
re-vérification ferait remonter le score immédiatement.
