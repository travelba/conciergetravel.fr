# ADR 0016 — Pages catégories non-Palace : ouvrir au-delà du strictement Palace

- Status: accepted
- Date: 2026-05-20
- Refs: ADR-0014 (architecture menu v2), skill `seo-technical` §Maillage, skill `content-modeling`, rule `seo-geo`, rule `hotel-detail-page`

## Décision

Étendre [`apps/web/src/server/hotels/editorial-categories.ts`](../../apps/web/src/server/hotels/editorial-categories.ts) avec **7 nouvelles `EditorialCategory`** correspondant aux types non-palace déjà présents dans la taxonomie `HOTEL_TYPES` ([`scripts/editorial-pilot/src/rankings/axes.ts`](../../scripts/editorial-pilot/src/rankings/axes.ts)).

| Slug               | Label FR         | Label EN        | Match prédicat                      |
| ------------------ | ---------------- | --------------- | ----------------------------------- | --- | -------------------------------------------------------- |
| `hotels-5-etoiles` | Hôtels 5 étoiles | 5-Star Hotels   | `h.stars === 5 && !h.isPalace`      |
| `hotels-4-etoiles` | Hôtels 4 étoiles | 4-Star Hotels   | `h.stars === 4`                     |
| `boutique-hotels`  | Boutique-hôtels  | Boutique Hotels | `h.tags?.includes('boutique-hotel') |     | (h.stars <= 5 && h.totalRooms <= 40)`                    |
| `chateaux-hotels`  | Châteaux-hôtels  | Château Hotels  | `h.tags?.includes('chateau')        |     | /château/i.test(h.name)`                                 |
| `chalets-luxe`     | Chalets de luxe  | Luxury Chalets  | `h.tags?.includes('chalet')         |     | (/chalet/i.test(h.name) && MOUNTAIN_CITIES.has(h.city))` |
| `villas`           | Villas privées   | Private Villas  | `h.tags?.includes('villa')          |     | /villa/i.test(h.name)`                                   |
| `maisons-hotes`    | Maisons d'hôtes  | Guesthouses     | `h.tags?.includes('maison-hotes')`  |

(Les 5 catégories Palace existantes — `palaces-france`, `palaces-paris`, `palaces-montagne`, `palaces-bord-de-mer`, `palaces-vignobles` — restent inchangées.)

## Contexte

Le catalogue éditorial actuel contient ≈ 106 hôtels publiés au moment de l'audit du 20 mai 2026. Les 5 catégories existantes ne ciblent que les Palaces Atout France (≈ 30 propriétés). Les ≈ 76 autres hôtels d'exception (5★ non-Palace, 4★ premium, boutique-hôtels, châteaux, chalets, villas, maisons d'hôtes) ne disposent d'**aucune page catégorie** propre, alors qu'ils sont déjà classés selon ces types via :

- `HOTEL_TYPES` enum dans `axes.ts` (12 types canoniques, dont les 7 visés)
- `editorial_rankings.axes.types[]` (JSONB column, déjà rempli)
- Les pages `/classements/type/[valeur]` (route matrice existante)

Le brief utilisateur du 20 mai 2026 (cf. décision plan v2) valide explicitement l'ouverture : « Ouvrir le menu à tous les types — capter plus de requêtes, marque devient "concierge des hôtels d'exception". »

## Alternatives considérées

**Alternative A — Garder les pages catégories strictement Palace.** Rejetée. Préserve une cohérence narrative étroite mais coûte 7 pages indexables à fort potentiel (chaque type a un volume de recherche Google français propre : "boutique-hôtel France" ≈ 1 800 recherches/mois, "château-hôtel France" ≈ 2 400, "chalet luxe France" ≈ 1 100).

**Alternative B — Une seule page `/categorie/tous-types` listant les 7 types.** Rejetée. Une page balayage ne capture aucune intention spécifique. Les LLM (AEO) citent mieux des pages mono-type que des index hybrides.

**Alternative C — Pages `/types/[type-slug]` distinctes de `/categorie/[category-slug]`.** Rejetée. Crée une nouvelle hiérarchie URL parallèle. La route `/categorie/[slug]` existe, est déjà tracée dans `routing.ts`, et son handler est générique — étendre la liste des catégories prises en charge est triviale (vs créer une nouvelle hiérarchie).

## Conséquences

### Positives

- **+7 pages indexables** à fort jus SEO sur des requêtes informationnelles : "boutique-hôtel France", "château-hôtel", "chalet luxe Alpes", "villa privée Côte d'Azur", "maison d'hôtes France", etc.
- **Ouverture de la marque** : "MyConciergeHotel" devient explicitement le concierge des **hôtels d'exception** (pas seulement Palaces). Le catalogue déjà publié couvre ces types.
- **Aucune nouvelle route à créer** : la route `/categorie/[categorySlug]` est déjà rendue par [`page.tsx`](../../apps/web/src/app/[locale]/categorie/[categorySlug]/page.tsx). Seul `EDITORIAL_CATEGORIES` doit être étendu.
- **Tests existants restent verts** : le test `findCategory()` itère sur le tableau exporté ; ajouter des entrées ne casse rien.
- **Maillage interne** : les 7 nouvelles pages peuvent apparaître dans le mega-menu "Palaces & Hôtels > Par type" (ADR-0014) et dans le footer fat (5 colonnes).

### Négatives

- **Risque de chevauchement avec `/classements/type/[valeur]`** : une page `/categorie/boutique-hotels` et `/classements/type/boutique-hotel` ciblent des intents proches. Mitigé par :
  - La page catégorie = listing complet (toutes les adresses, pas un ranking) avec subtitle/intro éditoriale.
  - La page classement = curation éditoriale (top X, scénarisée par le combinator).
  - Canonical strict de chacune vers elle-même + `alternates.languages` (skill `seo-technical` §Anti-cannibalisation).
- **Qualité des prédicats `match`** : `tags` et `totalRooms` sont les sources préférées ; les fallbacks regex (`/château/i.test(h.name)`) sont une heuristique transitoire en attendant que Payload remplisse les tags pour tous les hôtels. À itérer.
- **Vérification empty-state** : une catégorie sans hôtel publié doit retourner `{ robots: { index: false, follow: false } }` (idem `nextjs-app-router.mdc`). Mitigé par le check existant dans `page.tsx` qui retourne `notFound()` si `filterCategory()` est vide.

## Plan d'exécution

PR-4 (du plan parent) :

1. Étendre `EDITORIAL_CATEGORIES` dans [`editorial-categories.ts`](../../apps/web/src/server/hotels/editorial-categories.ts) avec les 7 nouvelles entrées (slug, labels FR/EN, h1 FR/EN, metaTitle/Desc, subtitle, match).
2. Vérifier que [`page.tsx`](../../apps/web/src/app/[locale]/categorie/[categorySlug]/page.tsx) gère correctement le cas `filterCategory()` vide (retourner `notFound()` ou `robots: noindex` selon le contexte — état actuel à vérifier).
3. Ajouter dans [`apps/web/src/components/layout/nav-data.ts`](../../apps/web/src/components/layout/nav-data.ts) un export `HOTEL_TYPE_CATEGORY_ENTRIES` listant les 7 nouvelles entrées (slug + label FR/EN). Cet export alimente le mega-menu "Palaces & Hôtels > Par type" (ADR-0014).
4. Ajouter un test unitaire `editorial-categories.test.ts` qui vérifie que chaque slug est unique, que chaque `match` est total (ne lance pas d'exception sur une `PublishedHotelIndexCard` quelconque) et que chaque catégorie a bien des labels FR + EN non vides.
5. Vérifier que le sitemap (sub-sitemap `hubs.xml`) émet bien les 7 nouvelles URLs avec `lastmod` correspondant à la dernière mise à jour du catalogue.

## Notes

- Les 5 catégories Palace existantes restent prioritaires éditorialement (le menu "Par distinction" est en colonne 1 du mega-menu, "Par type" en colonne 2).
- Les prédicats `match` peuvent évoluer sans casser les URLs (les slugs sont stables). Si demain on enrichit `PublishedHotelIndexCard` avec un champ `tags: string[]` (Payload), les fallbacks regex disparaissent au profit de `h.tags.includes('boutique-hotel')`.
- Pour les types `ecolodge` et `insolite` (présents dans `HOTEL_TYPES` mais absents de cette ADR) : reportés à une V2 du catalogue. Les volumes de recherche Google sont marginaux par rapport aux 7 retenus, et les prédicats `match` nécessitent une typologie Payload qui n'existe pas encore.
- La page `/categorie/[slug]` reste en `revalidate = 3600` (alignée hôtel detail, ADR-0007). Le contenu change peu (liste de hôtels), 1 h est OK.
