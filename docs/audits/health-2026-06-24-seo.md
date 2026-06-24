# Audit SEO technique — production `myconciergehotel.com`

> **Type** : audit **lecture seule** (aucune modification de code, de DB ou de
> déploiement). Seul écrit autorisé : ce fichier de rapport.
> **Date** : 2026-06-24 · **Méthode** : `curl` prod (en-têtes + corps), parsing
> JSON-LD, vérif sitemaps/robots, benchmark `yonder.fr`.
> **Périmètre** : Home, fiche hôtel, classement, destination/région, lieu/POI,
> itinéraire, room sub-page — FR + EN.

---

## Verdict

**Score SEO technique : 7 / 10.**
**Prêt prod : OUI, avec réserves** — _aucun P0_ : rien ne casse l'indexation ni
le rendu. Les fondamentaux (404 réels, self-canonicals, hreflang réciproques,
JSON-LD riche et valide, sitemaps conformes, noindex sur auth/recherche, en-têtes
sécurité) sont solides et **structurellement supérieurs à yonder.fr**. Mais 5
findings **P1** dégradent la performance SEO et doivent être corrigés avant de
qualifier l'axe « irréprochable » : titres `<title>` à marque dupliquée,
**absence totale de cache CDN** site-wide, un bloc `Offer`/`priceValidUntil`
injecté dans le JSON-LD des fiches hôtel (contredit le gel Phase 6), `og:image`
absent sur la home, et une meta description EN sous-dimensionnée.

---

## Pages échantillonnées (toutes vérifiées en valeurs réelles)

| Type             | URL                                                    | HTTP | X-Matched-Path                               |
| ---------------- | ------------------------------------------------------ | ---- | -------------------------------------------- |
| Home FR          | `/`                                                    | 200  | `/[locale]`                                  |
| Home EN          | `/en`                                                  | 200  | `/[locale]`                                  |
| Hôtel FR         | `/hotel/bulgari-hotel-paris`                           | 200  | `/[locale]/hotel/[slug]`                     |
| Hôtel EN         | `/en/hotel/bulgari-hotel-paris`                        | 200  | idem                                         |
| Hôtel FR #2      | `/hotel/byblos-saint-tropez`                           | 200  | idem                                         |
| Classement FR    | `/classement/palaces-de-france-2026`                   | 200  | `/[locale]/classement/[slug]`                |
| Classement EN    | `/en/classement/palaces-de-france-2026`                | 200  | idem                                         |
| Classement FR #2 | `/classement/hotel-de-luxe-tokyo`                      | 200  | idem                                         |
| Classement EN #2 | `/en/classement/hotel-de-luxe-tokyo`                   | 200  | idem                                         |
| Destination FR   | `/destination/paris`                                   | 200  | `/[locale]/destination/[citySlug]`           |
| Destination EN   | `/en/destination/paris`                                | 200  | idem                                         |
| Guide région FR  | `/destination/cote-d-azur`                             | 200  | idem                                         |
| Guide région EN  | `/en/destination/cote-d-azur`                          | 200  | idem                                         |
| Lieu / POI FR    | `/lieux/dubai/ain-dubai`                               | 200  | `/[locale]/lieux/[citySlug]/[placeSlug]`     |
| Itinéraire FR    | `/itineraire/provence-culture-gastronomie-10-jours`    | 200  | `/[locale]/itineraire/[slug]`                |
| Room sub-page FR | `/hotel/prince-de-galles-paris/chambres/suite-lalique` | 200  | `/[locale]/hotel/[slug]/chambres/[roomSlug]` |

> Note : `/hotel/ritz-paris` (demandé) **n'existe pas** dans le catalogue → renvoie
> un **vrai 404** (`HTTP/1.1 404`, `<meta name="robots" content="noindex">`,
> X-Matched-Path `/[locale]/hotel/[slug]`). Comportement correct. Slug réel
> substitué : `bulgari-hotel-paris`.

---

## Findings priorisés

### P0 — casse l'indexation / le rendu

**Aucun.** Les fondamentaux d'indexation sont sains.

---

### P1 — dégrade le SEO

#### P1-1 · `<title>` à marque dupliquée + titres trop longs (hôtel / room / itinéraire / lieu)

Les pages qui passent par le template metadata `title.template` reçoivent
**deux fois** le suffixe de marque : le champ `title` de la page contient déjà
`… | MyConciergeHotel`, puis le template du layout ajoute ` — MyConciergeHotel`.

Extraits réels (`<title>`) :

- `/hotel/bulgari-hotel-paris` →
  `Bulgari Hotel Paris — Palace Paris | MyConciergeHotel — MyConciergeHotel`
- `/hotel/byblos-saint-tropez` →
  `Hôtel Byblos Saint-Tropez — Palace Saint-Tropez | MyConciergeHotel — MyConciergeHotel`
- `/itineraire/provence-culture-gastronomie-10-jours` (**122 caractères**) →
  `Itinéraire Provence 10 jours culture & gastronomie — Aix, Les Baux, Lubéron | MyConciergeHotel — MyConciergeHotel`
- `/hotel/.../chambres/suite-lalique` (**113 c**) →
  `Suite Lalique par Patrick Hellmann — Prince de Galles | MyConciergeHotel — … — MyConciergeHotel`

Preuve du mécanisme : sur la même fiche hôtel, `og:title` est correct (une seule
marque) — `Bulgari Hotel Paris — Palace Paris | MyConciergeHotel` — car l'OG
n'utilise pas le `title.template`. Donc le doublon est introduit par le template.

> Les classements / destinations / guides région **ne sont PAS touchés** (marque
> unique : `Palaces de France 2026 : la liste officielle des 33 hôtels — MyConciergeHotel`).

**Impact** : troncature SERP, marque répétée (gaspillage de pixels), titres
itinéraire/room à >100 c systématiquement coupés.
**Action** : retirer `| MyConciergeHotel` du champ `title` des pages
hôtel/room/itinéraire/lieu **ou** utiliser `title.absolute` / supprimer le suffixe
du template sur ces routes. Viser ≤ 60 caractères visibles.

#### P1-2 · Aucun cache CDN — `private, no-store` site-wide

**Toutes** les pages publiques renvoient le même en-tête, avec
`X-Vercel-Cache: MISS` systématique :

```
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
X-Vercel-Cache: MISS
```

Vérifié sur `/`, `/hotel/bulgari-hotel-paris`, `/classement/palaces-de-france-2026`,
`/destination/paris`, `/lieux/dubai/ain-dubai`, `/itineraire/...`. Donc **zéro
cache edge** sur ~2 219 fiches hôtel + 845 classements + 1 158 lieux + 2 492 hubs.

C'est la conséquence du CSP `script-src 'strict-dynamic' 'nonce-…'` qui force le
rendu dynamique par requête (nonce per-request). Chaque hit Googlebot = un render
dynamique à froid.

**Impact** : LCP (cible ≤ 2,5 s mobile — cf. `observability-perf.mdc`) dégradé,
budget de crawl gaspillé sur un grand catalogue, TTFB élevé.
**Action** : revoir « ISR via auth client island » (ADR-0007) — soit `s-maxage`
public pour les requêtes anonymes/crawlers, soit rendu statique du catalogue avec
injection de nonce au bord. À arbitrer avec l'équipe sécurité (le nonce
`strict-dynamic` est le coupable).

#### P1-3 · `Offer` + `priceValidUntil` dans le JSON-LD des fiches hôtel (gel Phase 6)

Sur `/hotel/bulgari-hotel-paris` (FR **et** EN), un des blocs `Event` (POI/event
voisin, source `datatourisme`) embarque un `Offer` complet :

```json
"@type":"Event","name":"Éternelle Notre-Dame",
"offers":{"@type":"Offer","availability":"https://schema.org/InStock",
  "priceCurrency":"EUR","priceValidUntil":"2026-12-31","price":"30.99",
  "url":"https://www.eternellenotredame.com/"}
```

Il s'agit du **prix de billet d'un événement tiers** (expérience VR Notre-Dame),
pas d'une offre de réservation hôtelière. Mais cela contredit la consigne
explicite « AUCUN `Offer`/`priceValidUntil` (booking = Phase 6 gelée) » et risque
une mauvaise attribution par Google (un prix « 30,99 € » sur une page d'hôtel-palace).

**Impact** : contradiction directive + risque de rich-result trompeur.
**Action** : retirer `offers` des nœuds `Event` embarqués (garder l'`Event` sans
prix) jusqu'à décision produit, **ou** confirmer que c'est intentionnel et
documenter l'exception (event ≠ booking hôtel).

#### P1-4 · `og:image` absent sur la home

`/` (FR) déclare `twitter:card = summary_large_image` mais **n'a pas** de
`og:image` :

```
og:title     : MyConciergeHotel — La sélection du Concierge…
og:image     : (absent)
twitter:card : summary_large_image
```

Les fiches hôtel et classements, eux, exposent bien une `og:image` Cloudinary
(`https://res.cloudinary.com/dvbjwh5wy/image/upload/f_jpg,q_auto,c_fill,g_auto,w_1…`).

**Impact** : aperçu social vide sur l'URL la plus partagée (réseaux, messageries,
certains agrégateurs).
**Action** : ajouter une `og:image` par défaut (1200×630) sur la metadata home.

#### P1-5 · Meta description EN sous-dimensionnée (parité FR/EN)

`/en/classement/palaces-de-france-2026` — meta description = **69 caractères** :

```
Discover France's 33 Atout France Palace hotels as of June 2, 2026.
```

vs FR (155 c) :

```
Découvrez les 33 Palaces distingués par Atout France au 2 juin 2026, les
nouveaux entrants, les retraits, et pourquoi 5 étoiles ne veut pas dire Palace.
```

`/en/classement/hotel-de-luxe-tokyo` = 110 c (correct mais court).
**Impact** : snippet SERP EN sous-exploité, parité éditoriale FR/EN incomplète.
**Action** : étendre les meta EN courtes vers 140-160 c (audit large recommandé
sur les classements EN).

---

### P2 — cosmétique / à surveiller

#### P2-1 · `robots.txt` : `Disallow` pointant des chemins qui n'existent pas

```
Disallow: /fr/reservation/   Disallow: /fr/compte/   Disallow: /fr/auth/
Disallow: /en/reservation/   Disallow: /en/compte/   Disallow: /en/auth/
```

Or la locale FR **n'a pas** de préfixe `/fr/` (home canonique = racine), le login
FR réel est `/compte/connexion`, et le compte EN réel est `/en/account`
(`/en/compte` fait un **301 → `/en/account`**). Donc ces `Disallow` sont des
**règles mortes** (ne matchent aucune URL réelle).

Pas de fuite réelle : les pages privées sont protégées par meta — vérifié :
`/compte/connexion` → `robots: noindex, nofollow` ; `/en/account` →
`noindex, nofollow` ; `/recherche` → `noindex`. Mais le `robots.txt` est
trompeur/obsolète.
**Action** : aligner sur les vrais chemins (`/compte/`, `/en/account`,
`/recherche`, `/reservation/`) ou s'appuyer uniquement sur le meta noindex.

#### P2-2 · `/selection/*` legacy → 404 (pas de redirection)

- `/guide/paris` → **308** → `/destination/paris` ✅ (legacy OK)
- `/selection/palaces-de-france-2026` → **404** ❌ (aucune redirection)
- `/selection` → 404

**Action** : si des URLs `/selection/*` ont déjà été indexées, ajouter un 301 vers
la cible `/classement/*` correspondante (vérifier dans GSC). Sinon, sans objet.

#### P2-3 · JSON-LD sans nonce CSP

Tous les blocs `<script type="application/ld+json">` sont émis **sans** attribut
`nonce` (déviation de `security-csp.mdc` qui impose `JsonLdScript` + nonce).
**Aucun impact SEO/rendu** : `application/ld+json` est un _data block_ non exécuté,
donc non bloqué par `script-src` — confirmé crawlable dans le HTML servi. À noter :
puisque le ld+json n'a de toute façon pas besoin du nonce, le coût « force-dynamic »
(cf. P1-2) ne lui apporte rien.
**Action** : conformer au pattern interne (faible priorité) ou documenter l'exemption.

#### P2-4 · hreflang — attribut `hrefLang` + mélange `fr-FR`/`en`

Le HTML servi rend `<link rel="alternate" hrefLang="fr-FR" …>` (camelCase) et
mélange une locale régionalisée (`fr-FR`) avec une générique (`en`). **Valide**
(attributs HTML insensibles à la casse ; Google parse `hreflang` quelle que soit
la casse), mais incohérent. Les triplets fr-FR / en / x-default sont **réciproques
et absolus** sur toutes les pages testées (x-default → version FR). ✅
**Action** : homogénéiser (`fr`/`en` ou `fr-FR`/`en-GB`). Cosmétique.

#### P2-5 · Référentiel sitemaps à mettre à jour (rooms, guides)

| Sous-sitemap      | Compté (prod) | Référentiel attendu | Note                                                     |
| ----------------- | ------------- | ------------------- | -------------------------------------------------------- |
| `hotels.xml`      | **2219**      | 2219                | ✅                                                       |
| `rankings.xml`    | **845**       | ~845                | ✅                                                       |
| `places.xml`      | **1158**      | ~1158               | ✅                                                       |
| `hubs.xml`        | **2492**      | ~2492               | ✅                                                       |
| `itineraries.xml` | **23**        | 23                  | ✅                                                       |
| `rooms.xml`       | **17**        | 3                   | ⚠ plus que prévu (sain, MAJ référentiel)                 |
| `guides.xml`      | **0**         | 0-vide              | ✅ (99 guides surfacés via `/destination` dans hubs.xml) |

`robots.txt` expose bien `Sitemap: https://myconciergehotel.com/sitemap.xml`, et le
`sitemap.xml` index liste les 7 sous-sitemaps avec `lastmod` 2026-06-23. ✅
**Action** : aligner le référentiel `rooms` (17, pas 3) ; confirmer que les 99
guides éditoriaux sont tous joignables (ils rendent sous `/destination/<slug>`).

---

## Points conformes vérifiés (à conserver)

- **404 réels, pas de soft-404** : `/hotel/zzz-inexistant`, `/classement/zzz-inexistant`
  → `HTTP/1.1 404`. ✅
- **Self-canonicals corrects** sur tous les types ; **room sub-page → self**
  (`…/chambres/suite-lalique` canonical = elle-même — Hard Rule 15). ✅
- **hreflang réciproques + absolus** (fr-FR / en / x-default), x-default → FR. ✅
- **JSON-LD riche et valide** :
  - Home : `TravelAgency` + `WebSite`/`SearchAction` + `FAQPage` + 2× `ItemList`(Hotel).
  - Hôtel : `Hotel`(+`Place`/`PostalAddress`/`GeoCoordinates`) + `BreadcrumbList` +
    `FAQPage` + POI (`Museum`/`Restaurant`/`TouristAttraction`) + `Brand`/`Organization`.
  - Classement : `BreadcrumbList` + `Article` + `ItemList`(Hotel+Rating+Geo+Speakable) + `FAQPage`.
  - Destination : `Place`/`AdministrativeArea` + `Article` + `BreadcrumbList` + `FAQPage`.
  - Lieu : `TouristAttraction` + `BreadcrumbList` + `FAQPage`.
  - Itinéraire : `Article` + `HowTo` + `ItemList`(Hotel) + `BreadcrumbList` + `FAQPage`.
- **`AggregateRating.bestRating = "5"` partout** (jamais "10" — Hard Rule 11). Le
  `Rating` présent = `starRating` de l'hôtel (5★), pas un avis fictif. ✅
- **noindex** sur `/compte/connexion`, `/en/account`, `/recherche`. ✅
- **En-têtes sécurité** : `Content-Security-Policy: … script-src 'self'
'nonce-…' 'strict-dynamic'`, `X-Frame-Options: DENY`. ✅
- **Titres localisés et distincts** (FR ≠ EN), aucune duplication inter-pages
  observée (hors marque, cf. P1-1).

---

## Benchmark vs `yonder.fr` (règle `competitor-benchmark-yonder.mdc`)

Comparaison sur le **type « classement / top hôtels »** (leur cœur SEO) :

| Critère                       | MCH `/classement/palaces-de-france-2026`                                                                                 | yonder `/les-tops/hotels/les-plus-beaux-hotels-du-luberon…`                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Blocs JSON-LD                 | **5**                                                                                                                    | 2                                                                           |
| Types structurés              | `TravelAgency`, `BreadcrumbList`, `Article`, **`ItemList`+`Hotel`+`Rating`+`GeoCoordinates`+`Speakable`**, **`FAQPage`** | `BreadcrumbList`, `Organization`+`WebSite`+`WebPage`+`NewsArticle`+`Person` |
| Entités hôtel dans le ranking | **oui** (Hotel + Rating + Geo par entrée)                                                                                | non                                                                         |
| FAQPage                       | **oui**                                                                                                                  | non                                                                         |
| Speakable (GEO/voice)         | **oui**                                                                                                                  | non                                                                         |
| hreflang                      | fr-FR / en / x-default                                                                                                   | 2 balises (FR-only)                                                         |
| `<title>`                     | propre (marque unique sur les classements)                                                                               | propre (54 c, sans marque)                                                  |

**Ce que MCH a en plus** : `ItemList` avec entités `Hotel` notées + géolocalisées,
`FAQPage`, `Speakable`, vraie internationalisation hreflang FR/EN, `Article` éditorial.
Confirme le constat de la règle (MCH ~10 blocs vs ~6 ; ici 5 vs 2).

**Ce qui manque à MCH (vs yonder)** :

- **Hygiène de `<title>`** sur hôtel/room/itinéraire/lieu : yonder ne duplique jamais
  la marque, MCH si (P1-1). Désavantage compétitif direct en SERP sur ces types.
- yonder utilise `NewsArticle` (éligible « Actualités/Top stories ») là où MCH met
  `Article` — différence mineure, mais à considérer pour les classements d'actualité.
- **Autorité / indexation** (non mesurable en lecture seule) : c'est le vrai écart
  identifié par la règle (yonder trône top 1-2, MCH absent du top-20). Aucune
  régression technique observée ici — l'écart est backlinks/historique, pas balisage.

**Ce qui manque à yonder (à exploiter)** : pas d'`ItemList`/`Hotel`/`FAQPage`/`Speakable`,
pas de parité EN. La supériorité machine de MCH est réelle et doit être convertie en
autorité (maillage + backlinks + soumission GSC — cf. Phase 5).

---

## Maillage / découvrabilité

- Les classements sont joignables via `/classements` (index) et exposés dans
  `rankings.xml` (845 entrées). Les guides région (`/destination/cote-d-azur`,
  `…/alpes`, `…/luberon`, etc.) sont dans `hubs.xml` et liés depuis `/destination`.
- Les lieux/POI sont dans `places.xml` (1 158) avec maillage hôtel ↔ lieu attendu
  (JSON-LD `TouristAttraction` confirmé sur `/lieux/dubai/ain-dubai`).
- **Non vérifiable en lecture seule HTML** (rendu nav client) : la présence des
  têtes d'acquisition dans le méga-menu / burger mobile. À valider via le
  `user-acceptance-loop` (browser MCP) lors d'une session avec navigateur — non
  disponible dans ce worker read-only/curl.

---

## Synthèse des actions recommandées

| #    | Priorité | Page(s)                          | Action                                                                                 |
| ---- | -------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| P1-1 | P1       | hôtel / room / itinéraire / lieu | Supprimer le double suffixe de marque dans `<title>` ; viser ≤ 60 c                    |
| P1-2 | P1       | toutes                           | Restaurer un cache edge (s-maxage anonyme / ISR) malgré le nonce strict-dynamic        |
| P1-3 | P1       | fiches hôtel (JSON-LD)           | Retirer `offers`/`priceValidUntil` des `Event` embarqués (ou documenter l'exception)   |
| P1-4 | P1       | home `/`                         | Ajouter une `og:image` par défaut (1200×630)                                           |
| P1-5 | P1       | classements EN                   | Étendre les meta descriptions EN courtes (69 c → 140-160 c)                            |
| P2-1 | P2       | `robots.txt`                     | Aligner les `Disallow` sur les vrais chemins (`/compte/`, `/en/account`, `/recherche`) |
| P2-2 | P2       | `/selection/*`                   | Ajouter 301 → `/classement/*` si historiquement indexé (sinon RAS)                     |
| P2-3 | P2       | JSON-LD                          | Conformer le nonce (faible priorité, aucun impact SEO)                                 |
| P2-4 | P2       | hreflang                         | Homogénéiser `fr-FR`/`en`                                                              |
| P2-5 | P2       | référentiel                      | MAJ rooms (17), confirmer joignabilité des 99 guides                                   |

**Conclusion** : socle d'indexation **sain et sans P0**, balisage structuré
**meilleur que la concurrence**. Corriger les 5 P1 (surtout titres dupliqués +
cache CDN + Offer event) pour passer de « bon » à « irréprochable ».
**Prêt prod : OUI avec réserves.**
