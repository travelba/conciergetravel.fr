# SEA brief — Le Concierge Club (Phase 1)

**Statut**: Brief de lancement Sprint 4.
**Auteur(s)**: Marketing + Growth + Conformité.
**Approbations requises**: Direction, DPO (RGPD ciblage), responsable juridique
(conformité Google Ads + Hotel Center).

Ce brief définit les **4 campagnes Google Ads de lancement** pour Le
Concierge Club Phase 1. La Phase 6 ouvrira l'usage de Google Customer
Match + Hotel Center loyalty feed — pas avant.

> **Garde-fou conformité — Google Ads policies (mai 2026)**
>
> 1. Les tarifs membres / réservés à l'inscription ne peuvent pas être
>    annoncés en trafic froid. Phase 1 = aucune annonce ne mentionne un
>    prix membre, puisque le différentiel n'est pas activé. Phase 6 =
>    Customer Match uniquement (audience d'opt-in confirmé).
> 2. Les avantages exclusifs (petit-déjeuner, surclassement) annoncés
>    publiquement doivent être disponibles sans connexion préalable.
>    Phase 1 → on annonce uniquement les avantages "client connecté"
>    génériques (newsletter, prix bientôt négociés) ; jamais "petit-déj
>    gratuit" en headline trafic froid.
> 3. Les annonces "free" / "gratuit" exigent que le service complet
>    annoncé soit livrable gratuitement. Le Concierge Club est gratuit
>    — OK. Prestige est payant — interdit en headline "gratuit".

---

## Campagne 1 — Search Brand "Concierge Club" (acquisition directe)

| Paramètre             | Valeur                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| Objectif Google Ads   | Conversions (inscription Le Concierge Club)                              |
| Type                  | Recherche, Match Type = Phrase + Exact                                   |
| Budget mensuel cible  | €1 500 (testable jusqu'à €3 000 si CPL acceptable)                       |
| Géo                   | France métropolitaine + DOM-TOM. Phase 2 = Belgique, Suisse francophone. |
| Langue                | FR uniquement (EN gérée par campagne séparée).                           |
| Ciblage horaire       | 24/7 (programme zero-ops).                                               |
| Devices               | All — préférence mobile (≥ 65% du trafic catalogue).                     |
| Page d'atterrissage   | `/le-concierge-club` (canonique)                                         |
| Conversion principale | `club.signup.completed` (Sentry custom event, Sprint 5)                  |
| Conversion secondaire | `club.signup.started` (engagement)                                       |
| Conversion micro      | `club.benefits_viewed` (rétention SEA)                                   |

**Mots-clés (à valider Semrush avant build) :**

- `concierge club` (phrase, exact)
- `programme fidelite hotel luxe` (phrase)
- `myconciergehotel club` (exact — branded)
- `concierge club avantages` (phrase)
- `concierge club inscription` (phrase)
- `concierge club gratuit` (exact)

**Mots-clés négatifs (obligatoires) :**

- `petit-dejeuner gratuit hotel` (out — promesse non livrable Phase 1)
- `surclassement chambre garanti` (out — sub-availability réelle)
- `concierge medical`, `concierge dentaire`, `concierge dating` (out — sens hors-sujet)
- `concierge club booking`, `concierge club marriott`, `concierge club accor`
  (out — confusion concurrent)

**Annonces (responsive search) :**

- Headlines (15 maximum, 30 char chacun) — exemples :
  - `Le Concierge Club — gratuit`
  - `Adhésion sans CB ni engagement`
  - `Programme fidélité Palaces`
  - `Inscription en 30 secondes`
  - `Le concierge de votre hôtel`
- Descriptions (4 maximum, 90 char chacun) :
  - `Compte gratuit, newsletter mensuelle, avantages activés hôtel par hôtel. Sans CB.`
  - `Agence IATA spécialisée dans les Palaces et hôtels 5★ en France. Adhésion 30s.`

**Extensions :**

- Sitelinks → `/le-concierge-club#avantages`, `/le-concierge-club#faq`,
  `/le-concierge`, `/le-concierge/contact`.
- Callouts → "Sans CB", "Sans engagement", "Agence IATA", "Désinscription 1 clic".
- Structured snippet (Header = Services) → "Newsletter", "Avantages hôtel par hôtel",
  "Le Concierge Concierge".

**Garde-fous :**

- Affichage prix interdit en headline. Si Google suggère un prix automatique
  (Smart Bidding), désactiver dans Asset library.
- Aucun ad asset ne doit mentionner "petit-déjeuner inclus" tant que la
  table `hotel_member_benefits` n'a pas été peuplée par Little API
  (Phase 6).

---

## Campagne 2 — Search "Loyalty/membership intent" (cible non-marque)

| Paramètre           | Valeur                                                            |
| ------------------- | ----------------------------------------------------------------- |
| Objectif            | Conversions (inscription)                                         |
| Type                | Recherche, Match Type = Phrase only (jamais Broad sur ce cluster) |
| Budget mensuel      | €800 (test 30 jours, scale si CPL < €15)                          |
| Géo / Langue        | France métropolitaine, FR                                         |
| Page d'atterrissage | `/le-concierge-club`                                              |

**Mots-clés (intention loyalty hôtel, hors marque) :**

- `programme fidelite hotel`
- `carte membre hotel luxe`
- `club hotel france`
- `programme avantage hotel 5 etoiles`
- `loyalty palace france`

**Mots-clés négatifs :**

- `marriott bonvoy`, `accor all`, `hilton honors`, `ihg one rewards`,
  `wyndham rewards` (chaînes concurrentes — laisser à elles)
- `gratuit etoile`, `casino gratuit`, `forum gratuit`

**Annonces (responsive search) :**

- Headlines centrés sur le différentiel "indépendant + cumulable" :
  - `Indépendant des chaînes hôtelières`
  - `Cumulable avec Bonvoy, ALL…`
  - `Le Concierge Club — gratuit`
  - `Spécial Palaces et 5★ en France`
- Descriptions :
  - `Cumulable avec votre programme de chaîne. Sélection éditoriale Concierge. Sans CB.`
  - `Agence IATA. Tarifs nets GDS Phase 6. Avantages activés hôtel par hôtel.`

**Garde-fous :**

- Aucune comparaison directe nominative ("mieux que Bonvoy") — interdit
  par Google Ads + risque diffamation.
- Mention "cumulable" obligatoire pour éviter la confusion concurrent.

---

## Campagne 3 — Performance Max "Le Concierge Club" (multi-canal IA)

| Paramètre                       | Valeur                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| Objectif                        | Acquisition leads (signup)                                   |
| Type                            | Performance Max                                              |
| Budget mensuel                  | €2 000 (test 6 semaines, mesure incrementalité avant scale)  |
| Géo / Langue                    | France métropolitaine, FR                                    |
| Audience signals                | Audience custom "Voyageurs luxe France" (URL hôtels Palaces, |
| mots-clés guides Michelin, R&C) |
| Final URL expansion             | OFF — restreint à `/le-concierge-club` uniquement            |
| Page d'atterrissage             | `/le-concierge-club`                                         |

**Assets requis :**

- 5 images carrées (1:1) — visuels Palaces + interfaces dashboard. Pas de
  modèle iconique tiers sans contrat (Cheval Blanc, Royal Mansour…).
- 5 images paysage (1.91:1) — captures dashboard + extraits éditoriaux.
- 1 vidéo (16:9, 15-30 s) — voix off "le Concierge", pas de musique
  émotionnelle hype.
- 5 logos carrés + 1 logo paysage (Cloudinary `seo-logo-concierge-club`).
- 5 headlines courts (≤ 15 char), 5 longs (≤ 30 char), 5 descriptions (≤ 90 char).

**Garde-fous :**

- Désactiver "Display Network" si CPL > €25 sur 4 semaines (network display
  est volumétrique mais peu qualifié pour ce produit).
- Audit hebdomadaire des `Search terms` Performance Max — Google peut
  élargir vers du trafic non-pertinent (luxe non hôtelier).
- Suivi `club.signup.completed` Sentry obligatoire — Performance Max
  optimise sur la conversion remontée par GA4 + GAds tag, fausse
  l'attribution sans signal réel.

---

## Campagne 4 — YouTube Demand Gen "Le Concierge" (notoriété + reach)

| Paramètre           | Valeur                                       |
| ------------------- | -------------------------------------------- |
| Objectif            | Notoriété + vues vidéo                       |
| Type                | Demand Gen YouTube (ex-Discovery Ads)        |
| Budget mensuel      | €1 200 (test 8 semaines)                     |
| Géo / Langue        | France métropolitaine, FR                    |
| Format              | Skippable in-stream + Shorts (vertical 9:16) |
| Page d'atterrissage | `/le-concierge-club` ou `/le-concierge`      |

**Vidéo principale (30 s) — script à valider :**

> "Vous êtes du genre à choisir l'hôtel comme on choisit le restaurant.
> Nommé. Sans agrégateur. MyConciergeHotel.com rassemble les Palaces et
> les 5★ de France dans un guide écrit par votre Concierge. Adhésion
> gratuite, sans carte. Le Concierge Club ouvre ses portes."

**Vidéo Shorts (15 s, vertical) — script :**

> "Le programme fidélité indépendant pour les Palaces français. Le
> Concierge Club. Gratuit. Sans engagement."

**Garde-fous :**

- Pas de musique sous licence chargée — préférer banque libre de droits
  (Soundstripe, Artlist) avec preuve de licence.
- Voix off neutre, jamais commerciale (cohérence voix Concierge ADR-0011).
- Brand safety = "Standard" (jamais "Expanded inventory" — éviter contenu
  inapproprié type téléréalité).

---

## Conformité — checklist pré-lancement

- [ ] Identifiant Google Ads vérifié + lié à Search Console + GA4.
- [ ] Manager Account configuré avec utilisateurs limités (lecteur + créateur,
      jamais admin partagé).
- [ ] CMP (Cookiebot ou équivalent) configuré : pas de conversion sans
      consentement explicite (RGPD).
- [ ] GA4 et Tag Manager : event `club_signup_completed` rattaché à la
      conversion Google Ads via Enhanced Conversions (hashed email opt-in
      seulement).
- [ ] Aucun tarif membre / aucun "petit-déj gratuit" en headline trafic
      froid (audit ad assets avant `Enable`).
- [ ] Aucune extension produit (Hotel ads, Shopping) — Phase 6 uniquement.
- [ ] Disclaimer footer cookies : "MyConciergeHotel.com utilise des cookies
      Google Ads à des fins de mesure et de remarketing."

## Mesure & itération

- KPI primaire : **CPL** (€ / inscription Le Concierge Club).
  Cible Phase 1 = ≤ €12 (CAC viable même si Prestige LTV = €0).
- KPI secondaire : **rétention J+30** (% des inscrits qui ouvrent un email
  ou se reconnectent au compte).
- Audit hebdomadaire pendant 8 semaines : `Search terms report`,
  `Asset performance`, `Search impression share` sur les keywords brand
  (≥ 80% obligatoire).
- A/B testing Sprint 5 (3 expériences) — `club_cta_copy`,
  `club_signup_oauth_order`, `club_benefits_position`. Voir
  `docs/le-concierge-club/ab-testing-plan.md`.

## Phase 6 — extensions prévues

- **Google Customer Match** : sync quotidien depuis Supabase
  (`loyalty_members` opt-in marketing) → audience "Le Concierge Club —
  members confirmed". Permet remarketing tarifs membres + Prestige
  upsell.
- **Hotel Center loyalty feed** : déclaration du programme dans Hotel
  Center pour faire apparaître le tarif membre dans le Google Hotels
  module. Sous réserve d'audit légal interne (DGCCRF + DSA art. 25).
- Campagne 5 (Prestige) : ouverture du remarketing payant ciblant les
  inscrits Concierge Club inactifs depuis ≥ 60 jours.

## Références

- [Conformité Google Ads — Hotel ads](https://support.google.com/google-ads/answer/9259192)
- [Google Hotel loyalty pricing](https://support.google.com/hotelprices/answer/9264007)
- [DSA art. 25 — interfaces manipulatrices (rappel)](https://digital-strategy.ec.europa.eu/fr/policies/digital-services-act)
- AGENTS.md §4ter — Booking API integration is the LAST brick (justifie la
  Phase 6 sur Customer Match + Hotel Center).
