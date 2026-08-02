# Plan de construction — nouveau site, contenu existant

> **Date** : 2026-08-02
> **Nature** : plan d'un **projet neuf**. On ne corrige pas l'existant page par
> page — on construit un nouveau site, conçu dès le départ pour battre
> **yonder.fr**, en réutilisant le contenu et la donnée déjà produits.
> **Objectif phase 1** : premier sur Google, cité par les LLM. **Aucune
> réservation.**
> **Moyens** : fondateur à temps plein, horizon 12-18 mois, exécution par agents.

---

# A — Ce qu'on garde, ce qu'on jette

La règle de tri : **la donnée et le contenu ont de la valeur, la présentation et
l'historique de décisions n'en ont pas.**

## A.1 Ce qui traverse — l'actif réel

| Actif | Volume | Pourquoi il traverse |
| --- | --- | --- |
| **Base hôtels** | 2 929 publiés, 128 pays | Un an de sourcing et d'enrichissement. Irremplaçable. |
| **Classements** | 863 publiés | La matière du produit. Structure conservée, texte à retravailler (§C.2). |
| **Guides, lieux, itinéraires** | ~79 guides, 1 158 lieux, 23 itinéraires | Longue traîne et maillage. |
| **Photothèque Cloudinary** | 22 000+ photos catégorisées, alt à ~99 % | Coûteuse à reconstituer. |
| **Constructeurs JSON-LD** (`@mch/seo`) | ~10 types par page | **La douve.** Supérieurs à tout le secteur. On les reprend comme bibliothèque. |
| **Pipelines éditoriaux** | grounding DataForSEO, gate anti-scaffolding | L'outillage de production de contenu. |
| **Schéma Supabase + RLS** | 78 migrations | La donnée vit là. On ne la déplace pas. |

## A.2 Ce qu'on abandonne

| Abandonné | Pourquoi |
| --- | --- |
| **Les gabarits de pages actuels** | Le classement arrive au 7ᵉ bloc sur 13, sans photo en tête, sans `og:image`. C'est ce qui perd contre yonder — on ne le répare pas, on le refait. |
| **La double pile fiche** (kit vs standard) | Deux gabarits concurrents pour le même objet, jamais arbitrés. Un seul dans le nouveau site. |
| **Le verrou `force-dynamic`** | Nonce CSP lu au rendu → aucune page en cache CDN, sur 100 % du site. Un site neuf ne se met pas ce verrou : le JSON-LD n'a pas besoin de nonce, c'est de la donnée inerte. |
| **Le code booking** (Amadeus, Travelport, paiement stub) | Hors périmètre. Reste en dépôt, ne monte pas dans le nouveau site. |
| **Les cinq plans maîtres** | Contradictoires. Ce document les remplace. |
| **~65 composants clients** | Le nouveau site est statique par défaut. |

## A.3 La chose que ce plan ne résout pas

Un site neuf et parfait avec zéro lien entrant ne se classe pas davantage qu'un
site ancien et imparfait avec zéro lien entrant. **Yonder a 14 727 mots-clés
classés parce qu'il a dix ans de citations, pas parce que ses pages sont mieux
codées.**

La construction est nécessaire ; elle n'est pas suffisante. Le chantier autorité
(§D.5) court en parallèle du premier jour au dernier. C'est le seul travail du
plan qu'aucun agent ne peut faire.

---

# B — Le nouveau site

## B.1 Le principe directeur

**La page de classement est la page reine.** C'est elle qui capte la requête,
c'est elle que yonder possède, c'est sur elle que se joue la partie. Tout le
site est conçu pour y amener et pour en repartir.

Trois règles qui découlent :

1. **Visuel d'abord.** Yonder gagne le lecteur avec des images ; nous gagnons le
   robot et perdons le lecteur. Le nouveau site fait les deux.
2. **Statique par défaut.** Chaque page est servie depuis le cache. Le crawl
   d'un catalogue de 5 000 URLs coûte cher à Google : une page lente est une
   page moins crawlée.
3. **Un gabarit par type d'objet.** Pas de variante, pas de kit parallèle.

## B.2 Les six types de pages

### 1. Classement — `/classement/{slug}`

Le gabarit se construit contre le concurrent, bloc par bloc.

**Au-dessus de la ligne de flottaison** : image hero pleine largeur (photo du
n°1), titre, date de mise à jour visible, résumé en trois lignes, sommaire
ancré vers les entrées.

**Le classement, immédiatement après** — pas au 7ᵉ bloc. Liste **numérotée**,
la forme littérale que les questions de Google réclament (« Quels sont les 10
plus beaux hôtels de… »).

**Chaque entrée** :

- 5 à 10 photos en bandeau
- 150-250 mots **concrets** : l'architecte ou le designer, la chambre ou la
  suite à demander, la table étoilée et son chef, une anecdote vérifiable, la
  vue, le nom du spa. Aucun adjectif qui pourrait s'appliquer à un autre hôtel.
- **⭐ Le Conseil du Concierge** — le secret opérationnel. Ni yonder ni
  travellers-society ne l'ont. C'est la signature du site.
- **Bloc de fin structuré** : adresse, étoiles, « à partir de X € », lien vers
  le site officiel, lien vers la fiche complète.

**Après la liste** : regroupement par quartier, FAQ, classements voisins,
méthodologie de sélection.

**Couche machine** : `ItemList` + `Hotel` par entrée + `FAQPage` + `Speakable` +
`BreadcrumbList` + hreflang. Conservée intégralement — c'est ce qui nous fait
citer par les LLM.

### 2. Fiche hôtel — `/hotel/{slug}`

L'avantage structurel : **2 929 contre ~600 chez yonder**. Chaque fiche vise les
requêtes de marque (« {hôtel} avis », « {hôtel} prix », « {hôtel} spa »), où
l'autorité de domaine pèse moins que la pertinence exacte.

Objectif : **la meilleure page du web sur cet hôtel**. Galerie riche en tête,
description structurée, chambres, restaurants, spa, Conseil du Concierge, POI
alentour, FAQ, sources externes vérifiables, classements où l'hôtel figure.

### 3. Destination — `/destination/{ville}`

Le hub qui distribue le jus de lien : les classements de la ville, les hôtels,
le guide, les lieux. C'est la page qui rend le maillage lisible pour Google.

### 4. Annuaire — `/annuaire/...`

**Ce que yonder n'a pas.** Parcours pays → ville → hôtels, entièrement
navigable, sans recherche.

Deux fonctions : une surface de longue traîne géographique, et surtout une
**structure de maillage** qui garantit qu'aucun des 2 929 hôtels n'est orphelin
— aujourd'hui 826 le sont, dont 59 à Paris.

⚠ **Décision requise** : le travail de juillet a mis une partie de l'annuaire en
`noindex` pour économiser le budget de crawl. Un annuaire désindexé n'est pas
un différenciateur SEO. Recommandation : **indexer par seuil de qualité** — une
entrée d'annuaire entre dans l'index à partir de 5 hôtels réels et d'un contenu
propre, pas avant.

### 5. Guides et lieux — `/guide/{slug}`, `/lieux/{ville}/{slug}`

Longue traîne informationnelle. Ce sont aussi les pages que les LLM citent le
plus volontiers, parce qu'elles répondent à des questions plutôt qu'à des
intentions commerciales.

### 6. La surface machine — `llms.txt`, `/api/agent/*`, feeds

**Traitée comme un type de page à part entière, pas comme une annexe.** C'est
la moitié de l'objectif : être cité par les LLM. Elle existe déjà et elle est
en avance sur le marché — elle est reprise telle quelle et maintenue au même
niveau d'exigence que le HTML.

## B.3 Structure d'URL et lexique

Les URL actuelles sont bonnes et certaines ont une amorce d'indexation. **On les
conserve** — un site neuf sur les mêmes URL, pas une migration.

Un seul changement, et il est important : **le lexique**.

| Formulation | Volume FR (Paris) | Slugs actuels |
| --- | --- | --- |
| `hotel de luxe {ville}` | **2 900** | **1** |
| `meilleurs hotels {ville}` | 110 | **521** |

Rapport de **26×** sur Paris, 10× sur Dubaï, 7× sur New York, 6× sur Marrakech.
Le projet a industrialisé la formulation la plus faible.

**Décision à prendre** : `hotel-de-luxe-{ville}` devient la page pilier et
`meilleurs-hotels-{ville}` son alias canonique, ou l'inverse. Ce qui est exclu,
c'est de laisser deux pages se cannibaliser sur la même ville.

## B.4 Décision technique

**Reprendre le socle, refaire la surface.** Le nouveau site est une application
neuve qui consomme la base Supabase existante et importe `@mch/seo` comme
bibliothèque. On ne reconstruit ni la donnée, ni les constructeurs JSON-LD, ni
les pipelines éditoriaux.

Ce qui est neuf : les gabarits, les composants, le mode de rendu (statique),
l'arborescence.

L'alternative — repartir d'un dépôt entièrement vierge — coûte plusieurs
semaines pour reconstruire des choses qui fonctionnent déjà et qui sont notre
avantage concurrentiel. Non recommandé.

---

# C — Le contenu

Le nouveau gabarit demande une matière que le contenu actuel ne fournit pas
partout. Trois traitements.

## C.1 Ce qui se migre tel quel

Fiches hôtel (données factuelles, descriptions, FAQ, Conseil du Concierge),
guides, lieux, itinéraires, photothèque, sources externes. C'est l'essentiel du
volume.

## C.2 Ce qui se régénère — les justifications de classement

**C'est le principal chantier de contenu du projet.**

État actuel, mesuré : ~172 mots par entrée, mais **génériques** — « s'impose
naturellement dans ce classement », « une adresse de référence ». Ce sont des
adjectifs interchangeables.

Cible : 150-250 mots **nommés** — l'architecte, la chambre à demander, le chef,
l'anecdote, le prix de départ. C'est exactement ce que le concurrent fait et
c'est ce qui le rend crédible pour un lecteur comme pour un LLM.

Volume : 863 classements × ~8-10 entrées. On commence par les 30 villes à plus
fort volume, on étend ensuite. Chaque texte passe le grounding DataForSEO et le
gate anti-fabrication — un fait inventé sur un hôtel réel, sous signature
d'agence accréditée, est un risque qu'on ne prend pas.

## C.3 Ce qui manque et doit être produit

| Manque | État | Cible |
| --- | --- | --- |
| **Photos par hôtel** | 54 fiches sur 2 929 atteignent 20 photos ; 6 atteignent 30 | 20 photos et 6 catégories sur une tête de 300 fiches |
| **Slugs `hotel-de-luxe-{ville}`** | 1 | Les 50 villes à volume |
| **Destinations non couvertes** | 12 villes que yonder couvre et nous non, avec l'inventaire déjà en base | Vienne, Crète, Rajasthan, Seychelles, Genève, Lisbonne, Los Angeles, Maurice, Majorque, Ibiza, Saint-Barth, Sicile |
| **`og:image`** | absent — carte sociale et Discover cassées | Généré depuis la photo du n°1 |

Le poste photo est le plus lourd et le seul qui ne s'automatise pas
entièrement. Il gate la qualité perçue des classements comme des fiches.

## C.4 Ce qui sort

Contenu des destinations trop fines pour être défendables, doublons de scripts,
contenus non sourçables. Ils restent en base ; ils ne montent pas dans le
nouveau site.

---

# D — Le plan de construction

Cinq phases séquentielles, à critère de sortie. Pas de dates : une phase non
terminée ne laisse pas démarrer la suivante.

## Phase 0 — Le socle (préalable, court)

- Nouvelle application, rendu statique par défaut, sans verrou CSP au rendu.
- Connexion à la base existante, import de `@mch/seo`.
- Mentions légales complètes — tu as les données, c'est le seul risque
  réglementaire ouvert du projet et il se ferme en une heure.
- Rate limit de la surface agent en échec fermé : c'est elle qui porte
  l'objectif GEO, elle ne peut pas être sans protection.
- Alignement des compteurs : le site annonce 2 221 hôtels, la base en contient
  2 929. Un site qui se contredit sur son propre inventaire ne convainc ni
  Google ni un LLM.

*Sortie* : une page de test servie depuis le cache, JSON-LD valide, zéro
placeholder légal.

## Phase 1 — Le gabarit de classement

Le gabarit du §B.2.1, construit et validé **sur une seule ville** avant toute
généralisation. Paris ou Venise — un terrain où le concurrent est #1, pour que
la comparaison soit directe et honnête.

*Sortie* : la page côte à côte avec celle de yonder soutient la comparaison sur
le visuel, la richesse du texte et la structure. Si elle ne la soutient pas, on
ne généralise pas.

## Phase 2 — Le gabarit de fiche

Même méthode : une fiche de référence, complète, avec sa galerie riche. Puis
figée.

*Sortie* : la fiche est objectivement la meilleure page du web sur cet hôtel.

## Phase 3 — Le déploiement

Les deux gabarits étant figés, on déploie par vagues de villes : classements,
fiches, destination, entrées d'annuaire — une ville sort **complète**, jamais
à moitié.

Ordre des vagues : par volume de recherche décroissant, en commençant par les
villes où le concurrent est déjà positionné.

*Sortie* : chaque vague passe la comparaison directe avec l'équivalent yonder.

## Phase 4 — Les manques

Les 12 destinations non couvertes, la matrice `hotel-de-luxe`, le rattachement
des 826 orphelins, l'annuaire complet.

## D.5 — L'autorité (en parallèle, du premier au dernier jour)

Ne dépend d'aucune phase et ne peut être délégué.

Le pack est déjà produit et attend : page badge partenaire en ligne, 200 cibles
presse qualifiées, templates FR/EN, dossier de presse. Il manque les envois.

- **Badge partenaire** diffusé aux hôtels du catalogue — le seul levier qui
  génère des liens depuis des domaines hôteliers à forte autorité, et qui
  s'auto-alimente une fois lancé.
- **Prospection presse** sur les 200 cibles.
- **Partenariats** : Atout France, Relais & Châteaux, offices de tourisme,
  annuaires professionnels.

Quelques heures par semaine, en continu. Sans ce chantier, tout le reste
produit des pages parfaites que personne ne classe.

## D.6 — Règles de travail

- **Un gabarit se prouve avant de se multiplier.** C'est la règle qui manquait :
  le site actuel a industrialisé un gabarit perdant sur 863 pages.
- **Un objet sort complet ou ne sort pas.** Pas de « j'y reviendrai ».
- **Un seul chantier actif**, hors autorité et photos qui courent en continu.
- **Toute session finit sur un dépôt cohérent.**
- **Zéro fait inventé.** Sourcé, ou retiré.

---

# E — Mise en ligne et mesure

## E.1 La bascule

Le nouveau site reprend les URL actuelles. Rien à rediriger sur l'essentiel —
mais avant bascule :

- inventaire des URL qui reçoivent déjà des impressions (191 pages) : aucune ne
  doit changer d'adresse ni perdre son contenu ;
- redirections 301 pour tout slug modifié par le nouveau lexique ;
- sitemaps régénérés et resoumis ;
- vérification que chaque page servie porte son JSON-LD complet.

## E.2 Le tableau de bord

| # | Mesure | Aujourd'hui | Cible 6 mois |
| --- | --- | --- | --- |
| 1 | Mots-clés classés FR | **1** (yonder : 14 727) | 500 |
| 2 | Panier de 12 requêtes en top 20 | **0 / 12** | 4 / 12 |
| 3 | Pages avec impressions Google | **191 / 8 202** | 2 500 |
| 4 | **Domaines référents** | **~0** | 15 |
| 5 | **Taux de citation LLM** (30 prompts) | **non instrumenté** | à établir |
| 6 | Fiches tête à ≥ 20 photos | **54 / 2 929** | 300 |

Le n°4 est le prédicteur des trois premiers. S'il ne bouge pas, ils ne bougeront
pas — quelle que soit la qualité des pages construites.

## E.3 L'instrumentation à créer

**« Être cité par les LLM » n'est mesuré nulle part.** Aucun script, aucune
table, aucun rapport — alors que c'est la moitié de l'objectif et l'axe où le
site est déjà le mieux armé.

À construire en Phase 0, parce que c'est peu coûteux : un panier de 30 questions
types, interrogées mensuellement sur les moteurs accessibles, réponses
horodatées et conservées. Le premier passage sert de référence.

## E.4 Les points de décision

- **Fin de Phase 1** : si la page de classement neuve ne soutient pas la
  comparaison directe avec yonder, on ne déploie pas — on retravaille le
  gabarit. C'est le seul verrou qui empêche de répéter l'erreur du site actuel.
- **À 3 mois** : si les domaines référents sont toujours à zéro, l'objectif
  « premier sur Google » est hors d'atteinte et il faut se replier sur le seul
  objectif GEO — où l'autorité classique compte beaucoup moins.
- **À 6 mois** : si le taux de citation LLM est nul malgré la couche machine, le
  pari GEO est faux et doit être dit.

---

## Les trois décisions à prendre avant de commencer

1. **Le lexique** — `hotel-de-luxe-{ville}` en page pilier avec
   `meilleurs-hotels-{ville}` en alias, ou l'inverse.
2. **L'annuaire** — indexé intégralement, désindexé, ou indexé par seuil de
   qualité (recommandé).
3. **L'outreach** — le chantier autorité démarre-t-il maintenant ? Sans lui, le
   plan construit un très bon site que personne ne trouve.

---

## Journal

- **2026-08-02 — Plan de construction neuve.** Brief PO : nouveau site
  concurrent de yonder.fr sur le référencement, réutilisant le contenu
  existant, sans aucune réservation. Tri fait entre l'actif qui traverse
  (donnée, contenu, JSON-LD, pipelines, photothèque) et ce qui est abandonné
  (gabarits, double pile fiche, verrou de rendu, code booking, plans
  antérieurs). Principe structurant retenu : un gabarit se prouve sur une ville
  avant d'être multiplié — c'est ce qui manquait au site actuel, qui a
  industrialisé un gabarit perdant sur 863 pages. Trois décisions ouvertes :
  lexique, annuaire, outreach.
