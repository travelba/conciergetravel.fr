# Addendum partenariat hôtelier — Le Concierge Club

> Brouillon d'addendum à insérer dans le **contrat commercial** signé
> avec chaque hôtel partenaire de **My Concierge Travel SAS**.
>
> ⚖️ **À valider par le cabinet juridique** avant signature. Les sections
> marquées `⚖️ TODO LEGAL` exigent une arbitration explicite.
>
> Skills : [`membership-program`](../../.cursor/skills/membership-program/SKILL.md),
> [`loyalty-program`](../../.cursor/skills/loyalty-program/SKILL.md).
> ADR : [ADR-0019](../adr/0019-le-concierge-club-architecture.md) +
> [ADR-0020](../adr/0020-sea-member-pricing-constraints.md).

## Article 1 — Objet

Le présent addendum complète le contrat commercial signé entre
**My Concierge Travel SAS** (ci-après « **My Concierge Travel** » ou
« l'**OTA** ») et **\[Nom de l'établissement\]** (ci-après « l'**Hôtel** »)
en précisant les modalités d'éligibilité au programme de fidélité
**Le Concierge Club** et à son tier payant **Le Concierge Club Prestige**.

## Article 2 — Éligibilité de l'hôtel

L'Hôtel est référencé au catalogue Le Concierge Club sur décision
éditoriale de My Concierge Travel. Cette éligibilité ne crée aucune
obligation commerciale pour l'Hôtel : le référencement est gratuit et
n'implique ni cotisation, ni commission additionnelle au-delà de la
commission contractuelle habituelle.

L'Hôtel est libre de proposer ou non des avantages spécifiques aux
membres du Concierge Club. L'absence d'avantage hôtel-spécifique ne
remet pas en cause l'éligibilité du référencement.

## Article 3 — Avantages hôtel-spécifiques (optionnels)

### 3.1. Liste contractuelle

Si l'Hôtel souhaite enrichir l'expérience des membres, il peut proposer
tout ou partie des avantages listés ci-dessous. La liste est exhaustive ;
toute extension nécessite un avenant.

| Code d'avantage          | Description                                                                    | Coût opérationnel typique        |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------- |
| `breakfast_included`     | Petit-déjeuner offert ou inclus dans le tarif membre                           | ⚖️ TODO LEGAL — TVA applicable ? |
| `late_checkout`          | Départ tardif jusqu'à 14h00 sur demande, sous réserve de disponibilité         | Nul                              |
| `early_checkin`          | Arrivée anticipée à partir de 12h00 sur demande, sous réserve de disponibilité | Nul                              |
| `room_upgrade`           | Sur-classement gratuit selon disponibilité                                     | Coût d'opportunité               |
| `welcome_amenity`        | Attention de bienvenue (champagne, fleurs, fruits, etc.)                       | À chiffrer par l'Hôtel           |
| `spa_credit`             | Crédit spa de \[montant\] € par séjour                                         | À chiffrer par l'Hôtel           |
| `dining_credit`          | Crédit restaurant de \[montant\] € par séjour                                  | À chiffrer par l'Hôtel           |
| `concierge_introduction` | Introduction personnalisée par notre Concierge avant l'arrivée                 | Nul                              |
| `priority_reservation`   | Priorité sur les réservations restaurant / spa                                 | Nul                              |

### 3.2. Conditions d'engagement

L'Hôtel s'engage à honorer les avantages spécifiquement listés à
l'Annexe A du présent addendum dans les conditions suivantes :

- L'avantage est offert **uniquement aux membres connectés** (vérifié
  via l'API de réservation côté OTA — Phase 6).
- L'avantage est soumis à la **disponibilité opérationnelle** de
  l'Hôtel au moment du séjour (notamment les sur-classements et les
  check-in / check-out anticipés ou tardifs).
- L'Hôtel s'engage à signaler à l'OTA toute **modification ou
  suspension** de l'avantage avec un préavis minimal de **15 jours**.
- L'OTA s'engage à mettre à jour ses interfaces (fiche hôtel,
  confirmation de réservation, e-mails) dans un délai de **48 heures**
  ouvrées suivant la notification.

### 3.3. Affichage et non-engagement (Phase 1)

En Phase 1 (avant activation du connecteur Amadeus + Little API),
l'OTA n'affiche **pas** d'avantage hôtel-spécifique sur la fiche
publique. Le visiteur voit le **catalogue maximaliste** des avantages
_possibles et probables_ du Concierge Club, avec un disclaimer
indiquant que la liste effective sera affichée au membre dès qu'il
sera connecté.

En conséquence, en Phase 1, l'Hôtel **n'est pas engagé** à honorer
un avantage qui n'aurait pas été explicitement confirmé par l'OTA dans
le bon de réservation.

En Phase 6, l'affichage devient personnalisé et l'engagement hôtelier
suit l'Annexe A actualisée.

## Article 4 — Tarifs membres (Phase 6 uniquement)

Le tier **Prestige** prévoit l'application d'un **tarif négocié**
différent du tarif public, applicable aux membres connectés ayant
souscrit à l'abonnement annuel.

L'Hôtel et l'OTA conviendront, par avenant signé avant le 1ᵉʳ jour du
trimestre suivant le lancement Phase 6, du périmètre tarifaire éligible
au tarif membre Prestige (ex : -5% sur l'ARI public hors offres
flash). L'OTA s'engage à respecter la **parité tarifaire négociée**
sur tous ses canaux et à ne pas afficher de tarif membre inférieur à
celui contractualisé avec l'Hôtel.

⚖️ **TODO LEGAL** — vérifier la conformité au regard de l'arrêté
Macron 2015 sur la parité tarifaire (la clause de parité étroite reste
autorisée en France ; la clause de parité large est interdite). La
formulation ci-dessus respecte la parité étroite.

## Article 5 — Communication et marketing

### 5.1. Engagements de l'OTA

L'OTA s'engage à :

- Ne pas afficher publiquement (sans connexion) d'avantage tarifaire
  inférieur au prix public communiqué par l'Hôtel.
- Ne pas utiliser de fausses urgences (« X personnes consultent », «
  stock restant ») sans signal Amadeus `LimitedAvailability` réel.
- Respecter strictement les règles ADR-0020 dans toute campagne SEA /
  paid social mentionnant les avantages du Concierge Club.
- Communiquer toute campagne marketing mentionnant l'Hôtel à l'équipe
  commerciale de l'Hôtel au moins **7 jours** avant le lancement.

### 5.2. Engagements de l'Hôtel

L'Hôtel s'engage à :

- Maintenir la cohérence des descriptifs (chambres, services,
  politiques) communiqués à l'OTA et à ses autres distributeurs.
- Notifier l'OTA dans les 48 heures de tout changement substantiel
  (rénovation, modification des politiques, etc.).
- Ne pas dénigrer le programme Concierge Club dans sa propre
  communication ; un dialogue commercial est privilégié en cas de
  désaccord.

## Article 6 — Données personnelles

L'OTA agit en qualité de responsable de traitement des données des
membres du Concierge Club. L'Hôtel est responsable de traitement des
données nécessaires à l'exécution du séjour. Les données transmises
par l'OTA à l'Hôtel via le canal de réservation contractuel
(Little Hotelier, Amadeus, e-mail) se limitent au strict nécessaire
à l'exécution du séjour (nom, prénom, dates, préférences exprimées).

Le statut « membre Concierge Club » peut être transmis à l'Hôtel
sous forme d'attribut booléen pour permettre l'application des
avantages. Aucune autre donnée du compte membre (historique, segments
marketing, etc.) n'est partagée.

## Article 7 — Durée et résiliation

Le présent addendum entre en vigueur à la date de signature et reste
applicable tant que le contrat commercial principal est en vigueur.
Chaque partie peut résilier l'addendum sans résilier le contrat
principal, moyennant un préavis de **60 jours** notifié par e-mail
à l'adresse contractuelle de l'autre partie.

## Article 8 — Litiges

Tout litige relatif au présent addendum sera réglé selon les
modalités prévues au contrat commercial principal.

---

## Annexe A — Avantages choisis par l'Hôtel

> _À compléter et signer par l'Hôtel. Cocher chaque avantage que
> l'Hôtel souhaite offrir aux membres connectés._

- [ ] `breakfast_included` — Petit-déjeuner offert.
- Modalités : ⚖️ TODO HÔTEL (ex : « offert le 1ᵉʳ matin uniquement », « pour 2 personnes max », etc.)
- [ ] `late_checkout` — Départ tardif 14h00.
- [ ] `early_checkin` — Arrivée anticipée 12h00.
- [ ] `room_upgrade` — Sur-classement.
- [ ] `welcome_amenity` — Attention de bienvenue.
- Description : ⚖️ TODO HÔTEL
- [ ] `spa_credit` — Crédit spa.
- Montant par séjour : ⚖️ TODO HÔTEL
- [ ] `dining_credit` — Crédit restaurant.
- Montant par séjour : ⚖️ TODO HÔTEL
- [ ] `concierge_introduction` — Introduction Concierge.
- [ ] `priority_reservation` — Priorité réservations internes.

---

> **Version** : 1.0
> **Date d'entrée en vigueur** : ⚖️ TODO LEGAL
> **Dernière mise à jour** : 2026-05-26
