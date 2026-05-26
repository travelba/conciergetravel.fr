# Conditions Générales d'Utilisation — Le Concierge Club

> Version 1.0 — applicable au lancement Phase 1 de **Le Concierge Club**.
>
> Ce document est un **brouillon de référence** pour la rédaction juridique
> finale. Il doit être revu par un cabinet d'avocats spécialisé en droit
> de la consommation + RGPD avant publication. Les sections marquées
> `⚖️ TODO LEGAL` exigent une décision explicite avant mise en ligne.
>
> Skills : [`membership-program`](../../.cursor/skills/membership-program/SKILL.md),
> [`security-engineering`](../../.cursor/skills/security-engineering/SKILL.md)
> §RGPD.
>
> ADR : [ADR-0019](../adr/0019-le-concierge-club-architecture.md) +
> [ADR-0020](../adr/0020-sea-member-pricing-constraints.md).

## Article 1 — Objet

Les présentes Conditions Générales d'Utilisation (« **CGU** ») régissent
l'inscription et l'usage du programme **Le Concierge Club**, programme
de fidélité gratuit édité par **My Concierge Travel SAS**, ainsi que de
sa version premium **Le Concierge Club Prestige** (lancement Phase 6,
hors périmètre Phase 1).

L'inscription au programme est gratuite et ne crée aucune obligation
d'achat. L'utilisation du programme reste soumise aux Conditions
Générales de Vente (« **CGV** ») applicables à toute réservation
effectuée via **myconciergehotel.com**.

## Article 2 — Éditeur du programme

- **Raison sociale** : My Concierge Travel SAS
- **Siège social** : ⚖️ TODO LEGAL — adresse officielle Atout France
- **RCS** : ⚖️ TODO LEGAL — numéro RCS Paris
- **Capital social** : ⚖️ TODO LEGAL
- **TVA intracommunautaire** : ⚖️ TODO LEGAL
- **Immatriculation Atout France** : ⚖️ TODO LEGAL — IM XXX XX XXXXX
- **Garantie financière** : ⚖️ TODO LEGAL — APST / Groupama / autre
- **Assurance RCP** : ⚖️ TODO LEGAL — Hiscox / autre
- **Directeur de la publication** : ⚖️ TODO LEGAL
- **Hébergeur** : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA
- **Contact** : `contact@myconciergehotel.com`

## Article 3 — Inscription et création de compte

### 3.1. Conditions d'éligibilité

L'inscription au Concierge Club est ouverte à toute personne physique
majeure (18 ans révolus) résidant dans un État membre de l'Union
européenne ou disposant d'une adresse de facturation valide dans un
pays accepté par notre prestataire de paiement (Phase 6 uniquement
pour Prestige).

### 3.2. Modalités d'inscription

L'inscription s'effectue exclusivement en ligne, depuis :

- la page `/compte/rejoindre` (formulaire e-mail + mot de passe + prénom optionnel),
- via une connexion fédérée Google ou Apple,
- via un lien magique envoyé par e-mail (`signInWithOtp`).

L'utilisateur doit confirmer son adresse e-mail en cliquant sur le lien
de validation reçu dans sa boîte mail dans un délai de 24 heures. Au-delà,
le compte est supprimé automatiquement (purge nightly).

### 3.3. Données collectées à l'inscription

- Adresse e-mail (obligatoire).
- Mot de passe (haché côté Supabase, jamais stocké en clair).
- Prénom (facultatif, utilisé dans les e-mails personnalisés).
- Locale préférée (déduite automatiquement de l'URL d'inscription).
- Consentement implicite à la newsletter mensuelle « Le Concierge ».

L'utilisateur peut se désinscrire de la newsletter à tout moment via
le lien présent dans chaque e-mail ou depuis son tableau de bord
`/compte`.

## Article 4 — Avantages du Concierge Club (Phase 1)

Le Concierge Club gratuit donne accès aux avantages suivants :

1. **Newsletter mensuelle** — sélection éditoriale de palaces et hôtels
   5 étoiles écrite par notre rédaction (voix Concierge, ADR-0011).
2. **Tableau de bord personnalisé** — historique des hôtels consultés,
   favoris, préférences voyage.
3. **Engagement de meilleur prix futur** — dès l'activation de notre
   connecteur Amadeus (Phase 6), les membres bénéficieront
   automatiquement des tarifs négociés sur l'inventaire éligible. Cet
   engagement ne constitue pas une promesse de prix immédiat.
4. **Newsletter Prestige (sur opt-in)** — annonce du lancement du tier
   Prestige et droit prioritaire d'essai 30 jours.

Le Concierge Club Prestige (Phase 6) ajoutera : tarifs membres
contractuellement négociés, surclassement sur demande quand possible,
conciergerie WhatsApp, et avantages hôtel-par-hôtel.

⚖️ **TODO LEGAL** — vérifier la conformité de l'« engagement de
meilleur prix futur » avec la jurisprudence DGCCRF (pratique commerciale
trompeuse si l'avantage n'est pas concret au moment de la souscription).
Option de repli : remplacer par « accès anticipé aux tarifs négociés
dès qu'ils seront disponibles ».

## Article 5 — Engagements de l'éditeur

- **Sécurité des données** : les mots de passe sont stockés hachés
  (bcrypt via Supabase Auth). Les sessions reposent sur des cookies
  HttpOnly + SameSite=Lax + Secure en production.
- **Disponibilité du service** : My Concierge Travel s'engage à un
  niveau d'effort raisonnable pour assurer la disponibilité du programme.
  Aucun SLA contractuel n'est offert sur le tier gratuit.
- **Communication marketing** : limitée à 1 newsletter mensuelle + 2
  e-mails transactionnels par inscription (confirmation + bienvenue
  J+3). L'utilisateur peut se désinscrire à tout moment.

## Article 6 — Engagements du membre

- Fournir des informations exactes lors de l'inscription.
- Maintenir la confidentialité de ses identifiants.
- Ne pas créer plusieurs comptes pour cumuler indûment les avantages
  (un compte par adresse e-mail).
- Ne pas utiliser le programme à des fins commerciales (revente,
  marketing tiers, scraping).

## Article 7 — Suspension et résiliation

### 7.1. Résiliation à l'initiative du membre

Le membre peut résilier son inscription à tout moment, sans frais ni
préavis, depuis son tableau de bord `/compte` (bouton « Supprimer mon
compte ») ou en envoyant une demande à `contact@myconciergehotel.com`.

La suppression du compte entraîne la suppression de toutes les données
personnelles associées dans un délai maximal de 30 jours, à l'exception
des données conservées pour des obligations légales (factures émises,
réservations passées : 10 ans).

### 7.2. Résiliation à l'initiative de My Concierge Travel

My Concierge Travel se réserve le droit de suspendre ou de résilier
un compte sans préavis en cas de :

- fraude avérée ou tentative de fraude,
- utilisation contraire aux présentes CGU ou aux CGV,
- comportement abusif envers le service client.

## Article 8 — Données personnelles et RGPD

L'éditeur agit en qualité de responsable de traitement. La politique
de confidentialité détaillée (« **Politique de confidentialité** ») est
accessible à l'adresse `/confidentialite` et complète les présentes CGU.

### 8.1. Bases légales

- Exécution du contrat (création et gestion du compte).
- Consentement (newsletter, cookies non essentiels, analytics).
- Intérêt légitime (sécurité, prévention de la fraude, observabilité
  anonymisée via Sentry — voir
  `apps/web/src/server/observability/club-events.ts` : aucun identifiant
  utilisateur en clair n'est transmis).

### 8.2. Droits du membre

Conformément aux articles 15 à 22 du RGPD, le membre dispose des
droits d'accès, de rectification, d'effacement, de portabilité, de
limitation et d'opposition. Ces droits s'exercent par e-mail auprès
de `dpo@myconciergehotel.com` ou via le tableau de bord `/compte`.

⚖️ **TODO LEGAL** — nommer un DPO si nécessaire (obligatoire si
traitement à grande échelle de données sensibles ; à valider avec le
cabinet RGPD).

### 8.3. Hébergement et transferts hors UE

- Données applicatives : Supabase (région `eu-west`, Dublin).
- Hébergement front-end : Vercel (région `cdg1`, Paris ; fallback
  international au sein du réseau Vercel Edge).
- Observabilité : Sentry (région UE — `region: 'de.sentry.io'`).
- E-mails transactionnels : Brevo (anciennement Sendinblue, Paris).

Aucun transfert de données personnelles hors UE n'est effectué dans
le périmètre Phase 1. Phase 6 ajoutera Stripe Inc. (Dublin via filiale
UE, mais traitement back-end aux USA — Clauses Contractuelles Types

- DPA Stripe).

## Article 9 — Propriété intellectuelle

Tous les contenus éditoriaux du Concierge Club (descriptions d'hôtels,
guides, classements, conseils du Concierge) sont protégés par le droit
d'auteur. Toute reproduction, même partielle, est interdite sans
autorisation écrite préalable.

Les marques « My Concierge Travel », « MyConciergeHotel », « Le
Concierge Club » et « Le Concierge Club Prestige » sont des marques
déposées de My Concierge Travel SAS.

## Article 10 — Modification des CGU

L'éditeur peut modifier les présentes CGU à tout moment. Toute
modification substantielle (réduction des avantages, modification des
règles de désinscription, changement du responsable de traitement)
sera notifiée par e-mail au moins 30 jours avant son entrée en
vigueur. Le membre dispose alors d'un droit de résiliation immédiate
sans frais.

## Article 11 — Médiation et droit applicable

### 11.1. Médiation

En cas de litige, le membre peut saisir gratuitement le médiateur
suivant :

- ⚖️ **TODO LEGAL** — désignation du médiateur compétent (Médiateur
  du Tourisme et du Voyage — MTV — pour une OTA luxe).
- Site : `www.mtv.travel`

### 11.2. Droit applicable et juridiction compétente

Les présentes CGU sont soumises au droit français. Tout litige
relatif à leur exécution ou à leur interprétation relève des
tribunaux français compétents, sous réserve des règles de protection
du consommateur applicables.

## Annexe — Glossaire

| Terme                                 | Définition                                                                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Concierge Club**                    | Programme de fidélité gratuit édité par My Concierge Travel SAS.                                                                                                           |
| **Prestige**                          | Tier payant du Concierge Club (Phase 6 uniquement).                                                                                                                        |
| **Avantage**                          | Service annexe (sur-classement, petit-déjeuner, late check-out, etc.) potentiellement éligible au membre, sous réserve de disponibilité côté hôtelier.                     |
| **Engagement de meilleur prix futur** | Promesse, dès activation du connecteur Amadeus, d'appliquer automatiquement les tarifs négociés sur l'inventaire éligible. Ne constitue pas une garantie de prix immédiat. |

---

> **Version** : 1.0
> **Date d'entrée en vigueur** : ⚖️ TODO LEGAL
> **Dernière mise à jour** : 2026-05-26
