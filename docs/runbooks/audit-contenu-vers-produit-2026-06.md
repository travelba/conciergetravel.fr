# Audit « du contenu au produit » — 2026-06-17

> Demandé par le PO avant de décider du périmètre du master plan. Question :
> **entre « le site éditorial est fini » et « le produit encaisse + le
> concierge WhatsApp tourne », qu'est-ce qui manque exactement ?**
>
> Tout est sourcé dans le code (deux passes d'exploration `explore`,
> 2026-06-17). Statuts repris du framework d'inventaire :
> **WIRED** (construit + branché public) · **FLAG** (construit, derrière un
> flag/`booking_mode`, off par défaut) · **SCRIPT** (existe seulement en
> script d'expérimentation) · **ABSENT**.

## 1. Les deux lignes d'arrivée (ne pas les confondre)

| Ligne                                                | Définition                                                                                                | Le master plan actuel la vise ?     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **L1 — Site éditorial qui génère des leads**         | 2221 fiches niveau Gordes + lieux + classements + guides + surface GEO/agent + capture de leads concierge | ✅ Oui (Cap A)                      |
| **L2 — Produit qui encaisse + concierge qui tourne** | L1 + réservation en ligne avec paiement réel + concierge WhatsApp proactif post-réservation               | ❌ Non (gelé par décision `frozen`) |

**Réponse courte : le master plan livre L1, pas L2.** Ce document détaille la
distance réelle entre les deux.

## 2. Carte par couche (du contenu vers l'encaissement)

### Couche A — Contenu éditorial (le cœur de L1)

| Brique                             | Statut                  | Ce qui manque pour « fini »                                                                             |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Catalogue publié (2221)            | WIRED                   | — (publié au gate Phase-1)                                                                              |
| **Fiches au niveau Gordes**        | **partiel**             | **C'est R2** : ~42 % de fuites scaffolding (audit R0), pass-rate au gate cible ≈ 0 %. Le gros chantier. |
| Lieux / POI (visit/do)             | WIRED (data + `/lieux`) | RLIEUX : structurer partout + maillage + `geo_qa`                                                       |
| Restaurants **autour** (`eat`)     | partiel                 | Bucket existe mais non alimenté (food exclue du sourcing `places`, « TheFork = futur »)                 |
| `geo_qa`                           | ABSENT (générateur)     | Aucun pipeline ne le produit (seul l'audit le contrôle)                                                 |
| Classements / guides / itinéraires | WIRED (partiel)         | RCLASS / R3bis / R2bis                                                                                  |

→ **« Éditorial fini » ≠ état actuel.** Il faut encore R2 + RLIEUX + RCLASS +
le générateur `geo_qa`. C'est le plus gros morceau de L1.

### Couche B — Capture de leads (le pont trafic → revenu)

| Brique                                     | Statut        | Ce qui manque                                                              |
| ------------------------------------------ | ------------- | -------------------------------------------------------------------------- |
| Demande concierge par email (depuis fiche) | **WIRED**     | — (`booking_requests_email` + Brevo, rate-limit, idempotency)              |
| `/compte` liste les demandes               | WIRED         | —                                                                          |
| **Formulaire `/le-concierge/contact`**     | **FLAG/stub** | Form désactivé ; `/api/agent/contact` en dry-run (pas de Brevo, pas de DB) |
| Newsletter / MICE                          | stub          | Formulaires désactivés ; endpoint newsletter en `dryRun`                   |
| Table `contact_requests`                   | ABSENT        | À créer (migration)                                                        |
| Triage CRM back-office                     | ABSENT        | Aucune collection Payload de leads                                         |

→ Un **vrai** chemin de lead existe déjà (demande email depuis une fiche).
Ce qui manque = R1.5 : le funnel **contact général** + persistance + triage.

### Couche C — Contenu « consommable par le concierge / agent »

| Brique                                               | Statut         | Ce qui manque                                               |
| ---------------------------------------------------- | -------------- | ----------------------------------------------------------- |
| `/api/agent/concierge-tip/[slug]`                    | WIRED          | —                                                           |
| `/api/agent/places-nearby`                           | WIRED          | Renvoie places canoniques visit/do seulement                |
| `/api/agent/hotel/[slug]`                            | WIRED (maigre) | **N'expose ni dining, ni POI, ni expériences, ni `geo_qa`** |
| Endpoint reco « dining / expériences / post-séjour » | ABSENT         | À créer (une donnée, N surfaces)                            |

→ Le concierge WhatsApp (et les LLM) ne peuvent pas, via l'API, recommander
un restaurant à réserver ni une expérience. C'est la lentille à replier dans
la DoD (cf. §4).

### Couche D — Transaction / encaissement (le cœur de L2)

| Brique                                                          | Statut          | Ce qui manque pour encaisser réellement                     |
| --------------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
| Adaptateurs GDS (Amadeus/Travelport/RateHawk/GIATA/Little)      | FLAG / SCRIPT   | Câblage public réel + activation (off par défaut)           |
| Comparateur prix Makcorps                                       | WIRED           | — (non transactionnel)                                      |
| Machine à états booking + drafts Redis                          | BUILT (domaine) | —                                                           |
| Création de commande GDS en prod                                | FLAG (stub)     | Seul Travelport sandbox tape une vraie API, sous flag       |
| Routes `/results`, `/checkout`                                  | ABSENT          | À créer                                                     |
| **Paiement (Stripe / Amadeus Payments, 3DS, Apple/Google Pay)** | **ABSENT**      | Tout : provider réel, iframe, webhook, PCI/3DS2             |
| Idempotency tunnel payé                                         | partiel         | Pas de dédup Redis sur le tunnel payé                       |
| `Offer` / `priceValidUntil` JSON-LD                             | FLAG            | Émis seulement si tarif live ; absent pour les ~2200 fiches |

→ **Encaisser = chantier majeur** : provider de paiement réel + commande GDS
live + routes funnel + conformité PCI/3DS. Aujourd'hui : squelette + stubs.

### Couche E — Concierge WhatsApp qui tourne (l'autre moitié de L2)

| Brique                                        | Statut             |
| --------------------------------------------- | ------------------ |
| Adaptateur WhatsApp (`packages/integrations`) | ABSENT             |
| Webhook entrant + vérif signature             | ABSENT             |
| Scheduler de _journey_ + tables `whatsapp_*`  | ABSENT             |
| Opt-in à la réservation                       | ABSENT             |
| Templates HSM approuvés Meta                  | ABSENT             |
| Réponse LLM _grounded_ (endpoint reco)        | dépend de Couche C |

→ **0 % runtime.** Dépend du cycle réservation (Couche D) pour les _triggers_
et de la Couche C pour le _grounding_.

### Couche F — Transverses go-live

| Brique                                                                     | Statut              | Note                                                   |
| -------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------ |
| Conformité légale (mentions, Atout France IM, garantie financière, RC pro) | bloqué              | Données PO requises — bloque l'indexation des mentions |
| Sentry spans sur appels vendors                                            | ABSENT              | Règle observability non appliquée au booking           |
| Soumission GSC / sitemap 2221                                              | à faire             | Phase 5                                                |
| Multilingue V2/V3 (DE/ES/IT, AR/ZH/JA)                                     | ABSENT              | Optionnel pour L1/L2                                   |
| App mobile (Expo)                                                          | ABSENT (skill seul) | Hors L1/L2                                             |
| Club / loyalty / facturation Stripe                                        | ABSENT              | Lié à la Couche D                                      |

## 3. La distance réelle, résumée

- **Pour atteindre L1** (le Cap A, ce que le plan vise) : finir **A** (R2 +
  RLIEUX + RCLASS + `geo_qa`), **B** (R1.5 funnel + table + triage), **C**
  (surface agent enrichie), et débloquer **F-légal**. C'est gros mais
  **entièrement à ta main** (pas de dépendance paiement/réglementaire forte).
- **Pour atteindre L2** (produit complet) : tout L1 **plus** **D** (paiement
  réel + commande GDS live + funnel + PCI/3DS) **plus** **E** (runtime
  WhatsApp complet). Ces deux couches sont **lourdes, risquées et
  réglementées** (PCI, DSA, RGPD, qualité Meta), et **D est un préalable à E**
  (les _triggers_ WhatsApp viennent du cycle réservation).

## 4. Ce qui change dans le plan, quelle que soit la décision

Indépendamment de viser L1 ou L2, deux ajouts sont justifiés dès maintenant
car ils évitent de reconstruire le contenu plus tard :

1. **DoD « concierge-consumable »** (Couche C) : un objet n'est fini que si
   dining/POI/expériences/conseil sont **requêtables via l'API agent**, pas
   seulement rendus en HTML. → check `gate1.agent_consumable` dans
   `wave-gates.ts` + élargir `/api/agent/hotel/[slug]`.
2. **Nommer les sous-chantiers manquants de RLIEUX** : restaurants `eat`
   nearby + **générateur `geo_qa`** (aujourd'hui non outillé).

## 5. Décision demandée au PO

- **Option Cap A (statu quo)** : viser **L1**. Booking + WhatsApp restent les
  dernières briques, plus tard. Le plan est déjà aligné ; on ajoute juste §4.
- **Option L2 planifiée** : ajouter une **Phase 6 « activation »** explicite
  (paiement → commande GDS live → puis WhatsApp), séquencée après L1, avec ses
  préalables réglementaires (PCI/3DS, DSA, RGPD, opt-in, templates Meta).
- **Option produit total** : L2 + multilingue + mobile + Club/Stripe.

Recommandation : **finir L1 d'abord** (revenu via leads, GEO, zéro risque
réglementaire), en repliant la lentille concierge (§4) pour que L2 soit
« activable » sans reprise du contenu — puis décider de la Phase 6.
