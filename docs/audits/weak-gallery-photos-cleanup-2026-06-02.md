# Audit — Nettoyage des photos de galerie faibles (2026-06-02)

## Contexte

Avant d'investir dans le backfill `width/height` (Hard Rule 16) et le
sourcing catégoriel, audit de la qualité du corpus photo (~22 k photos).

**Finding** : le corpus est bien plus sain que craint. Pas de « milliers
de mauvaises photos ». Distribution `quality_score` : ~85 % à 8+/10,
sources légitimes (Google Places, Wikimedia Commons, press kits). Seules
**109 photos** étaient réellement faibles (`quality_score <= 5`).

## Décision

Suppression **sûre uniquement** : on retire une photo faible
(`quality_score <= 5`) seulement si :

1. elle n'est **pas** le hero (`public_id != hotels.hero_image`) ;
2. l'hôtel **reste à ≥ 10 photos** après suppression (seuil
   d'indexabilité — sous 10 la fiche passe `noindex, follow`).

Résultat : **57 photos supprimées** sur **51 hôtels publiés**. Aucun
hôtel poussé sous le seuil. Garde-fou : les entrées sans `quality_score`
(`coalesce(..., 99)`) ne sont jamais retirées.

Les **51 photos faibles restantes** (sur 37 hôtels déjà minces, < 10
photos après retrait hypothétique) sont **conservées** : les retirer
dégraderait l'indexabilité. Elles relèvent du chantier _sourcing /
remplacement_ (Phase 2), pas du nettoyage.

## Réversibilité

Suppression au niveau des entrées du JSONB `hotels.gallery_images`
uniquement. **Les assets Cloudinary ne sont pas supprimés** — ils restent
disponibles (`public_id` inchangés) et peuvent être ré-insérés.

## Photos retirées (57)

Quasi exclusivement des `commons-*` (Wikimedia Commons — qualité plus
variable que Google Places / press kits), catégories majoritaires
`exterior` / `lobby` / `view` / `detail` / `other`.

| Hôtel (slug)                           | public_id  | note | catégorie |
| -------------------------------------- | ---------- | ---- | --------- |
| amberley-castle                        | commons-2  | 5    | exterior  |
| anantara-siam-bangkok-hotel            | commons-7  | 5    | lobby     |
| anantara-siam-bangkok-hotel            | commons-11 | 4    | dining    |
| belmond-hotel-das-cataratas            | commons-6  | 5    | exterior  |
| belmond-reid-s-palace                  | commons-8  | 5    | exterior  |
| boutique-hotel-alhambra                | commons-10 | 5    | exterior  |
| copacabana-palace                      | commons-6  | 5    | exterior  |
| el-palace-hotel                        | commons-8  | 5    | exterior  |
| fairmont-hotel-vier-jahreszeiten       | commons-2  | 5    | exterior  |
| fairmont-le-chateau-frontenac          | commons-5  | 5    | view      |
| fairmont-le-manoir-richelieu           | commons-8  | 5    | view      |
| fairmont-le-manoir-richelieu           | commons-9  | 5    | lobby     |
| fairmont-palliser-hotel                | commons-8  | 5    | lobby     |
| fairmont-singapore                     | commons-1  | 5    | dining    |
| fouquet-s-paris                        | commons-1  | 5    | room      |
| four-seasons-hotel-buenos-aires        | commons-5  | 5    | view      |
| four-seasons-hotel-miami               | commons-9  | 5    | exterior  |
| four-seasons-hotel-westlake-village    | commons-4  | 5    | lobby     |
| grand-hotel-kempinski-riga             | commons-1  | 5    | view      |
| hotel-barriere-le-fouquet-s-paris      | commons-1  | 5    | room      |
| hotel-barriere-le-majestic             | commons-5  | 5    | exterior  |
| hotel-cafe-royal                       | commons-5  | 5    | lobby     |
| hotel-das-cataratas                    | commons-6  | 5    | exterior  |
| hotel-du-palais                        | commons-9  | 5    | exterior  |
| hotel-gajoen-tokyo                     | commons-6  | 5    | exterior  |
| hotel-hermitage-monte-carlo            | commons-5  | 5    | exterior  |
| hotel-metropole-monte-carlo            | commons-1  | 5    | exterior  |
| hotel-royal                            | commons-4  | 5    | exterior  |
| hotel-sacher-salzburg                  | commons-12 | 5    | room      |
| hotel-sacher-salzburg                  | commons-10 | 5    | lobby     |
| le-fouquet-s-paris                     | commons-1  | 5    | room      |
| mandarin-oriental-bodrum               | commons-1  | 5    | room      |
| mandarin-oriental-jakarta              | commons-5  | 5    | view      |
| mandarin-oriental-singapore            | commons-4  | 5    | exterior  |
| nobu-hotel-ibiza-bay                   | commons-2  | 5    | exterior  |
| nobu-hotel-marrakech                   | commons-2  | 5    | exterior  |
| orient-express-la-minerva              | commons-2  | 5    | other     |
| palazzo-garzoni                        | commons-7  | 5    | exterior  |
| pale-hall                              | commons-9  | 5    | exterior  |
| pera-palace                            | commons-1  | 5    | exterior  |
| pera-palace                            | commons-5  | 5    | other     |
| prestonfield-house                     | commons-3  | 5    | detail    |
| raffles-hotel-le-royal                 | commons-2  | 5    | exterior  |
| rome-cavalieri                         | commons-7  | 5    | detail    |
| rome-cavalieri                         | commons-11 | 5    | detail    |
| st-pancras-renaissance-london-hotel    | commons-3  | 5    | exterior  |
| st-pancras-renaissance-london-hotel    | commons-8  | 5    | exterior  |
| swissotel-istanbul                     | commons-1  | 5    | exterior  |
| the-carlyle-a-rosewood-hotel           | commons-7  | 5    | room      |
| the-hotel-chelsea                      | commons-5  | 5    | other     |
| the-metcalfe-hotel                     | places-3   | 5    | pool      |
| the-peninsula-bangkok                  | commons-3  | 5    | exterior  |
| the-peninsula-chicago                  | commons-6  | 5    | exterior  |
| the-ritz-carlton-jakarta-pacific-place | commons-1  | 5    | other     |
| the-tokyo-station-hotel                | commons-3  | 4    | lobby     |
| the-zetter-hotel                       | commons-3  | 5    | other     |
| villa-crespi                           | commons-4  | 5    | exterior  |

## Suite

- **51 photos faibles** restantes sur 37 hôtels minces → chantier
  sourcing (Google Places + Tavily extract du site officiel) pour
  _remplacer_, pas supprimer.
- Prochaine étape photo : backfill `width`/`height` via Cloudinary
  admin API (Hard Rule 16 — JSON-LD `ImageObject`).
