# Cadrage projet — battre yonder.fr sur le référencement

> **Date** : 2026-08-02
> **Brief PO** : construire un concurrent direct de **yonder.fr**. Nos armes :
> les classements (qu'il a aussi), **beaucoup plus d'hôtels**, des **fiches
> hôtels qu'il n'a pas**, un **annuaire qu'il n'a pas**.
> **Objectif phase 1** : construire le site parfaitement et le rendre
> référençable — **premier sur Google** et **cité dans les LLM**.
> **Hors périmètre, explicitement** : toute réservation. Aucun revenu
> transactionnel n'est recherché à ce stade.
> **Moyens** : fondateur à temps plein, horizon 12-18 mois sans contrainte de
> revenu.

Ce document remplace les cinq plans maîtres antérieurs comme document de cap.
Leurs diagnostics techniques restent valables et sont cités ici ; leurs
prescriptions ne s'appliquent plus.

---

# A — La cible

## A.1 Qui est yonder.fr

| | yonder.fr | MyConciergeHotel |
| --- | --- | --- |
| Mots-clés classés (FR) | **14 727** | **1** |
| Positions en page 1 | **616** | 0 |
| Trafic organique estimé | ~418 000 / mois | ~0,7 / mois |
| Classements publiés | ~430 | **863** |
| Fiches hôtel | ~600 | **2 929** |
| Guides / POI | 1 772 cityguides + 2 404 pages POI | guides + lieux + itinéraires |
| Annuaire | **aucun** | **oui** |
| Blocs JSON-LD par page | ~6 | **~10, dont `Hotel` par entrée, `FAQPage`, `Speakable`** |

Sources : DataForSEO live 2026-07-02, sitemap yonder (7 572 URLs) et audit
concurrent du 2026-06-23, tous deux dans `docs/audits/`.

## A.2 Ce que « premier sur Google » veut dire concrètement

Le champ de bataille est identifié et il est étroit. Les requêtes qui comptent
sont de trois familles :

| Famille | Exemple | Volume FR | Qui tient la position |
| --- | --- | --- | --- |
| **Éditoriale** | « meilleurs hôtels Venise », « plus beaux hôtels Marrakech » | 50-140 | **yonder #1, travellers-society #2** — MCH absent du top 20 |
| **Transversale à volume** | « hôtel de luxe Paris » | **2 900** | OTA et marques (Booking, Tripadvisor, Four Seasons) ; **seul yonder s'y glisse, #3** |
| **Conversationnelle / IA** | « où dormir à Venise pour une lune de miel » | non mesurable en SERP | **personne — c'est le terrain vide** |

**Fait décisif, et sous-exploité** : « hôtel de luxe {ville} » pèse
**26× plus** que « meilleurs hôtels {ville} » sur Paris (2 900 contre 110), 10×
sur Dubaï, 7× sur New York, 6× sur Marrakech. Le projet a industrialisé la
formulation la plus faible : **521 slugs `meilleurs-*` contre 1 seul slug
`hotel-de-luxe-*`**.

## A.3 Le terrain où yonder n'est pas

C'est là que se joue la partie gagnable :

- **Les fiches hôtel individuelles** : il en a ~600, tu en as 2 929. Une fiche
  d'hôtel bien faite capte « {nom de l'hôtel} avis », « {nom de l'hôtel} prix » —
  des requêtes de marque à intention forte, sur lesquelles yonder n'est pas
  positionné faute de couverture.
- **L'annuaire** : il n'en a aucun. C'est une surface de maillage et de longue
  traîne géographique qu'il ne peut pas produire sans refondre son site.
- **La couche machine** : ~10 blocs JSON-LD contre 6, avec `Hotel` par entrée,
  `FAQPage` et `Speakable` qu'il n'émet pas. C'est **la douve GEO**, et c'est le
  seul avantage que tu as déjà et qu'il ne peut pas copier en une semaine.
- **Le Conseil du Concierge** : la connaissance opérationnelle — la chambre à
  demander, l'horaire, l'accès. Ni yonder ni travellers-society ne l'ont.

---

# B — L'écart réel

## B.1 La vérité inconfortable sur le volume

**Le plan « j'aurai plus d'hôtels que lui » décrit un avantage déjà acquis qui
n'a rien produit.**

Tu as **deux fois plus de classements** que yonder et **cinq fois plus de
fiches**. Résultat : 1 mot-clé classé contre 14 727. Le volume de pages n'est
pas le levier — il est déjà en ta faveur et le score est de 1 à 14 700.

Ce n'est pas une raison d'abandonner le plan. C'est une raison de comprendre ce
qui bloque réellement, parce que produire 500 pages de plus reproduira
exactement le même résultat.

## B.2 Les trois blocages, dans l'ordre où ils pèsent

### Blocage 1 — L'autorité (le plus lourd)

Google ne classe pas une page parce qu'elle est bonne, mais parce que des sites
crédibles la citent. Yonder a dix ans de liens ; tu en as ~0. C'est **la seule
explication** du fait qu'un site objectivement mieux structuré soit absent des
SERP.

Ce blocage a été identifié en juillet et **gelé par décision** (D4 : pas
d'outreach). **Ce gel n'a plus de justification.** Il avait été pris quand le
temps du fondateur était le facteur rare. Aujourd'hui : temps plein, pas
d'urgence de revenu, et aucun chantier de réservation à construire. **Le temps
existe, et l'autorité est le seul travail qui ne peut pas être délégué à un
agent.** C'est devenu la meilleure utilisation possible du temps humain
disponible.

Le pack est déjà livré et attend : page badge `/le-concierge/badge` en ligne,
200 cibles qualifiées en CSV, templates FR/EN, dossier de presse. Il ne manque
que les envois.

### Blocage 2 — La lecture humaine

Yonder gagne le lecteur, pas seulement le robot. Écart mesuré page à page :

| Élément | yonder | MCH |
| --- | --- | --- |
| Image au-dessus de la ligne de flottaison | **oui** | **non** |
| `og:image` (carte sociale, Discover) | oui | **absent — cassé** |
| Photos par hôtel dans un classement | **5 à 10** | **1** |
| Texte par hôtel | 150-250 mots **concrets** | 172 mots **génériques** |
| Nature du texte | l'architecte, la chambre à réserver, le chef étoilé, l'anecdote | « s'impose naturellement dans ce classement » |
| Bloc de fin d'entrée | adresse, étoiles, « prix à partir de », site officiel | absent |
| Forme « top 10 » numérotée | oui | non |
| Date de mise à jour visible | oui | non |
| Position du classement dans la page | en tête | **7ᵉ bloc sur 13** |

Le dernier point est le plus coûteux : sur une page de classement, le classement
arrive après six autres blocs. Un lecteur qui cherche une liste ne la trouve pas.

Et sur les fiches : **54 fiches sur 2 929 atteignent 20 photos ; 6 en atteignent
30.** Sur un marché où l'image est le premier signal, c'est le gap structurel le
plus large du produit.

### Blocage 3 — Le mauvais lexique

521 slugs sur la formulation à 110 de volume, 1 slug sur celle à 2 900 (§A.2).
C'est le blocage le moins cher à lever et il n'a jamais été traité.

## B.3 Ce qui n'est pas un blocage

À retirer du pilotage, pour ne plus y dépenser d'effort :

- **La structure on-page et le JSON-LD** — déjà supérieurs au concurrent.
- **La parité EN des classements** — comblée fin juin (863/863 vérifié en DB) ;
  le chiffre de 8 % qui circule dans les plans est mort.
- **Le TTFB** — mesuré entre 0,40 et 1,90 s. Ce n'est pas le problème.
- **Le nombre de pages** — déjà devant.

---

# C — L'arme

Trois avantages structurels, plus une chose à prendre au concurrent.

## C.1 Les fiches hôtel — l'avantage le plus large

2 929 contre ~600. Chaque fiche vise les requêtes de marque (« {hôtel} avis »,
« {hôtel} prix », « {hôtel} spa ») où le concurrent n'est pas présent, et où
l'autorité de domaine pèse moins que la pertinence exacte.

**Condition pour que ça marche** : une fiche doit être la meilleure page du web
sur cet hôtel. Aujourd'hui la structure y est, les photos non.

## C.2 L'annuaire — l'avantage qu'il ne peut pas copier

Yonder n'en a aucun. C'est une surface de maillage interne et de longue traîne
géographique.

⚠ **Contradiction à trancher** : le travail de crawl-focus de juillet a mis une
partie de l'annuaire en `noindex` (villes de moins de 3 hôtels, pays fins,
hubs.xml réduit de 1 857 à 632 entrées). **Un annuaire désindexé ne peut pas
être un différenciateur SEO.** Les deux décisions ne peuvent pas tenir ensemble
— voir §D.4.

## C.3 La couche machine — la douve GEO

`ItemList` + `Hotel` par entrée + `FAQPage` + `Speakable` + hreflang + `llms.txt`
+ 27 endpoints agent. Aucun concurrent du secteur n'a ça.

C'est l'actif qui sert directement le second objectif — être cité par les LLM —
et il est **déjà construit**. Il ne demande pas d'investissement, il demande
d'être **mesuré**, ce qui n'a jamais été fait (§E.2).

## C.4 Ce qu'il faut lui prendre : la lecture humaine

Rien de ce qui précède ne compense une page aride. Le rattrapage du §B.2 n'est
pas de la cosmétique : la photo au-dessus de la ligne de flottaison, le « prix à
partir de », la chambre nommée et l'anecdote sont **ce que le lecteur vient
chercher** — et ce que Google observe à travers son comportement.

---

# D — Le plan de construction

Principe : **on ne produit plus de pages neuves tant que le gabarit d'une page
n'est pas au niveau du concurrent.** Multiplier un gabarit perdant multiplie la
défaite — c'est ce que le projet a fait pendant un an.

## D.1 Chantier 1 — Le gabarit de classement (priorité absolue)

C'est le terrain direct de yonder, et le gabarit sert 863 pages d'un coup.

À faire, dans l'ordre :

1. **Hero au-dessus de la ligne de flottaison** + `og:image` dérivé de la photo
   de la première entrée. Répare la carte sociale et Discover, actuellement
   cassées.
2. **Remonter le classement en tête de page** — actuellement 7ᵉ bloc sur 13.
3. **Forme « top 10 » numérotée**, celle que les questions de Google (PAA)
   demandent littéralement.
4. **5 à 10 photos par entrée** au lieu d'une.
5. **Bloc de fin d'entrée structuré** : adresse, étoiles, « à partir de X € »,
   lien vers le site officiel.
6. **Date de mise à jour visible** et réelle.
7. **Réécriture concrète des justifications** : l'architecte, la chambre à
   demander, la table étoilée et son chef, une anecdote. On supprime « s'impose
   naturellement » et tous ses cousins.
8. **Conserver intégralement le JSON-LD** — c'est la douve, chaque nouvelle page
   doit en hériter.

Les points 1 à 6 sont des changements de gabarit : ils s'appliquent aux 863
pages en une fois. Le point 7 est un travail par lots, à commencer par les 20-30
classements de villes à plus fort volume.

## D.2 Chantier 2 — Le lexique

Créer les slugs `hotel-de-luxe-{ville}` sur les villes à volume — Paris 2 900,
Marrakech 880, Dubaï 320, New York 210, Venise 170 — et réorienter les titres et
H1 anglais sur « luxury hotels {city} ».

Décision à prendre en même temps : **canonique ou alias**. Deux pages sur la même
ville et la même intention se cannibalisent. Pour chaque ville, une page pilier
désignée, les sœurs pointent vers elle.

Bénéfice secondaire : la matrice rattache les **826 hôtels orphelins** (dont 59 à
Paris) à au moins un classement — du maillage interne gratuit.

## D.3 Chantier 3 — Les fiches hôtel

L'avantage le plus large, aujourd'hui bridé par les photos.

- Cible : **20 photos minimum, 6 catégories** (chambre, restaurant, spa, piscine,
  extérieur, vue) sur une tête de catalogue d'environ 300 fiches — les plus
  fortes en volume de marque et présentes dans les classements têtes.
- Alt FR/EN générés, aucun lien direct vers les images du fournisseur.
- Le reste du catalogue attend : 2 929 fiches à 30 photos représente ~88 000
  photos, ce n'est pas un chantier, c'est un mur.

## D.4 Chantier 4 — L'annuaire : trancher la contradiction

Trois options, à choisir explicitement :

| Option | Conséquence |
| --- | --- |
| **Réindexer l'annuaire** | Cohérent avec le brief (« un annuaire qu'il n'a pas »), mais réintroduit 1 200 pages fines dans l'index — exactement ce que le crawl-focus de juillet cherchait à éviter |
| **Le garder désindexé** | Cohérent avec le crawl-focus, mais l'annuaire cesse d'être un différenciateur SEO — il ne sert plus que le maillage et les agents IA |
| **Réindexer par seuil de qualité** | Seules les entrées d'annuaire réellement fournies (≥ 5 hôtels, contenu propre) reviennent dans l'index. **Recommandé** — garde l'arme sans rouvrir la longue traîne vide |

Cette décision t'appartient. Elle conditionne le travail sur l'annuaire.

## D.5 Chantier 5 — L'autorité (humain, non délégable)

Le pack existe. Il manque l'exécution :

- Diffusion du **badge partenaire** aux hôtels du catalogue — c'est le seul
  levier qui génère des liens depuis des domaines hôteliers à forte autorité,
  et il s'auto-alimente une fois lancé.
- **Prospection presse** sur les 200 cibles qualifiées, avec les angles du
  dossier de presse.
- **Partenariats institutionnels** : Atout France, Relais & Châteaux, offices de
  tourisme, annuaires professionnels.

Rythme réaliste : quelques heures par semaine, en continu. Sans ce chantier,
tout le reste produit des pages parfaites que personne ne classe.

## D.6 L'ordre

```
1. Gabarit classement        ← débloque 863 pages d'un coup
2. Lexique hotel-de-luxe     ← le volume est là, il n'est pas capté
3. Autorité                  ← démarre en parallèle, en continu, dès maintenant
4. Fiches (photos tête)      ← l'avantage structurel, une fois le gabarit prouvé
5. Annuaire                  ← après la décision D.4
```

Un seul chantier actif à la fois, hors chantier 3 qui court en continu.

## D.7 Ce qu'on ne fait pas

- Aucune page nouvelle avant que le gabarit de classement soit refait.
- Aucun travail transactionnel — le gel du booking est total et confirmé.
- Aucun chantier de plateforme sans effet sur le référencement : cache, ISR,
  budget JS, refonte de gabarit hôtel. La plateforme est bonne.
- Aucun nouveau plan maître.
- Pas de locales DE/ES/IT.

## D.8 À solder immédiatement

- **Mentions légales** : les champs `[À COMPLÉTER]` (IM Atout France, garantie
  financière, assureur RC pro) sont toujours en production, liés depuis le
  footer de tout le site. Tu as les données — c'est une heure de travail et un
  risque réglementaire fermé.
- **Chiffres périmés** : `README.md` annonce 2 221 hôtels et 127 pays,
  `AGENTS.md` en annonce 2 219, la base en contient 2 929 sur 128 pays. Un site
  qui se contredit sur son propre inventaire n'inspire ni Google ni un LLM.
- **Rate limit `/api/agent/*`** : dégrade en ouvert si Redis tombe — la surface
  agentique, celle-là même qui porte l'objectif GEO, est sans protection.

---

# E — La mesure

## E.1 Le tableau de bord — six chiffres

| # | Mesure | Aujourd'hui | Cible 6 mois | Fréquence |
| --- | --- | --- | --- | --- |
| **1** | Mots-clés classés FR | **1** | 500 | mensuelle |
| **2** | Panier de 12 requêtes en top 20 | **0 / 12** | 4 / 12 | mensuelle |
| **3** | Pages avec impressions Google | **191 / 8 202** | 2 500 | mensuelle |
| **4** | **Domaines référents** | **~0** | 15 | mensuelle |
| **5** | **Taux de citation LLM** (30 prompts) | **non instrumenté** | à établir | mensuelle |
| **6** | Fiches tête à ≥ 20 photos | **54 / 2 929** | 300 | par lot |

Le n°4 est le prédicteur des n°1, 2 et 3. S'il ne bouge pas, les autres ne
bougeront pas — quelle que soit la qualité des pages.

## E.2 L'instrumentation manquante

**Le second objectif du projet — être cité par les LLM — n'est mesuré nulle
part.** Aucun script, aucune table, aucun rapport. Il est annoncé comme métrique
depuis juin et n'a jamais été outillé.

À construire, en premier, parce que c'est peu coûteux et que tout le pari GEO
en dépend : un panier de 30 questions types (« meilleur hôtel à {ville} », « où
dormir à {ville} pour {occasion} »), interrogées mensuellement sur les moteurs
accessibles, réponses horodatées et conservées. Le premier passage est la
référence.

Sans ça, « être cité par les IA » reste une intention, pas un objectif.

## E.3 Les points de décision, écrits d'avance

- **À 3 mois** : si les domaines référents sont toujours à zéro, c'est que le
  chantier autorité n'a pas été fait — pas qu'il ne marche pas. Seule
  conclusion possible : le faire, ou renoncer à l'objectif « premier sur
  Google ».
- **À 3 mois** : si le gabarit de classement refait n'a produit aucune
  progression d'impressions sur les pages retravaillées, le problème est
  entièrement l'autorité et la production de contenu doit s'arrêter net.
- **À 6 mois** : si le taux de citation LLM est nul malgré la couche machine, le
  pari GEO est faux et il faut le dire.

## E.4 Journal

Une entrée par session : fait, mesuré, appris, bloqué et sur qui.

- **2026-08-02 — Recadrage sur le brief concurrentiel.** Objectif clarifié :
  concurrent direct de yonder.fr, référencement SEO + GEO, zéro réservation.
  Constat central : l'avantage de volume est déjà acquis (863 classements contre
  ~430, 2 929 fiches contre ~600) et n'a produit aucune position — les blocages
  réels sont l'autorité, la lecture humaine du gabarit de classement, et le
  lexique. Le gel de l'outreach (D4) perd sa justification : le temps existe
  désormais. Décision ouverte : sort de l'annuaire (§D.4).

---

## Les quatre décisions à prendre

1. **L'annuaire** — réindexé, désindexé, ou réindexé par seuil de qualité (§D.4).
2. **L'outreach** — le gel est-il levé ? Sans lui, l'objectif « premier sur
   Google » n'est pas atteignable, et il faut alors se replier sur le seul
   objectif GEO.
3. **Le lexique** — `hotel-de-luxe-{ville}` en page canonique ou en alias des
   `meilleurs-*` existants (§D.2).
4. **Les mentions légales** — tu as dit avoir les données : les fournir clôt le
   seul risque réglementaire ouvert du projet.
