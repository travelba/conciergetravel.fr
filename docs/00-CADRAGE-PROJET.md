# Cadrage projet — repartir de zéro

> **Date** : 2026-08-02
> **Nature** : cadrage à blanc. Aucune décision antérieure n'est tenue pour
> acquise — ni le positionnement, ni l'ordre des chantiers, ni le gel du
> booking, ni le pari GEO. Les actifs (catalogue, plateforme, accréditation)
> sont conservés comme **matériau**, pas comme cap.
> **Ce que ce document n'est pas** : une synthèse des plans précédents. Ceux-ci
> contiennent d'excellents diagnostics techniques ; ils ne fixent plus la
> direction.

---

# A — Ce qu'on a vraiment

Inventaire neutre, sans le récit qui l'accompagne d'habitude.

## A.1 Les actifs

| Actif | Réalité vérifiée | Rareté |
| --- | --- | --- |
| **Une agence de voyage réelle** | Travel Business Agency, SASU, RCS Nanterre 991 614 694, accréditation IATA | **Élevée.** Peu de gens peuvent encaisser une commission hôtelière légalement |
| **Un catalogue publié** | 2 929 hôtels, 128 pays, ~863 classements, guides, lieux, itinéraires | Faible — le contenu généré est devenu abondant |
| **Une plateforme technique sérieuse** | Monorepo, TS strict, RLS, 78 migrations, ~135 tests, CSP stricte | Moyenne — c'est du bon travail, réplicable |
| **Une couche machine supérieure au marché** | JSON-LD dense, `llms.txt`, 27 endpoints agent, sitemaps structurés | **Élevée sur le papier**, valeur commerciale non démontrée |
| **Un fondateur qui exécute vite avec des agents** | ~1 an de production continue, seul | Élevée |

## A.2 Ce qu'on n'a pas

| Manque | Mesure |
| --- | --- |
| **Une audience** | 1 mot-clé classé, ~0,7 visite organique estimée par mois, 191 pages sur 8 202 reçoivent la moindre impression |
| **Un client** | Aucun revenu généré par le site à ce jour |
| **Une demande mesurée** | Le formulaire concierge fonctionne ; personne n'a jamais compté ce qui en sort |
| **Une relation** | Aucune des 2 929 adresses du catalogue n'est un partenaire — ce sont des fiches, pas des hôtels avec qui on parle |
| **Une preuve de service** | Aucun séjour vendu, donc aucun avis, aucune référence, aucune histoire à raconter |

## A.3 Le fait le plus important de cet inventaire

**Le seul actif rare est inutilisé, et l'actif abondant absorbe tout l'effort.**

L'accréditation IATA — ce qui permet réellement de gagner de l'argent — est
gelée « jusqu'à ce que le contenu soit fini ». Pendant ce temps, l'effort porte
sur 2 929 pages de contenu, sur un marché où le contenu généré est devenu
gratuit et où les positions organiques appartiennent à des sites installés
depuis dix ans.

C'est l'inversion à corriger. Tout le reste de ce cadrage en découle.

---

# B — Le problème à résoudre

## B.1 La thèse actuelle, énoncée franchement

*« On publie la meilleure documentation du web sur les hôtels de luxe. Le
trafic viendra — de Google, puis des IA. Quand il sera là, on branchera la
réservation et on encaissera. »*

## B.2 Pourquoi cette thèse ne tient pas

Ce n'est pas une question d'exécution. L'exécution a été bonne : la couche
technique est objectivement au-dessus du marché. La thèse est fausse pour trois
raisons structurelles.

**1. L'acquisition organique en voyage de luxe est le marché le plus disputé
qui soit.** Le concurrent direct a 14 727 mots-clés classés, 418 000 visites
mensuelles estimées, et dix ans d'antériorité. L'écart est d'un facteur 14 700.
Aucun volume de contenu ne comble ça — c'est un écart d'autorité, donc de liens
et de temps. Un an d'effort a produit 1 mot-clé. Le marché a répondu.

**2. Produire 2 929 fiches par pipeline est aujourd'hui un passif autant qu'un
actif.** Les problèmes trouvés dans les audits — hôtels qualifiés « Palace » à
tort, FAQ en langues mélangées, contradictions internes, compteurs divergents —
ne sont pas des bugs. Ce sont les sorties attendues d'une génération à cette
échelle sans vérification humaine. Et elles sont publiées **sous la signature
d'une agence de voyage immatriculée**. Le risque n'est pas seulement le
déclassement Google : c'est de la donnée fausse sur des établissements réels,
signée par un professionnel accrédité.

**3. Le pari GEO n'a pas de chemin de monétisation démontré.** Être cité par
ChatGPT est réel et flatteur. Mais une citation n'envoie pas un client, et le
projet n'a jamais mesuré ni les citations, ni ce qu'elles rapporteraient. C'est
un pari — donc quelque chose qu'on teste à coût borné, pas quelque chose sur
quoi on construit un plan de six mois.

## B.3 Ce que la thèse a fait perdre

Un an sans jamais rencontrer un client. Toute la connaissance accumulée porte
sur la production de contenu ; **aucune ne porte sur ce que veut réellement
quelqu'un qui paie 2 000 € une nuit d'hôtel.** C'est cette ignorance-là qui
coûte cher, pas les fiches manquantes.

## B.4 La question à laquelle un cadrage à zéro doit répondre

Pas « comment publier mieux », mais :

> **Qui paie, pour quoi, et pourquoi lui plutôt qu'à Booking, à son agence
> habituelle, ou directement à l'hôtel ?**

Le projet n'a jamais eu à y répondre, parce que la réponse était repoussée
derrière le contenu. C'est la première chose à trancher.

---

# C — Le modèle : trois options, une recommandation

Trois façons honnêtes de faire vivre ces actifs. Elles s'excluent en priorité,
pas en nature — l'enjeu est de savoir laquelle passe **en premier**.

## Option 1 — Agence de voyage réelle d'abord *(service-led)*

Utiliser l'accréditation maintenant. Vendre des séjours à un petit nombre de
clients réels, à la main, avec la valeur ajoutée du Concierge — la connaissance
opérationnelle qui est déjà l'axe éditorial du projet.

- **Revenu** : possible en semaines. Commission hôtelière réelle sur chaque séjour.
- **Ce que le contenu devient** : une preuve de compétence et un outil de
  conversion, pas un moteur d'acquisition. Une fiche sert à convaincre le
  client qu'on a devant soi, pas à en attirer un inconnu.
- **Ce qu'on apprend** : ce que les clients demandent vraiment, ce qu'ils
  paient, ce qui les fait revenir. Cette connaissance n'existe nulle part
  aujourd'hui et ne s'achète pas.
- **Difficulté réelle** : trouver les premiers clients sans audience. Ça se
  fait par le réseau direct, pas par le site. C'est du travail non délégable
  à un agent, et c'est inconfortable.

## Option 2 — Média de niche *(content-led, mais radicalement resserré)*

Abandonner le scope mondial. Choisir **un** territoire où 50 à 100 pages
peuvent honnêtement être les meilleures du web — un pays, une catégorie, un
type de voyage — et le dominer.

- **Revenu** : 6 à 18 mois, incertain, par affiliation ou lead-gen.
- **Pourquoi ça peut marcher** : l'autorité se construit sur un périmètre
  étroit, jamais sur 128 pays. C'est exactement ce que le concurrent a fait.
- **Coût** : dépublier ou désindexer l'essentiel du catalogue. Psychologiquement
  difficile, stratégiquement sain.

## Option 3 — Infrastructure pour les IA *(le pari actuel, énoncé pour ce qu'il est)*

Être la source de référence machine sur l'hôtellerie de luxe.

- **Revenu** : aucun chemin identifié à ce jour.
- **Statut honnête** : c'est un pari, et les actifs qui le portent sont **déjà
  construits et déjà en ligne**. Il ne nécessite aucun investissement
  supplémentaire pour continuer à courir.
- **Donc** : on le garde, on le mesure, on n'y réinvestit pas tant qu'il n'a
  pas produit un signal.

## C.1 Recommandation

**Option 1 en premier. Option 2 comme discipline de contenu à l'intérieur.
Option 3 en observation gratuite.**

Concrètement :

1. On vend des séjours **maintenant**, à la main, sans attendre quoi que ce soit
   de technique. Le funnel de demande existe déjà et fonctionne.
2. Le contenu cesse d'être un chantier de volume et devient un **support de
   vente** : on approfondit uniquement ce que le client qu'on a en face demande.
3. La couche machine reste en ligne, mesurée mensuellement, et ne consomme plus
   d'effort de développement.

**Pourquoi cet ordre** : c'est le seul qui produit du revenu et de la
connaissance client en même temps, et le seul qui n'exige pas de gagner une
guerre d'autorité qu'on a déjà perdue une fois. Il transforme aussi le
catalogue d'un pari sur le trafic futur en un outil de travail immédiat.

**Ce qui rendrait cette recommandation caduque** — à dire franchement :

- si tu as déjà des clients hors ligne, ou une source de prospects que je ne
  vois pas dans le dépôt, l'ordre change ;
- si l'objectif réel n'est pas le revenu mais la revente de l'actif, la
  logique est différente et il faut le dire ;
- si vendre des séjours à la main ne t'intéresse pas — c'est un métier de
  relation, pas de produit — alors l'Option 2 devient le bon choix, et il faut
  accepter son horizon de 12 mois.

---

# D — Le périmètre de départ

## D.0 Item zéro — non négociable, avant tout le reste

Les mentions légales du site contiennent toujours, aujourd'hui, en production :
`[À COMPLÉTER : IM + 9 chiffres]`, `[À COMPLÉTER : nom du garant]`,
`[À COMPLÉTER : nom de l'assureur]` — vérifié dans le code ce jour, bloqué
depuis le 17 juin.

**Une agence de voyage immatriculée ne peut pas opérer avec ça en ligne.** Ce
n'est pas de la dette technique, c'est une exposition réglementaire, et ça
devient bloquant à la seconde où on vend un premier séjour. Soit les données
sont fournies cette semaine, soit la page sort du footer en attendant.

## D.1 Ce qu'on construit dans les 90 premiers jours

Volontairement minuscule. Le but n'est pas de livrer, c'est d'apprendre en
vendant.

| # | Chantier | Pourquoi | Qui |
| --- | --- | --- | --- |
| 1 | **Conformité légale complète** | Prérequis d'exercice (D.0) | PO (données) + agent (intégration) |
| 2 | **Cinq premiers clients, séjours vendus à la main** | La seule source de vérité sur la demande | **PO seul — non délégable** |
| 3 | **Compter les demandes** | On ne pilote pas ce qu'on ne mesure pas ; la table `contact_requests` existe déjà | Agent, quelques heures |
| 4 | **Choisir un territoire de référence** | Le périmètre où on veut être le meilleur du web — pas 128 pays | PO, une décision |
| 5 | **Amener ce territoire au niveau réel** | Vérification humaine des faits, photos, sources. Quelques dizaines de fiches, pas 2 929 | PO + agents |
| 6 | **Mesurer les citations LLM** | Le pari Option 3 devient testable au lieu de rester une opinion | Agent, un script mensuel |

## D.2 Ce qu'on arrête

- **Toute génération de contenu de masse.** Le catalogue est fermé.
- **Toute optimisation SEO destinée à concurrencer yonder sur « meilleurs
  hôtels {ville} »** — combat non gagnable à cet horizon.
- **Le sourcing photo à l'échelle du catalogue** : uniquement sur le territoire
  de référence choisi.
- **Les chantiers de plateforme sans effet sur une vente** : cache, ISR,
  budget JS, refonte de gabarit. La plateforme est bonne. Elle n'est pas le
  problème.
- **La production de nouveaux plans.** Ce document est le seul cap ; les cinq
  plans maîtres existants passent en archive et gardent leur seule valeur de
  diagnostic technique.

## D.3 Ce qu'on fait du catalogue existant

Trois options, à trancher une fois le territoire de référence choisi :

1. **Tout garder indexé** — statu quo. Continue de diluer le crawl et de porter
   des affirmations non vérifiées sous signature professionnelle.
2. **Garder le territoire de référence indexé, désindexer le reste** — les pages
   restent servies, restent utiles à un client et à un agent IA, sortent de
   l'index. C'est la suite logique du travail de crawl-focus déjà commencé début
   juillet. **Recommandé.**
3. **Dépublier** — perte sèche d'un actif qui ne coûte rien à héberger. Non
   recommandé.

## D.4 La règle d'arbitrage permanente

Pour toute tâche candidate, une seule question :

> **Est-ce que ça rapproche d'une vente, d'une preuve, ou d'une conformité ?**

Si non, ça attend — quelle que soit sa qualité technique. C'est cette règle,
appliquée sans exception, qui empêche le retour à la dispersion.

## D.5 Cadence

Le contexte réel est **un fondateur seul, par sessions intermittentes, assisté
d'agents**. Les plans précédents supposaient 5 à 6 agents simultanés, un
stand-up quotidien et un orchestrateur permanent : ce dispositif a tenu une
semaine avant l'arrêt d'un mois.

- Un seul chantier actif. Deux agents maximum, sur des zones disjointes.
- Toute session se termine sur un dépôt cohérent — commit, ou rien.
- La reprise doit coûter moins de dix minutes : ce document plus le journal.
- Pas de calendrier fictif. Des jalons à critère de sortie.

---

# E — La preuve

## E.1 Ce qu'on mesure — cinq chiffres, pas un de plus

| # | Mesure | Aujourd'hui | Ce qu'elle décide |
| --- | --- | --- | --- |
| **1** | **Séjours vendus** | 0 | La seule preuve que le modèle existe |
| **2** | **Demandes concierge reçues / mois** | non compté (la table existe) | Le carburant du modèle |
| **3** | **Marge par séjour** | inconnue | Si le métier est rentable à cette échelle |
| **4** | **Taux de citation LLM** (panier de 30 prompts) | non instrumenté | Valide ou tue le pari Option 3 |
| **5** | **Pages avec impressions organiques** | 191 / 8 202 | Thermomètre du canal organique — surveillé, plus piloté |

Tout le reste — TTFB, taux de cache, parité linguistique, positions SERP,
nombre de fiches conformes — redevient du diagnostic technique. Utile en
maintenance, sans effet sur une décision.

## E.2 Les points de décision, écrits d'avance

- **À 30 jours** : si aucune vente n'a été tentée, ce n'est pas le plan qui est
  faux, c'est l'appétence pour le métier de service. Il faut alors basculer
  explicitement sur l'Option 2 et en accepter l'horizon.
- **À 90 jours** : cinq séjours vendus valident l'Option 1 et ouvrent la
  question de l'outillage transactionnel — pas avant. Zéro séjour malgré des
  tentatives réelles signifie que le problème est l'offre, pas le canal.
- **À 90 jours** : zéro citation LLM sur les 30 prompts enterre l'Option 3.
  Des citations sans aucune demande entrante l'enterrent aussi, plus lentement.

## E.3 Ce qui doit rester vrai en permanence

- Zéro affirmation factuelle non vérifiable publiée sous la signature de
  l'agence.
- Zéro page légale incomplète en ligne.
- Zéro promesse de réservation, de prix ou de disponibilité tant que le
  transactionnel n'est pas réellement opéré.

## E.4 Journal

Une entrée par session : ce qui a été fait, ce qui a été mesuré, ce qui a été
appris, ce qui bloque et sur qui. C'est le journal — pas les plans — qui permet
de reprendre en dix minutes.

- **2026-08-02 — Cadrage à blanc.** Reprise après un mois d'arrêt (dernier
  commit 2026-07-03). Constat d'inventaire : le seul actif rare (accréditation
  IATA) est gelé, l'actif abondant (contenu) absorbe tout l'effort, aucun
  client n'a jamais été rencontré en un an. Thèse « le contenu d'abord, le
  revenu ensuite » remise en cause, trois options posées, Option 1
  (service-led) recommandée. En attente de trois décisions PO : données
  légales, choix entre les trois options, territoire de référence.

---

## Les cinq décisions à prendre

Ce cadrage n'engage rien tant que ces cinq points ne sont pas tranchés. Les
quatre premiers n'appartiennent qu'au fondateur.

1. **Les données légales** — fournies cette semaine, ou la page sort du footer.
2. **L'option retenue** — service d'abord, média de niche, ou maintien de la
   thèse actuelle en connaissance de cause.
3. **Le territoire de référence** — le périmètre sur lequel on accepte d'être
   jugé.
4. **L'appétence pour le métier de service** — vendre des séjours est un métier
   de relation. Si ça ne t'intéresse pas, il faut le dire maintenant : ça
   change tout le cadrage.
5. **Le sort du catalogue** — indexé, partiellement désindexé, ou dépublié.
