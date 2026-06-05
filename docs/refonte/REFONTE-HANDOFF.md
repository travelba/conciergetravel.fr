# Refonte front — note de reprise

> Sauvegarde de l'état au 2026-06-04. Direction : **OTA luxe éditorial**
> (charcoal `#1a1a1a` / off-white `#faf8f4` / or `#c9a96e`, titres serif).
> Branche : `feat/travelport-stays-phase6`.

## Où on en est

### Déjà livré (commité + pushé, en ligne sur la preview)

- **Kit `@mch/ui`** : Button (asChild), Input, Label, Select, Card, Dialog,
  Sheet, Badge, Skeleton, Toaster — token-driven.
- **Tokens** : ramp or `gold-50→900`, `--color-ring`, `shadow-xs/card/overlay`,
  `radius-2xl`, tokens motion. Focus `:focus-visible` unifié.
- **HotelCard unifié** (row/grid, slots) + migration directory & home grid.
- **Listing `/recherche`** migré sur `SearchHotelCard` (grille, monogramme).
- **Migration design-system amber→gold** : fiche hôtel + 11 composants, tunnel.
- **Hero accueil refondu** (commit `cdd6521`) : pleine hauteur, dégradé
  directionnel, fondu vers la page, filet doré, type display, chips.

### Maquettes validées (à coder)

Voir `docs/refonte/mockups/` :

- `refonte-home.png` — accueil
- `refonte-fiche.png` — fiche hôtel
- `refonte-recherche.png` — recherche / listing
- `refonte-reservation.png` — tunnel réservation

## La proposition, page par page

### 1. Accueil — parcours en 3 actes

Hero (fait ✓) + **barre de recherche condensée sticky** au scroll.
Acte I Découvrir (mot du concierge → ouvertures bande → fiches en **mosaïque
éditoriale** tailles variées). Acte II S'inspirer (occasions + **bande
destinations full-bleed**). Acte III Appartenir (classements → conseils →
**bande Club premium** → FAQ AEO accordéon). JSON-LD conservés.

### 2. Fiche hôtel — monolithe → fiche produit + commerce

**Découpe RSC** du monolithe (~2070 l). Galerie hero immersive + lightbox.
**En-tête commerce** (étoiles/palace, note Google, « à partir de X €/nuit »,
CTA). **Sous-nav sticky** + **widget réservation collant** (rail droit desktop /
barre fixe bas mobile). **Module chambres productisé** (photos, plans tarifaires,
par nuit + total, sélection → tunnel). Dispo **Travelport dans `Suspense`**.

### 3. Recherche — vraie expérience OTA

**Vue scindée liste + carte collante**. Rail de facettes (étoiles, palace,
thèmes, budget). Tri, compteur, **chips de filtres actifs**, pagination/skeletons.
**Contrat de recherche unifié** (destination + dates + voyageurs) câblé partout.

### 4. Réservation — transparent et rassurant

**Stepper persistant** (`BookingProgress`). **Récap collant `OrderSummary`**
(lignes prix + taxes + total). Étape voyageur (**validation inline**, prefill).
Récap (édition + **compte à rebours de hold**). Paiement iframe **3DS**.
Confirmation (calendrier + gérer). **Récupération d'offre expirée**.

## Dépendances / contraintes

- **Visuel pur** (mosaïque, découpe fiche, vue listing, stepper) = faisable
  **maintenant**, sans data.
- **Prix / dispo / taxes** = **gatés par le pipeline Offer (Phase 6, ADR-0024)**
  - clés env. On pose les emplacements, on branche ensuite. Prix des maquettes
    = **illustratifs**.
- **Carte** listing = lib + coords + ajustement CSP.

## ⚠️ Recherche cassée sur la PREVIEW (pas un bug code)

Les variables Algolia ne sont pas scopées au Preview de cette branche :

- `NEXT_PUBLIC_ALGOLIA_APP_ID` → Development + **Production** seulement
- `ALGOLIA_INDEX_PREFIX` → Development + **Production** seulement
- `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` → Dev + Prod + Preview épinglé à une **autre**
  branche (`feat/golden-template-airelles-fiche`)

→ Sur le Preview de `feat/travelport-stays-phase6`, `APP_ID` absent →
`hotels-catalog.ts` ligne 67 renvoie `[]` → autocomplete vide + « aucun résultat ».
**Prod OK** (`myconciergehotel.com/api/search/suggest?q=paris` renvoie de vrais
hôtels). **Fix** (au choix de l'utilisateur, non lancé) : copier les 3 variables
vers le scope Preview via la CLI Vercel puis redéployer (search-key publique par
design, sans risque).

## Prochaine étape (en attente de la décision utilisateur)

Choisir la **première page à coder** : accueil / fiche / recherche / réservation.
La direction visuelle des maquettes a été présentée ; reprendre sur ce choix.
