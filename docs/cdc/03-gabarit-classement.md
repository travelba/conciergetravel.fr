# CDC 03 — Gabarit « classement »

> **Route** : `/classement/{slug}` (FR) · `/en/classement/{slug}` (EN)
> **Volume concerné** : 863 classements publiés
> **Statut** : spécification complète, exécutable
> **Dépend de** : chapitre 01 (architecture), 09 (règles éditoriales)

---

## 1. Intention

C'est **la page reine du site**. C'est elle qui capte la requête commerciale
(« meilleurs hôtels Venise », « hôtel de luxe Paris »), c'est elle que yonder.fr
possède aux positions #1, et c'est sur elle que se joue le référencement.

### Le concurrent, mesuré

| Élément | yonder.fr | Site actuel | Cible v2 |
| --- | --- | --- | --- |
| Image au-dessus de la ligne de flottaison | oui | **non** | **oui** |
| `og:image` | oui | **absent** | **oui** |
| Position du classement dans la page | en tête | **7ᵉ bloc sur 13** | **1er bloc après le hero** |
| Photos par hôtel | **5 à 10** | 1 | **5 à 10** |
| Mots par hôtel | 150-250 | 172 | 150-250 |
| Nature du texte | **concret** (architecte, chambre, chef, anecdote) | **générique** (« s'impose naturellement ») | **concret** |
| Liste numérotée visible | oui | non | **oui** |
| Bloc de fin d'entrée (adresse, étoiles, prix, site officiel) | oui | **absent** | **oui** |
| Date de mise à jour visible | oui | non | **oui** |
| Blocs JSON-LD | ~6 | **~10** | **~10, conservés** |

**Règle de jugement** : la page v2 est finie quand elle soutient la comparaison
côte à côte avec l'équivalent yonder sur les six premières lignes de ce tableau,
**sans perdre** l'avantage de la dernière.

---

## 2. Anatomie de la page

Les blocs sont listés **dans l'ordre de rendu**. Aucun bloc ne s'intercale sans
modification de ce CDC.

### Bloc 1 — Hero

Pleine largeur, hauteur `60vh` desktop / `50vh` mobile.

- **Image** : `editorial_rankings.hero_image` (Cloudinary). Si absent, retomber
  sur `hero_image` de l'hôtel classé n°1. Si les deux sont absents, la page
  **n'est pas publiable** — elle sort de l'index et remonte dans le rapport.
- Chargement en `priority`, format moderne, `sizes` responsive. C'est le LCP de
  la page : il est mesuré.
- Dégradé sombre en bas pour la lisibilité du texte superposé.
- **En surimpression** : le `<h1>` (`title_fr` / `title_en`), et une ligne de
  méta : nombre d'adresses · ville ou périmètre · **« Mis à jour le
  {reviewed_at} »**.

> La date vient de `reviewed_at`. Si elle est nulle, on affiche `updated_at`.
> On n'affiche **jamais** une date fabriquée ni « mis à jour aujourd'hui »
> calculé au rendu.

### Bloc 2 — Chapô

3 à 5 lignes maximum, extraites des premiers paragraphes de `intro_fr` /
`intro_en`. Ce n'est pas l'intro complète : c'est la promesse, lisible en cinq
secondes.

### Bloc 3 — Sommaire ancré

La liste numérotée des hôtels, chacun un lien d'ancre vers son entrée.

Deux fonctions : c'est **la forme « top 10 » que les questions de Google
réclament littéralement**, et c'est la table des matières qui permet à Google
d'afficher des sous-liens dans son résultat.

Sur desktop, il devient une colonne latérale collante au défilement.

### Bloc 4 — Le classement *(le cœur)*

Une entrée par hôtel, ordonnée par `rank` croissant.

**Anatomie d'une entrée :**

```
┌──────────────────────────────────────────────────┐
│  01   NOM DE L'HÔTEL              ★★★★★  [badge] │
│       Quartier · Ville                            │
├──────────────────────────────────────────────────┤
│  [galerie 5-10 photos, défilement horizontal]    │
├──────────────────────────────────────────────────┤
│  150-250 mots concrets                            │
│  ⭐ Le Conseil du Concierge                       │
├──────────────────────────────────────────────────┤
│  Adresse · Étoiles · À partir de X €              │
│  Site officiel ↗    Voir la fiche complète →     │
└──────────────────────────────────────────────────┘
```

**Règles par élément :**

| Élément | Source | Comportement si absent |
| --- | --- | --- |
| Numéro de rang | `rank` | jamais absent |
| Nom | `hotels.name` / `name_en` | jamais absent |
| Étoiles | `hotels.stars` | masquer le composant |
| Badge éditorial | `badge_fr` / `badge_en` | masquer |
| Quartier · Ville | `hotels.district`, `hotels.city` | afficher la ville seule |
| Galerie | `hotels.gallery_images` | **si < 3 photos, l'entrée est signalée dans le rapport de conformité** — la page reste publiée avec ce qui existe |
| Texte | `justification_fr` / `justification_en` | jamais absent (contrainte DB : 40-1200 caractères) |
| Conseil du Concierge | `hotels.concierge_advice` | masquer le bloc — ne jamais le remplacer par du texte générique |
| Adresse | `hotels.address` | masquer la ligne |
| Prix de départ | `hotels.indicative_price_minor` | masquer la mention — **ne jamais estimer un prix** |
| Site officiel | `hotels.website_url_fr` / `_en` | masquer le lien |
| Lien fiche | `/hotel/{hotels.slug}` | jamais absent |

**Sur le prix** : `indicative_price_minor` est un ordre de grandeur éditorial,
pas un tarif. Il s'affiche sous la forme « à partir de 1 200 € » avec une
mention de contexte discrète (« tarif indicatif basse saison »). Il ne doit
jamais être présenté comme un prix réservable, ni générer de nœud `Offer`.

**Le lien vers le site officiel est en `nofollow`** — c'est un lien sortant
éditorial, pas une recommandation de crawl.

### Bloc 5 — Regroupement par quartier *(conditionnel)*

Si le classement est géographique et que les hôtels couvrent 3 quartiers
distincts ou plus (`hotels.district`), une carte de lecture par quartier
apparaît avant la liste : « Dans le 1er », « Rive gauche »…

C'est un usage direct de yonder et il aide le lecteur autant que le maillage.

### Bloc 6 — Méthodologie

Court, factuel : sur quoi la sélection repose (labels, distinctions, sources
externes), qui l'a écrite (`author_name`), quand elle a été revue
(`reviewed_at`).

C'est le bloc qui fabrique la confiance — pour le lecteur comme pour un LLM qui
cherche à qualifier la source.

### Bloc 7 — Intro longue

Le contenu complet de `intro_fr` / `intro_en` (400 à 8 000 caractères), après la
liste. Il sert le référencement sémantique sans repousser le classement vers le
bas de page.

### Bloc 8 — FAQ

`editorial_rankings.faq`, rendu en accordéon, balisé `FAQPage`.

Les questions viennent des questions réellement posées à Google (People Also
Ask), pas d'une invention. Les réponses sont directes en deux à quatre phrases —
c'est le format que les moteurs de réponse extraient.

### Bloc 9 — Outro *(conditionnel)*

`outro_fr` / `outro_en` si présents.

### Bloc 10 — Maillage

Trois groupes de liens :

1. **Classements voisins** — même ville, autre axe (spa, romantique, vue…)
2. **Destination** — le hub `/destination/{ville}`
3. **Guide** de la destination s'il existe

Objectif : aucune page cul-de-sac, et distribution du jus de lien vers les hubs.

---

## 3. Contrat de données

Une seule requête pour toute la page. Pas de requête dans un composant enfant.

```
editorial_rankings
  ├─ slug, title_fr/en, kind, intro_fr/en, outro_fr/en, faq,
  │  hero_image, meta_title_fr/en, meta_desc_fr/en,
  │  reviewed_at, author_name, author_url, is_published, updated_at
  └─ editorial_ranking_entries (ordonné par rank)
       ├─ rank, justification_fr/en, badge_fr/en
       └─ hotels
            ├─ slug, name, name_en, stars, city, district, address,
            ├─ gallery_images, hero_image, concierge_advice,
            ├─ website_url_fr/en, indicative_price_minor,
            └─ aggregate_rating_value, aggregate_rating_count, latitude, longitude
```

**Règles de lecture :**

- Validation par schéma à la frontière. Une ligne malformée produit une **404
  propre**, jamais une erreur 500.
- Les entrées dont l'hôtel est dépublié sont **exclues** et les rangs
  **recalculés** à l'affichage — pas de trou dans la numérotation.
- Un classement de moins de 3 entrées valides n'est pas publiable : il est servi
  en `noindex` et remonte dans le rapport.

---

## 4. Balisage

### Métadonnées

| Balise | Source | Repli |
| --- | --- | --- |
| `<title>` | `meta_title_fr` / `_en` | `title_fr` + suffixe marque |
| `description` | `meta_desc_fr` / `_en` | 155 premiers caractères du chapô |
| `og:image` | **`hero_image` transformé en 1200×630** | photo de l'entrée n°1 |
| `og:type` | `article` | — |
| `canonical` | l'URL de la page elle-même | — |
| `hreflang` | réciproque FR ↔ EN + `x-default` | — |

> **Le suffixe de marque ne doit jamais être ajouté quand le titre le contient
> déjà.** Le site actuel produit « MyConciergeHotel — … · MyConciergeHotel ».

### JSON-LD — à conserver intégralement

C'est l'avantage sur le concurrent : il en émet ~6, nous ~10.

| Type | Contenu |
| --- | --- |
| `ItemList` | La liste ordonnée, `position` = `rank` |
| `Hotel` *(par entrée)* | Nom, adresse, étoiles, géo, image, `description` = justification |
| `FAQPage` | Les questions/réponses du bloc 8 |
| `BreadcrumbList` | Accueil → Classements → cette page |
| `Article` | `datePublished`, `dateModified` = `reviewed_at`, `author` |
| `Speakable` | Le chapô et les réponses de FAQ |
| `ImageObject` | Le hero |
| `WebPage` + `Organization` | Contexte de site |

**Interdits** : aucun nœud `Offer`, aucun `priceValidUntil`, aucun
`AggregateOffer`. Le périmètre est éditorial.

`aggregateRating` n'est émis **que** si `aggregate_rating_value` et
`aggregate_rating_count` sont tous deux présents et sourcés.

---

## 5. Comportements

### Rendu

**Statique, revalidation à l'heure.** Aucune lecture d'en-tête de requête dans
le rendu — c'est ce qui verrouille tout le site actuel en dynamique et lui coûte
100 % de son cache.

Le JSON-LD est de la donnée inerte : il **ne prend pas de nonce**.

### Responsive

| | Mobile | Desktop |
| --- | --- | --- |
| Hero | 50vh | 60vh |
| Sommaire | accordéon repliable en haut | colonne latérale collante |
| Galerie d'entrée | défilement horizontal, 1,2 photo visible | grille 3 colonnes, visionneuse au clic |
| Bloc de fin d'entrée | empilé | sur une ligne |

### Performance

- LCP < 2,5 s ; le hero est la seule image en `priority`.
- Les galeries des entrées 2 et suivantes sont en chargement différé.
- Aucun composant client au-dessus de la ligne de flottaison.
- La page est servie depuis le cache au second appel.

### Accessibilité

Un seul `<h1>`. Chaque entrée est un `<h2>`. La galerie est navigable au
clavier. Chaque image porte son texte alternatif (`gallery_images[].alt_fr` /
`alt_en`) — jamais un alt vide, jamais le nom de fichier.

### États dégradés

| Situation | Comportement |
| --- | --- |
| Classement inexistant ou dépublié | 404 propre, pas de 500 |
| Moins de 3 entrées valides | Page servie, `noindex`, signalée au rapport |
| Aucune photo sur une entrée | Entrée rendue sans galerie, signalée |
| Base indisponible | Page d'erreur bilingue, jamais de trace technique exposée |

---

## 6. Critères d'acceptation

Binaires. Une réponse « presque » vaut non.

**Structure**

- [ ] Une image est visible sans défiler, sur mobile comme sur desktop
- [ ] Le premier hôtel du classement est visible en moins d'un défilement
- [ ] La liste est numérotée et le sommaire ancré fonctionne
- [ ] Chaque entrée porte adresse, étoiles, prix de départ *(si connu)*, lien
      officiel et lien fiche
- [ ] La date de mise à jour est visible et provient de la base

**Contenu**

- [ ] 5 photos minimum par entrée sur la page de référence
- [ ] Chaque texte d'entrée contient au moins **deux éléments nommés** —
      architecte, chambre, chef, restaurant, spa, anecdote datée
- [ ] Aucune formule générique interchangeable *(liste au chapitre 09)*
- [ ] Le Conseil du Concierge apparaît quand il existe

**Technique**

- [ ] `og:image` présent et valide *(test de partage réel)*
- [ ] Les ~10 blocs JSON-LD passent le test de résultats enrichis de Google
- [ ] Aucun nœud `Offer`
- [ ] Second appel servi depuis le cache
- [ ] LCP < 2,5 s sur mobile
- [ ] `hreflang` réciproque vérifié dans les deux sens
- [ ] Aucune chaîne de texte en dur
- [ ] Le titre ne contient pas deux fois la marque

**Comparaison**

- [ ] Capture côte à côte avec l'équivalent yonder, en FR et en EN, mobile et
      desktop, jointe au rapport
- [ ] La page v2 gagne sur le visuel et la richesse du texte, sans avoir perdu
      un seul bloc JSON-LD

---

## 7. Lots de travail

### Lot 3.1 — Gabarit sur une ville de référence

Construire le gabarit complet sur **un seul classement**, choisi là où yonder
est en position #1 pour que la comparaison soit honnête. Recommandé :
`meilleurs-hotels-venise` (yonder #1 confirmé en SERP).

*Sortie* : les critères du §6 sont tous verts sur cette page. **Aucune
généralisation avant.**

```text
Mission — gabarit de classement (branche cdc/03-gabarit-classement)

Construis le gabarit de page classement défini dans docs/cdc/03-gabarit-
classement.md, appliqué au seul slug `meilleurs-hotels-venise`.

Contraintes non négociables :
- Rendu statique, revalidation 3600. Aucune lecture d'en-tête de requête
  dans le chemin de rendu. Le JSON-LD ne prend pas de nonce.
- Une seule requête de données pour toute la page, validée par schéma à la
  frontière. Ligne malformée → 404 propre.
- Les ~10 blocs JSON-LD listés au §4 sont tous émis. Aucun nœud Offer.
- Aucune chaîne en dur : tout par clés i18n, FR et EN.
- Aucun `any`, `as`, `!`.

Ordre des blocs : strictement celui du §2. Le classement est le premier bloc
après le hero et le chapô — pas le septième.

Livre : la page, les composants, les clés i18n FR+EN, les tests de rendu du
JSON-LD.

Acceptation : parcours réel de la page en FR et EN, mobile et desktop,
captures jointes, plus une capture côte à côte avec la page yonder
équivalente. Coche la liste du §6 point par point dans ton rapport ; tout
point non vert est signalé, pas contourné.
```

### Lot 3.2 — Généralisation aux 863 classements

Uniquement après validation du 3.1. Le gabarit ne change plus ; on branche les
données et on traite les cas limites remontés par le rapport de conformité.

*Sortie* : rapport listant, pour les 863, les entrées à moins de 3 photos, les
classements à moins de 3 entrées valides, les `hero_image` manquants.

### Lot 3.3 — Réécriture concrète des justifications

Le chantier de contenu, spécifié au chapitre 09. Par lots de 20 à 30
classements, en commençant par les 30 villes à plus fort volume de recherche.

Chaque texte est ancré sur des sources réelles et passe le contrôle
anti-fabrication avant d'être écrit en base.

*Sortie* : sur les classements traités, chaque entrée contient au moins deux
éléments nommés et vérifiables.

### Lot 3.4 — Photos des entrées

Dépend du chapitre 04 (fiche hôtel) : les photos vivent sur l'hôtel, pas sur le
classement. Traité une fois par hôtel, servi partout.

---

## 8. Ce que ce chapitre ne couvre pas

- La **génération** de nouveaux classements *(chapitre 10)*
- Le **choix des slugs** et l'arbitrage `hotel-de-luxe` / `meilleurs-hotels`
  *(chapitre 08)*
- Les **règles d'écriture** détaillées et la liste des formules interdites
  *(chapitre 09)*
- Le **sourcing photo** *(chapitre 04)*
