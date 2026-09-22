# ADR 0034 — Modèle de ciblage requêtes par gabarit (v2 greenfield)

- Status: accepted
- Date: 2026-07-07
- Décision PO (2026-07-07) — remplace la logique « héritage v1 » de l'ADR-0008
  pour `apps/web-v2`. Refs: CDC v2 §6, `docs/v2/url-mapping-v1-v2.md`,
  skill `booking-parity-ux`, rule `dataforseo-content-grounding.mdc`.

## Décision

Le projet v2 repart **sans dette d'indexation v1**. Chaque gabarit possède
**une famille de requêtes exclusive** — c'est le contrat SEO du site. Aucune
page ne doit cibler la famille d'un autre gabarit (anti-cannibalisation).

| Gabarit                    | Route                                   | Famille de requêtes ciblée                                |
| -------------------------- | --------------------------------------- | --------------------------------------------------------- |
| **Fiche hôtel**            | `/hotel/[slug]`                         | `Hôtel {Nom}` · `Hôtel {Nom} tarif` · `Hôtel {Nom} promo` |
| **Annuaire ville**         | `/hotels/[pays]/[zone]` (zone = ville)  | `Hôtel {Ville}`                                           |
| **Annuaire région**        | `/hotels/[pays]/[zone]` (zone = région) | `Hôtel {Région}`                                          |
| **Annuaire pays**          | `/hotels/[pays]`                        | `Hôtel {Pays}`                                            |
| **Classement ville**       | `/classement/[slug]`                    | `Meilleur hôtel de luxe à {Ville}`                        |
| **Classement pays 5★**     | `/classement/[slug]`                    | `Meilleur hôtel 5 étoiles en {Pays}`                      |
| **Classement pays beauté** | `/classement/[slug]`                    | `Les plus beaux hôtels {Pays}`                            |

## Implications structurantes

### 1. La fiche capte le navigationnel + tarif + promo

- **Title** : `Hôtel {Nom} {Ville} : tarifs, promos & avis`.
- **H1** : `Hôtel {Nom}` (le mot « hôtel » doit apparaître — la requête
  cible est `Hôtel {Nom}`, pas `{Nom}` seul).
- **Sections ancrées obligatoires** : `#tarifs` (H2 `Tarifs {Nom}` +
  tableau chambres/prix) et `#promos` (H2 `Promos & offres {Nom}` + bloc
  membre −20 %). Ces deux blocs existent pour capter `Hôtel {Nom} tarif`
  et `Hôtel {Nom} promo` — ils ne sont **pas** optionnels.
- L'URL reste **courte** (`/hotel/le-meurice`) : la requête cible étant
  navigationnelle (le nom de l'hôtel), la profondeur géographique dans
  l'URL n'apporte rien — la géo appartient à l'annuaire (famille 2).

### 2. L'annuaire possède les requêtes géographiques

- `/hotels/[pays]` → title/H1 sur `Hôtel {Pays}` (ex. « Hôtel France : … »).
- `/hotels/[pays]/[zone]` → le segment 2 accepte **ville OU région**
  (`/hotels/france/paris`, `/hotels/france/provence`). Title/H1 sur
  `Hôtel {Ville}` / `Hôtel {Région}`.
- **Conséquence anti-cannibalisation** : `/destination/[slug]` ne doit PAS
  cibler `Hôtel {Ville}` — il garde les requêtes informationnelles
  (`que faire à {ville}`, guide) et pointe canoniquement l'intention
  hôtelière vers `/hotels/[pays]/[ville]`.
- `/recherche` reste **noindex sur états filtrés** — il ne cible rien.

### 3. Le classement possède les superlatifs

Trois patrons de slug + title canoniques :

| Patron      | Slug                              | Title                                |
| ----------- | --------------------------------- | ------------------------------------ |
| Luxe ville  | `meilleur-hotel-luxe-{ville}`     | `Meilleur hôtel de luxe à {Ville}`   |
| 5★ pays     | `meilleur-hotel-5-etoiles-{pays}` | `Meilleur hôtel 5 étoiles en {Pays}` |
| Beauté pays | `plus-beaux-hotels-{pays}`        | `Les plus beaux hôtels {Pays}`       |

Les fiches et l'annuaire ne doivent **jamais** utiliser « meilleur » /
« plus beaux » dans leur title/H1 — ce lexique appartient aux classements.

### 4. Source de vérité code

Les templates title/H1/meta vivent dans
`apps/web-v2/src/lib/seo/keyword-templates.ts` — **un seul module**, importé
par tous les `generateMetadata`. Interdiction de hard-coder un title dans
une page.

### 5. Validation DataForSEO (règle PO 2026-06-25)

Chaque famille est un _patron_ ; les libellés définitifs par entité
(volumes, variantes `hôtel de luxe {ville}` vs `meilleurs hôtels {ville}`)
sont validés par `groundKeywords`/`groundHotel` avant génération de contenu.
Le patron fixe la **structure**, DataForSEO fixe le **phrasé gagnant**.

## Alternatives considérées

- **URL fiche profonde** `/hotels/[pays]/[ville]/[slug]` : rejetée — la
  famille de requêtes de la fiche est navigationnelle (`Hôtel {Nom}`), la
  géo dans l'URL dupliquerait la famille de l'annuaire sans gain, et
  Booking/Hotels.com rankent avec des URLs courtes. La hiérarchie géo est
  exprimée par le breadcrumb + `BreadcrumbList` JSON-LD + le maillage
  annuaire → fiche.
- **Un seul gabarit géo** (fusion annuaire + classement) : rejetée — les
  intentions `Hôtel {Ville}` (transactionnelle liste) et
  `Meilleur hôtel de luxe à {Ville}` (comparative éditoriale) ont des SERP
  différentes ; deux gabarits distincts évitent la dilution.

## Conséquences

- `generateMetadata` obligatoire sur fiche, annuaire (3 niveaux),
  classement — branché sur `keyword-templates.ts`.
- Ajout du niveau **région** dans l'annuaire (segment `[zone]` partagé).
- Breadcrumb visible + `BreadcrumbList` JSON-LD sur la fiche
  (Accueil → Pays → Ville → Fiche).
- `docs/v2/url-mapping-v1-v2.md` et la matrice de parité mis à jour.
- Le gate QA de bascule (CDC §QG-3) vérifie que chaque gabarit émet le
  title de SA famille et pas celui d'un autre.
