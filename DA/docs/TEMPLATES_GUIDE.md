# Guide d'utilisation des templates — MyConciergeHotel

Deux templates réutilisables, fidèles à la home (crème, taupe `#8C7B5A`, EB Garamond × Outfit, concierge bordeaux), nativement optimisés SEO/GEO. À dupliquer pour chaque nouvelle page.

- `template-hotel.html` → une fiche par hôtel / palace
- `template-guide.html` → un guide par ville / destination

---

## Règle d'or SEO / GEO (priorité absolue)

> Le mot-clé principal vit dans le `<h1>` et les `<h2>`. La voix éditoriale du Concierge vit dans les eyebrows, chapôs et descriptions — **elle ne remplace jamais un mot-clé dans un titre.**

- 1 seul `<h1>` par page.
- Hiérarchie `<h2>` > `<h3>` stricte, sans saut de niveau.
- Chaque image a un `alt` descriptif (nom de la maison + sujet).
- JSON-LD à valider sur le [Rich Results Test](https://search.google.com/test/rich-results) après remplacement.
- Photos réelles de luxe uniquement (jamais d'illustration / aquarelle).

---

## Méthode de remplacement (3 façons)

1. **Manuel / Cursor** : rechercher-remplacer chaque jeton `{{...}}`.
2. **Cursor (prompt)** : « Duplique `template-hotel.html`, renomme-le `hotels/france/cannes/hotel-martinez.html`, et remplace tous les jetons {{...}} avec les données ci-dessous : … » (coller le tableau de valeurs).
3. **Script** : un simple `sed`/JS qui mappe un objet de données sur les jetons (voir fin de doc).

Après remplacement : **vérifier qu'il ne reste aucun `{{` dans le fichier** (`grep "{{" mapage.html`).

---

## Template 1 — Fiche hôtel (`template-hotel.html`)

### En-tête & SEO

| Jeton                    | Description                                                      | Exemple                   |
| ------------------------ | ---------------------------------------------------------------- | ------------------------- |
| `{{HOTEL_NOM}}`          | Nom exact de la maison                                           | Hôtel Martinez            |
| `{{VILLE}}`              | Ville                                                            | Cannes                    |
| `{{VILLE_SLUG}}`         | Ville en slug URL                                                | cannes                    |
| `{{PAYS}}`               | Pays affiché                                                     | France                    |
| `{{PAYS_SLUG}}`          | Pays en slug URL                                                 | france                    |
| `{{PAYS_ISO}}`           | Code pays ISO (schema)                                           | FR                        |
| `{{SLUG_HOTEL}}`         | Slug de l'hôtel (URL)                                            | hotel-martinez            |
| `{{TYPE}}`               | Catégorie                                                        | Palace / Hôtel            |
| `{{ETOILES}}`            | Nombre d'étoiles (chiffre)                                       | 5                         |
| `{{ETOILES_SYMBOLES}}`   | Étoiles en symboles                                              | ★★★★★                     |
| `{{ACCROCHE_LIEU}}`      | Accroche de localisation                                         | face à la Croisette       |
| `{{ARRONDISSEMENT}}`     | Quartier / arrondissement                                        | Boulevard de la Croisette |
| `{{DISTINCTION}}`        | Label distinction                                                | Distinction Palace        |
| `{{META_DESCRIPTION}}`   | Meta description 150-160 car. (mot-clé + meilleur tarif garanti) | —                         |
| `{{OG_DESCRIPTION}}`     | Description Open Graph (≈ 1 phrase)                              | —                         |
| `{{SCHEMA_DESCRIPTION}}` | Description factuelle pour le JSON-LD                            | —                         |

### Adresse & géo (JSON-LD)

| Jeton             | Exemple                      |
| ----------------- | ---------------------------- |
| `{{ADRESSE_RUE}}` | 73 Boulevard de la Croisette |
| `{{CODE_POSTAL}}` | 06400                        |
| `{{LATITUDE}}`    | 43.5500                      |
| `{{LONGITUDE}}`   | 7.0220                       |

### Note & avis

| Jeton            | Exemple                          |
| ---------------- | -------------------------------- |
| `{{NOTE}}`       | 9.3 (format point, pour JSON-LD) |
| `{{NOTE_FR}}`    | 9,3 (format virgule, affichage)  |
| `{{NOTE_LABEL}}` | Exceptionnel                     |
| `{{NB_AVIS}}`    | 1 204                            |
| `{{NB_PHOTOS}}`  | 42                               |

### Images (fichiers dans `assets/img/`)

| Jeton               | Rôle                           | Exemple        |
| ------------------- | ------------------------------ | -------------- |
| `{{IMG_FACADE}}`    | Façade (image principale + OG) | htl_facade.jpg |
| `{{IMG_SUITE}}`     | Suite (vignette)               | htl_suite.jpg  |
| `{{IMG_SUITE_ALT}}` | Précision alt de la suite      | vue mer        |
| `{{IMG_SPA}}`       | Spa (vignette)                 | htl_spa.jpg    |
| `{{IMG_RESTO}}`     | Restaurant (vignette)          | htl_resto.jpg  |

### Équipements JSON-LD (4) — amenityFeature

`{{AMENITY_1}}` … `{{AMENITY_4}}` — équipements factuels pour le schema (ex. Spa, Restaurant étoilé, Plage privée, Conciergerie 24h/24).

### Atouts express (4)

`{{ATOUT_1}}` … `{{ATOUT_4}}` — ex. « Vue mer panoramique », « Plage privée », « Spa L.RAPHAEL », « Table étoilée ».

### Comparateur de prix

| Jeton                     | Exemple                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `{{PRIX_NOUS}}`           | 690 (notre tarif, sans espace)                                |
| `{{PRIX_OFFICIEL}}`       | 720                                                           |
| `{{PRIX_BOOKING}}`        | 735                                                           |
| `{{PRIX_EXPEDIA}}`        | 748                                                           |
| `{{AVANTAGE_INCLUS}}`     | petit-déjeuner offert (minuscule, dans le comparateur)        |
| `{{AVANTAGE_INCLUS_CAP}}` | Petit-déjeuner offert pour deux (capitalisé, liste avantages) |
| `{{CREDIT_HOTEL}}`        | 100                                                           |

### Le mot du Concierge (voix éditoriale)

`{{PROSE_1}}`, `{{PROSE_2}}` — deux paragraphes éditoriaux (atmosphère + ce que change le concierge).

### Chambres & suites (3 catégories)

Pour chaque `N` ∈ {1,2,3} : `{{ROOMN_IMG}}`, `{{ROOMN_NOM}}` (h3), `{{ROOMN_DESC}}`, `{{ROOMN_TAG1}}`, `{{ROOMN_TAG2}}`, `{{ROOMN_PRIX}}`.

### Équipements & services (6 cartes)

Pour chaque `N` ∈ {1..6} : `{{EQUIPN_TITRE}}`, `{{EQUIPN_DESC}}`.

### Localisation

`{{ACCES_PROSE}}` — paragraphe accès (transports, distances, aéroport).

### Avis (3)

Pour chaque `N` ∈ {1,2,3} : `{{AVISN_NOTE}}`, `{{AVISN_AUTEUR}}`, `{{AVISN_TEXTE}}`.

### FAQ (3) — synchroniser head ↔ section

`{{FAQ_Q1}}`/`{{FAQ_R1}}`, `{{FAQ_Q2}}`/`{{FAQ_R2}}`, `{{FAQ_Q3}}`/`{{FAQ_R3}}`.
**Important :** ces jetons apparaissent DEUX fois (dans le JSON-LD `FAQPage` du `<head>` ET dans la section `#faq`). Les deux doivent rester identiques.

---

## Template 2 — Guide ville (`template-guide.html`)

### En-tête & SEO

| Jeton                    | Description                            | Exemple    |
| ------------------------ | -------------------------------------- | ---------- |
| `{{VILLE}}`              | Ville / destination                    | Cannes     |
| `{{VILLE_SLUG}}`         | Slug URL                               | cannes     |
| `{{PAYS_ISO}}`           | Code pays ISO                          | FR         |
| `{{META_DESCRIPTION}}`   | Meta description 150-160 car.          | —          |
| `{{OG_DESCRIPTION}}`     | Description Open Graph                 | —          |
| `{{SCHEMA_DESCRIPTION}}` | Description JSON-LD TouristDestination | —          |
| `{{DATE_PUBLICATION}}`   | Date ISO publication                   | 2026-06-07 |
| `{{DATE_MODIFICATION}}`  | Date ISO dernière MAJ                  | 2026-06-07 |

### Hero & intro

| Jeton              | Exemple                               |
| ------------------ | ------------------------------------- |
| `{{IMG_HERO}}`     | hero.jpg (réelle, haute qualité)      |
| `{{IMG_HERO_ALT}}` | alt descriptif du hero                |
| `{{INTRO_LEDE}}`   | chapô éditorial (réponse directe GEO) |

### Où séjourner (4 maisons)

Pour chaque `N` ∈ {1..4} : `{{HOTELN_URL}}` (lien fiche), `{{HOTELN_IMG}}`, `{{HOTELN_NOM}}` (h3), `{{HOTELN_QUARTIER}}`.

- `{{SEJOUR_CHAPO}}` (chapô de section).

### Quartiers (4)

`{{QUARTIERS_CHAPO}}` + pour chaque `N` ∈ {1..4} : `{{QUARTIERN_NOM}}` (h3), `{{QUARTIERN_DESC}}`.

### À ne pas manquer (2 tuiles photo)

`{{INCONTOURNABLES_CHAPO}}` + pour chaque `N` ∈ {1,2} : `{{TILEN_IMG}}`, `{{TILEN_ALT}}`, `{{TILEN_TITRE}}` (h3), `{{TILEN_DESC}}`.

### La table (2 tuiles photo)

`{{TABLE_CHAPO}}` + pour chaque `N` ∈ {1,2} : `{{TABLEN_IMG}}`, `{{TABLEN_ALT}}`, `{{TABLEN_TITRE}}` (h3), `{{TABLEN_DESC}}`.

### Bandeau Concierge

`{{CONCIERGE_TITRE}}` (h2), `{{CONCIERGE_PROSE}}`.

---

## Conventions d'URL (rappel architecture SEO)

- Fiche hôtel : `/hotels/{pays}/{ville}/{slug-hotel}` — ex. `/hotels/france/cannes/hotel-martinez`
- Guide ville : `/guide-voyage-{ville}` — ex. `/guide-voyage-cannes`

Penser à **relier** : chaque guide ville lie vers les fiches hôtel de la ville (section « Où séjourner »), et chaque fiche hôtel peut lier vers le guide de sa ville (maillage interne).

---

## Checklist pré-mise en ligne (par page)

- [ ] Aucun `{{...}}` résiduel (`grep "{{" page.html`)
- [ ] 1 seul `<h1>`, hiérarchie Hn correcte
- [ ] `title` 50-60 car., `meta description` 150-160 car., uniques
- [ ] `canonical` correct
- [ ] JSON-LD valide (Rich Results Test) — FAQ head ↔ section synchronisés
- [ ] `alt` descriptif sur chaque image, photos réelles de luxe
- [ ] Open Graph + Twitter Card renseignés
- [ ] Liens CTA « Réserver » / « Vérifier les disponibilités » → `reserver.html`
- [ ] Maillage interne en place (guide ↔ fiches hôtel)
- [ ] Rendu desktop + mobile vérifié

---

## Astuce — remplacement par script (optionnel)

```js
// fill-template.js — node fill-template.js
const fs = require('fs');
const data = {
  HOTEL_NOM: 'Hôtel Martinez',
  VILLE: 'Cannes',
  VILLE_SLUG: 'cannes',
  PAYS: 'France',
  PAYS_SLUG: 'france',
  PAYS_ISO: 'FR',
  SLUG_HOTEL: 'hotel-martinez',
  // ... compléter tous les jetons
};
let html = fs.readFileSync('template-hotel.html', 'utf8');
html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);
fs.writeFileSync('hotels/france/cannes/hotel-martinez.html', html);
console.log('Jetons restants :', (html.match(/\{\{/g) || []).length);
```
