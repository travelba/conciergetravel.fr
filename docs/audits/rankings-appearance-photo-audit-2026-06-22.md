# Audit apparence / photos / UX — pages classement (`/classement/<slug>`)

**Date** : 2026-06-22 · **Branche** : `feat/lieux-a-visiter-vertical` · **Scope** : READ-ONLY
(DB + contenu non modifiés ; seul livrable écrit = ce rapport).

> **Pourquoi cet audit** : l'acquisition des pages classement repose sur des
> visiteurs cherchant « les plus beaux / meilleurs hôtels de {ville} ». La page
> doit convaincre **visuellement au premier regard** (above-the-fold), être
> riche en photos et performante. L'audit mesure l'écart entre cet objectif et
> le rendu réel en prod.

## Méthode & outillage

- **Aucun navigateur disponible sur la machine** : Playwright MCP
  (`Chromium 'chrome' is not found`) **et** chrome-devtools MCP
  (`Could not find Google Chrome executable`) échouent tous les deux → **pas de
  screenshot, pas de Lighthouse, pas de mesure CWV réelle**. Conformément au
  fallback prévu, l'audit est basé sur : **curl du HTML prod + analyse
  structurelle + lecture du code des composants + requêtes SQL read-only**.
- **DB** : Supabase MCP `execute_sql` (read-only), projet `fsmfozxgujskluxakeoq`.
- **Code lu** : `apps/web/src/app/[locale]/classement/[slug]/page.tsx`,
  `apps/web/src/server/rankings/get-ranking-by-slug.ts`,
  `apps/web/src/styles/kit.css` (blocs `.rk-page-head`, `.crank`, `.cr-photo`).
- **prod curl** : FR + EN sur `meilleurs-hotels-nice`,
  `plus-beaux-hotels-cote-d-azur`, `palaces-de-france-2026`.
- **Concurrent** : yonder.fr via Tavily extract (4 pages « meilleurs hôtels
  Côte d'Azur / Saint-Tropez »).

---

## TL;DR — verdict

La **couverture photo des entrées est un faux problème : elle est quasi
parfaite (99,8 %), 100 % Cloudinary, 0 fuite fournisseur.** Le vrai problème
est **structurel et visuel** :

1. **Aucune image au-dessus de la ligne de flottaison.** `0 image` ne rend
   avant la section `#ranking` sur les 3 pages testées (FR+EN). La page
   « plus beaux hôtels » s'ouvre sur du **texte pur** (eyebrow + H1 + résumé +
   intro méthodologie de 3 700-5 500 caractères + 4 à 8 sections éditoriales)
   **avant** la moindre photo.
2. **Le `hero_image` du classement n'est ni rempli (0/634) ni rendu** (le
   composant ne lit jamais `ranking.hero_image`). La page n'a structurellement
   pas de visuel d'entrée.
3. **Pas de `og:image`** sur aucune page classement → 0 aperçu visuel au partage
   (WhatsApp, X, Slack, iMessage), canal d'acquisition direct pour ces requêtes.
4. Les **vignettes d'entrées rendent bien** (Cloudinary `f_auto,q_auto`,
   `c_fill,g_auto`), mais **une seule photo par hôtel**, et elles sont
   **enterrées** sous tout le texte éditorial.

Face à yonder.fr (gros hero + 5-10 photos par hôtel, immersif dès le scroll —
mais Drupal daté, JPEG non optimisés, clutter Booking) : **nous gagnons sur
l'hygiène/perf/structured-data, nous perdons nettement sur l'immersion visuelle
au premier regard.**

---

## 1. Couverture photo des entrées de classement (point clé)

Source : `editorial_rankings` ⋈ `editorial_ranking_entries` ⋈ `hotels` (publiés).

| Métrique                                                        | Valeur             |
| --------------------------------------------------------------- | ------------------ |
| Rankings publiés                                                | **634**            |
| Entrées de classement (total)                                   | **5 367**          |
| Entrées avec `hero_image` réel                                  | **5 354 — 99,8 %** |
| Entrées servies via Cloudinary (`cct/…`)                        | **5 354 — 99,8 %** |
| Entrées avec URL fournisseur (`http…`)                          | **0**              |
| Fuite Pinterest / Wikimedia / Booking / TripAdvisor (src image) | **0**              |

→ **La couverture photo des entrées est essentiellement résolue.** Seules
**13 entrées** sur 5 367 manquent un visuel, et elles ne correspondent qu'à
**3 hôtels distincts** (tous `gallery_images = 0` également) :

| Hôtel                 | Ville   | Pays | Cause (cf. `photo-pipeline` skill) |
| --------------------- | ------- | ---- | ---------------------------------- |
| `six-senses-bangkok`  | Bangkok | TH   | Pré-ouverture (0 Google Places)    |
| `fouquet-s-mykonos`   | Mykonos | GR   | Indépendant obscur (0 Places)      |
| `kempinski-hybernska` | Prague  | CZ   | 0 Places / source épuisée          |

Ces 3 hôtels sont exactement les résidus « sourcing auto épuisé / nécessite
headless-browser ou sourcing manuel » documentés dans
`.cursor/skills/photo-pipeline/SKILL.md` (§ residual ~15, §anti-pattern
Tavily-extract).

### Classements les plus « pauvres » visuellement

Le manque ne se voit que sur de **petites listes** où 1 entrée absente pèse
lourd en proportion (le hôtel manquant est souvent partagé entre plusieurs
classements d'une même ville — d'où le cluster Prague) :

| Slug                                                     | Entrées avec photo / total | Couverture |
| -------------------------------------------------------- | -------------------------- | ---------- |
| `meilleurs-hotels-piscine-prague`                        | 2 / 3                      | 67 %       |
| `meilleurs-palaces-prague`                               | 2 / 3                      | 67 %       |
| `meilleurs-hotels-gastronomie-prague`                    | 3 / 4                      | 75 %       |
| `meilleurs-hotels-montagne-prague`                       | 5 / 6                      | 83 %       |
| `meilleurs-hotels-mykonos`                               | 6 / 7                      | 86 %       |
| `meilleurs-hotels-charme/famille/kids-prague`            | 7 / 8                      | 88 %       |
| + 6 autres (Grèce, Tchéquie, LHW, Kempinski, Six Senses) | n-1 / n                    | 94-99 %    |

**Tous les 8 classements vedettes demandés sont à 100 %** : `palaces-de-france-2026`
(33/33), `meilleurs-palaces-paris` (8/8), `plus-beaux-hotels-cote-d-azur` (6/6),
`meilleurs-hotels-nice` (8/8), `meilleurs-hotels-saint-tropez` (3/3),
`classement-travel-leisure-worlds-best-2025` (84/84), `meilleurs-palaces-provence` (3/3).

### La vignette rend-elle vraiment à l'écran ? (vs JSON-LD seul)

**Oui.** Le `<img class="cr-photo">` est rendu en DOM (pas seulement dans le
JSON-LD ItemList). Vérifié en prod :

- `meilleurs-hotels-nice` (FR) : **8** `<img class="cr-photo">`, **16** URLs
  `res.cloudinary.com` (8 vignettes `w_680,h_510` + 8 images JSON-LD `w_1200,h_800`).
- `palaces-de-france-2026` : **33** vignettes rendues.
- EN : parité totale (8 vignettes sur Nice EN).
- L'unique occurrence « booking.com/tripadvisor/wikimedia » dans le HTML est un
  **objet i18n JS** (`"bookingCom":"Booking.com"`, labels du footer sources),
  **pas une URL d'image** → confirmation **0 fuite fournisseur**.

---

## 2. Rendu, hiérarchie & above-the-fold (FR + EN)

### Ordre de rendu réel de la page (`page.tsx`)

1. Breadcrumb
2. **`header .rk-page-head`** : eyebrow « Classement éditorial » + **H1** +
   résumé factuel (`.rk-summary`) + badge « Mis à jour en … »
3. `#tldr` « Le verdict en bref » — liste texte top-3 (liens, pas de photos)
4. `#introduction` « Notre méthodologie » — **intro longue (3 700-5 500 c)**
5. **`editorial_sections`** — 4 à 8 sections (`<h2>` + prose)
6. `#tableaux` (tables comparatives, si présentes)
7. **`#ranking` ← PREMIÈRE PHOTO DE LA PAGE** (les cartes `.crank` à vignette)
8. glossaire, callouts, outro, FAQ, cross-links, sources

→ **La charge utile visuelle (`#ranking`) est l'élément 7 sur 13.** Mesure prod
`imgs_before_ranking = 0` sur **les 3 pages, FR et EN**.

Volume de texte au-dessus des premières photos (intro + nb sections) :

| Slug                                         | intro (caractères) | sections | Entrées photo (enfin) |
| -------------------------------------------- | ------------------ | -------- | --------------------- |
| `palaces-de-france-2026`                     | 5 522              | 8        | 33                    |
| `meilleurs-palaces-provence`                 | 5 410              | 6        | 3                     |
| `meilleurs-hotels-nice`                      | 5 288              | 7        | 8                     |
| `plus-beaux-hotels-cote-d-azur`              | 3 864              | 4        | 6                     |
| `meilleurs-palaces-paris`                    | 3 780              | 4        | 8                     |
| `meilleurs-hotels-saint-tropez`              | 3 717              | 5        | 3                     |
| `classement-travel-leisure-worlds-best-2025` | 2 026              | 7        | 84                    |

### Hiérarchie above-the-fold

Le bloc `.rk-page-head` est soigné typographiquement : H1 serif `clamp(34px,5vw,58px)`,
résumé factuel `data-aeo` avec filet doré à gauche, badge fraîcheur. **Mais il
est 100 % textuel** — aucun visuel, aucun « podium » des 3 premiers hôtels,
aucune vignette. Pour une requête « les plus beaux hôtels de … », l'écran
d'accueil ne montre **aucune photo d'hôtel**.

### H1 + millésime (FR+EN)

- Code (branche) : `stampYear()` doit ajouter « en {YYYY} » au H1.
- **Prod (main)** : le H1 n'est stampé **que** si le `title` contient déjà une
  année :
  - `palaces-de-france-2026` → H1 « Palaces de France **2026** : la liste
    officielle… » ✅ (année dans le titre).
  - `meilleurs-hotels-nice` → H1 « Les meilleurs hôtels de Nice » **sans année**
    (le `<title>` méta affiche « …sélection **2025** », le badge affiche
    « Mis à jour le 22 juin **2026** », le résumé affiche « …, **2026** : »).
  - `plus-beaux-hotels-cote-d-azur` → idem, **sans année** dans le H1.
- **Constat** : sur prod, le millésime du H1 est **incohérent** (présent
  seulement quand le titre l'embarque) et le `<title>` (2025) **diverge** du
  badge (2026). Probablement un **décalage de déploiement** (`stampYear` est
  sur la branche, prod = `main`). À **revérifier après le prochain déploiement**
  de `main` ; non bloquant pour l'apparence, mais c'est un signal de fraîcheur
  visible à corriger.

### Parité FR / EN

Bonne. EN rend la même structure (H1 « The best hotels in Nice », 8 vignettes,
0 image avant `#ranking`, même absence d'`og:image`). Pas de clé i18n manquante
observée.

---

## 3. Perf / CLS / LCP (raisonné depuis le code — pas de mesure réelle)

> ⚠ Aucun Lighthouse/CWV réel (pas de Chrome). Estimations qualitatives.

### LCP — probablement bon… par défaut, mais visuellement vide

- **Aucune image hero** → l'élément LCP est très probablement le **H1 texte**
  (police serif `font-display: swap`). Pas de gros téléchargement d'image au
  premier rendu → LCP probablement **< 2 s**.
- Revers : ce « bon » LCP vient du fait que la page **n'a aucun visuel fort** —
  on optimise la vitesse d'un écran… vide de photos. Ajouter un hero devra se
  faire **avec `priority` + dimensions réservées** pour ne pas régresser.
- Risque mineur : **swap de la police serif** (Playfair-like) peut provoquer un
  petit repaint LCP ; vérifier le `preload` (la skill perf recommande de ne
  précharger que la sans body, serif non préchargée — acceptable).

### CLS — entrées bien protégées, mais risque header connu

- **Vignettes d'entrées : risque faible.** `.cr-photo` impose
  `aspect-ratio: 4/3` (16/10 puis responsive en mobile) et la grille `.crank`
  réserve une **colonne photo fixe (340px desktop)**. La hauteur est donc
  réservée **même si** le `<img>` n'a **pas** d'attributs `width`/`height`
  (confirmé : `0` `<img width=>` en prod). Le chargement des vignettes ne
  décale pas la mise en page.
  - _Amélioration belt-and-suspenders_ : ajouter `width`/`height` explicites sur
    le `<img>` (la skill perf et `responsive-ui` les exigent) pour blinder le cas
    où le CSS `aspect-ratio` ne s'appliquerait pas (CSS différé, vieux navigateur).
- **Risque CLS hérité du header (documenté, sitewide).**
  `performance-engineering` §Client-island placeholder height mismatch
  (2026-06-22) documente un **CLS ~0.95 sur les pages internes FR signées-out
  desktop** dû au wrap des CTA `auth-area.tsx`. **Les pages classement sont des
  pages internes** → elles **héritent** de ce risque tant que le fix
  (`whitespace-nowrap` + `shrink-0`) n'est pas déployé en prod. À confirmer
  (impossible sans navigateur ici) — mais c'est le **risque CLS n°1** réel sur
  ces pages, devant tout le reste.

### Poids / TTFB

- **HTML très lourd** : Nice FR = **704 KB**, Côte d'Azur = 658 KB,
  `palaces-de-france-2026` = **911 KB** (long-form inline + JSON-LD inline +
  bundle i18n). Gzip aide, mais le transfert + parse HTML restent coûteux mobile.
- **`export const dynamic = 'force-dynamic'`** (nécessaire pour le nonce CSP) →
  **pas de cache HTML CDN** : chaque requête refait le rendu serveur + plusieurs
  allers-retours Supabase (`getRankingBySlug` + `getRankingEntries` en 2 temps +
  `linkMap` + siblings + itinéraires, en `Promise.all`). **Risque TTFB > 600 ms**
  (cible CDC) sur chemin froid. Le code note qu'ADR-0027 (CSP par hash)
  ré-activerait l'ISR — levier de fond.
- **Pas de `srcset`/`sizes`** sur les vignettes (`<img src>` unique en
  `w_680`). Acceptable aux tailles actuelles (colonne 340px → 2× retina), mais
  pas de livraison adaptative.

---

## 4. Comparaison visuelle vs yonder.fr

Pages analysées : `hotel-cote-d-azur-…-palaces`, `15-plus-beaux-hotels-de-saint-tropez`,
`plus-beaux-5-etoiles-cote-azur`, `hotel-spa-paca-…`.

| Critère                         | MyConciergeHotel                                  | yonder.fr                                                    |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **Hero above-the-fold**         | ❌ aucun (texte seul)                             | ✅ grand hero paysage (`scale_1100x734`) + `og:image`        |
| **Photos par hôtel**            | **1** vignette `w_680`                            | **5-10** (chambre, resto, spa, piscine, extérieur, drone)    |
| **Immersion au scroll**         | texte long puis cartes                            | **essai photo** quasi continu, crédits ©photographe          |
| **`og:image` (partage social)** | ❌ absent partout                                 | ✅ présent                                                   |
| **Optimisation images**         | ✅ Cloudinary `f_auto,q_auto`, refs propres       | ⚠ JPEG/PNG Drupal non-optimisés, certains screenshots `.png` |
| **Hygiène légale / clutter**    | ✅ 0 fuite, pas d'affiliation visible             | ⚠ « Voir les prix sur Booking.com », mix de sources          |
| **Données structurées**         | ✅ ItemList (image+geo), FAQ, Article, Breadcrumb | basique                                                      |
| **Fraîcheur datée**             | ✅ badge « Mis à jour … »                         | ⚠ thème `responsive_bartik` daté, captures 2024              |

**Verdict** : yonder est **plus convaincant au premier regard et plus immersif**
(le visiteur « plus beaux hôtels » voit immédiatement de belles photos, puis une
galerie par hôtel). MyConciergeHotel est **plus propre, plus rapide, mieux
structuré pour Google/LLM**, mais **visuellement aride au-dessus de la flottaison
et avare en photos par hôtel**. Sur l'intention « les plus beaux », l'œil gagne
chez yonder ; la donnée et la perf gagnent chez nous.

---

## 5. Synthèse priorisée (P0/P1/P2 · effort × impact)

### P0 — quick-wins visuels à fort impact (l'écart qui coûte des conversions)

| #        | Action                                                                                                                                                                                                                                                                                                                                                                                           | Effort                 | Impact                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------- |
| **P0-A** | **Ajouter un visuel above-the-fold** : rendre un hero (image top-1 de la liste, ou bandeau « podium » 3 vignettes des 3 premiers hôtels) **juste après le H1**, AVANT l'intro méthodologie. Le `hero_image` de chaque entrée existe déjà (99,8 %) → **0 sourcing requis**, pur rendu. `next/image`-libre (cf. `photo-pipeline` anti-pattern), `c_fill,g_auto`, `priority`, dimensions réservées. | Moyen (1 composant)    | **Très élevé** — supprime l'écran texte-pur, comble l'écart n°1 vs yonder |
| **P0-B** | **`og:image`** : ajouter `openGraph.images` (+`twitter.card='summary_large_image'`) dans `generateMetadata`, dérivé du hero top-1 (Cloudinary `w_1200,h_630`). Débloque l'aperçu au partage social.                                                                                                                                                                                              | Faible                 | Élevé (canal partage)                                                     |
| **P0-C** | **Vérifier/déployer le fix CLS header** (`auth-area.tsx`, perf-skill 2026-06-22) — les pages classement héritent du CLS ~0.95 FR desktop signed-out.                                                                                                                                                                                                                                             | Faible (déjà spécifié) | Élevé (CWV)                                                               |

### P1 — renforcements visuels & perf

| #        | Action                                                                                                                                                                                                                                                    | Effort      | Impact                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------- |
| **P1-A** | **Remonter / dupliquer un aperçu des entrées plus haut** : un strip « Le top en images » (carousel snap mobile ↔ grille desktop, cf. `responsive-ui` §Snap carousels) entre le `#tldr` et l'intro, pour ne pas enterrer les photos sous 5 000 c de prose. | Moyen       | Élevé                 |
| **P1-B** | **`width`/`height` explicites** sur `<img class="cr-photo">` (et un `srcset`/`sizes` 340/680/1020) — blinder le CLS et livrer adaptatif.                                                                                                                  | Faible      | Moyen                 |
| **P1-C** | **H1 millésime** : revérifier après déploiement `main` que `stampYear` s'applique aux titres sans année ; aligner le `<title>` (2025) sur le millésime courant (2026).                                                                                    | Faible      | Moyen (fraîcheur SEO) |
| **P1-D** | **Plusieurs photos par entrée** (mini-galerie 2-3 vignettes depuis `gallery_images`) pour rapprocher l'immersion yonder, en conservant Cloudinary.                                                                                                        | Moyen-élevé | Moyen-élevé           |

### P2 — chantiers de fond

| #        | Action                                                                                                                                                                                                                                                                                                 | Effort           | Impact            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ----------------- |
| **P2-A** | **Sourcer les 3 hôtels sans photo** (`six-senses-bangkok`, `fouquet-s-mykonos`, `kempinski-hybernska`) — résidu « sourcing auto épuisé », nécessite **headless-browser / sourcing manuel** (cf. `photo-pipeline` §anti-pattern Tavily, §residual ~15). Faible volume, impact limité (13/5367 entrées). | Élevé (manuel)   | Faible            |
| **P2-B** | **ISR via CSP par hash (ADR-0027)** pour sortir du `force-dynamic` et cacher le HTML au CDN → TTFB.                                                                                                                                                                                                    | Élevé            | Moyen (perf/coût) |
| **P2-C** | **Remplir `editorial_rankings.hero_image`** (0/634) si on veut un hero éditorial dédié plutôt que dérivé du top-1.                                                                                                                                                                                     | Moyen (pipeline) | Moyen             |

---

## Annexe — preuves (curl prod, pas de screenshot possible)

```
GET /classement/meilleurs-hotels-nice (FR)         704 KB · h1="Les meilleurs hôtels de Nice" · og:image ABSENT · cr-photo×8 · imgs_before_#ranking=0
GET /en/classement/meilleurs-hotels-nice (EN)      569 KB · h1="The best hotels in Nice"      · og:image ABSENT · cr-photo×8 · imgs_before_#ranking=0
GET /classement/plus-beaux-hotels-cote-d-azur      658 KB · h1 sans année                     · og:image ABSENT · cr-photo×6 · imgs_before_#ranking=0
GET /classement/palaces-de-france-2026             911 KB · h1 avec "2026"                     · og:image ABSENT · cr-photo×33 · imgs_before_#ranking=0
```

Couverture entrées (SQL) : 5 354 / 5 367 (99,8 %) Cloudinary · 0 URL fournisseur ·
634 rankings publiés · `editorial_rankings.hero_image` rempli = 0/634.
