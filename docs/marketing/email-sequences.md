# Email lifecycle — Le Concierge Club (Brevo)

**Statut**: Brief de lancement Sprint 4.
**Plateforme**: Brevo (anciennement Sendinblue), template engine MJML.
**Skill associé**: `.cursor/skills/email-workflow-automation/SKILL.md`.

Ce document définit les **5 séquences email Brevo** qui supportent la
phase 1 de Le Concierge Club. Toutes les automations s'appuient sur
l'événement `club_signup_completed` capté côté serveur dans
`apps/web/src/server/auth/actions.ts` puis envoyé à Brevo via
`packages/integrations/brevo`.

> **Garde-fous transverses**
>
> 1. **RGPD** : tout email transactionnel ou marketing s'appuie sur la
>    `consent_marketing` capturée à l'inscription (`true` obligatoire pour
>    les séquences 2 à 5). La séquence 1 (transactionnelle, confirmation
>    d'inscription) ne nécessite pas de consentement marketing.
> 2. **Voix Concierge** (ADR-0011) — sentences ≤ 25 mots, aucune urgence
>    fabriquée, jamais d'emoji dans les subject lines.
> 3. **Désinscription** : un lien `unsubscribe` Brevo natif obligatoire en
>    pied de chaque email (`{{ params.unsubscribe }}`).
> 4. **A/B testing** Sprint 5 — séquences 1 + 3 + 5 audités sur l'OR
>    (open rate cible ≥ 35%) et le CTR (cible ≥ 8%). Aucun email pivot ne
>    part avant Sprint 5 GO/NO-GO.

---

## Séquence 1 — Confirmation d'inscription Le Concierge Club (J+0)

| Paramètre           | Valeur                                              |
| ------------------- | --------------------------------------------------- |
| Trigger             | Event `club_signup_completed` (Brevo Conversations) |
| Délai               | Immédiat (< 30 s après inscription)                 |
| Type                | Transactionnel                                      |
| Template id (Brevo) | À créer `template-club-signup-confirmation`         |
| Locale              | FR / EN (split sur `params.locale`)                 |
| Désabonnable        | Non (transactionnel)                                |

**Subject (FR)** : `Bienvenue au Concierge Club, {{ params.firstName }}`
**Subject (EN)** : `Welcome to The Concierge Club, {{ params.firstName }}`

**Pré-header (FR)** : `Votre compte est actif. Voici ce que vous y trouvez.`
**Pré-header (EN)** : `Your account is live. Here is what you get inside.`

**Contenu (FR — copy de référence) :**

```
Bonjour {{ params.firstName }},

Le Concierge Club vient de s'ouvrir pour vous. C'est simple :

- Vos réservations et vos demandes sont centralisées dans votre tableau
  de bord — {{ params.dashboard_url }}.
- Une newsletter mensuelle vous arrivera, sélectionnée par notre
  Concierge — pas par un algorithme.
- Quand Prestige ouvrira ses portes (essai gratuit 30 jours), vous
  serez contacté en priorité.

Vous restez libre. Aucun engagement, aucune carte demandée. Vous pouvez
quitter le Club en un clic depuis votre compte.

À très bientôt,
Le Concierge
```

**Variables Brevo injectées** :

- `params.firstName`, `params.dashboard_url`
- `params.unsubscribe` (auto-inject Brevo, transactionnel = footer
  minimaliste mais lien présent)

**Validation** :

- Pas d'image (un email transactionnel hyper-léger pour passer Gmail
  Promotions sans drama).
- DKIM + SPF + DMARC vérifiés sur le domaine `myconciergehotel.com`.

---

## Séquence 2 — Découverte programme (J+2)

| Paramètre           | Valeur                                          |
| ------------------- | ----------------------------------------------- |
| Trigger             | `club_signup_completed` + délai 2 jours         |
| Type                | Marketing (requiert `consent_marketing = true`) |
| Template id (Brevo) | `template-club-discovery`                       |
| Locale              | FR / EN                                         |

**Subject (FR)** : `Le Concierge Club — un programme sobre. Voici comment l'utiliser.`
**Subject (EN)** : `The Concierge Club — a sober programme. Here is how to use it.`

**Contenu (FR)** :

```
Bonjour {{ params.firstName }},

Vous avez rejoint Le Concierge Club il y a 48 heures. Une question
revient souvent à ce stade : "À quoi ça sert, concrètement ?"

Voici les trois usages que nos membres apprennent à utiliser :

1. Le dashboard — vous y retrouvez vos favoris, vos demandes en cours
   et l'historique des conversations avec notre Concierge.
   {{ params.dashboard_url }}

2. La newsletter mensuelle — une sélection de Palaces, d'itinéraires
   et de conseils opérationnels que les comparateurs n'indexent pas.
   La prochaine arrive début {{ params.next_month }}.

3. Le bouton "Demander au Concierge" sur chaque fiche hôtel — le
   moyen le plus court pour réserver une chambre signature ou une
   suite que les agrégateurs n'ouvrent jamais.

Pas d'urgence. Le Club s'utilise à votre rythme.

À très bientôt,
Le Concierge

PS : si vous voulez supprimer votre compte, c'est ici :
{{ params.account_settings_url }}
```

---

## Séquence 3 — Inspiration éditoriale (J+7)

| Paramètre           | Valeur                                  |
| ------------------- | --------------------------------------- |
| Trigger             | `club_signup_completed` + délai 7 jours |
| Type                | Marketing                               |
| Template id (Brevo) | `template-club-editorial-tease`         |
| Locale              | FR / EN                                 |

**Subject (FR)** : `Trois adresses que le Concierge garde sous le coude`
**Subject (EN)** : `Three addresses the Concierge keeps in reserve`

**Contenu (FR)** :

Sélection éditoriale dynamique = 3 hôtels Palaces tirés du catalogue
(rotation hebdomadaire). Utiliser le query `top-50 P0 published hotels`
de la table `hotels` avec ordre random sur la semaine ISO.

Format proposé pour chaque hôtel (≤ 100 mots) :

- **{Hotel name}** — {city}, {region}
- {Excerpt 60-90 mots — extrait du `factual_summary` enrichi `description_fr`}
- Lien : `Lire la fiche complète →` (URL `/fr/hotel/<slug>`)

**Garde-fous** :

- Ne jamais inclure un hôtel sans `conseil_enrichi` validé (status =
  `approved`).
- Ne jamais hyperboler ("incroyable", "magique", "sublime") — voix
  Concierge, sobre.

---

## Séquence 4 — Annonce Prestige (J+30, conditionnelle)

| Paramètre           | Valeur                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Trigger             | Filtre Brevo : `consent_marketing = true` ET signup ≥ 30 jours ET `is_on_prestige_waitlist = false`   |
| Type                | Marketing                                                                                             |
| Template id (Brevo) | `template-club-prestige-tease`                                                                        |
| Locale              | FR / EN                                                                                               |
| Garde-fou           | **Ne pas envoyer si Phase 6 n'est pas active** (vérification env `MCH_PRESTIGE_LAUNCH_DATE_SET=true`) |

**Subject (FR)** : `Prestige ouvre ses portes — essai 30 jours offert`
**Subject (EN)** : `Prestige is opening — 30-day free trial`

**Contenu (FR)** :

```
Bonjour {{ params.firstName }},

Prestige ouvre ses portes le {{ params.prestige_launch_date }}.

C'est la deuxième moitié du Concierge Club : l'ensemble des
avantages négociés avec nos hôtels Little partenaires sont activés
sur votre compte (petit-déjeuner, surclassement, crédit hôtel, late
check-out, cadeau de bienvenue, WhatsApp Concierge).

Tarif : 99 € par an. Essai gratuit 30 jours, annulation en un clic.

Pour rejoindre la liste d'attente (vous serez contacté en premier au
lancement) :
{{ params.prestige_waitlist_url }}

Pas d'engagement tant que vous n'activez pas votre essai.

Le Concierge
```

**Phase 1 fallback** :
Si Phase 6 n'est pas active, cette séquence reste désactivée dans
Brevo (status `Draft`). Sprint 4 livre seulement le template + la
condition d'envoi.

---

## Séquence 5 — Réveil membre inactif (J+90)

| Paramètre           | Valeur                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Trigger             | `consent_marketing = true` ET dernière connexion ≥ 90 jours ET dernière ouverture email ≥ 60 jours |
| Type                | Marketing                                                                                          |
| Template id (Brevo) | `template-club-reactivation`                                                                       |
| Locale              | FR / EN                                                                                            |
| Fréquence           | Une seule fois par membre (Brevo flag `reactivation_sent_at`)                                      |

**Subject (FR)** : `Vous voyagez encore avec nous, {{ params.firstName }} ?`
**Subject (EN)** : `Still travelling with us, {{ params.firstName }}?`

**Contenu (FR)** :

```
Bonjour {{ params.firstName }},

Je vous écris parce que je ne vous ai pas vu depuis quelques mois.

Si Le Concierge Club ne vous est plus utile, vous pouvez désactiver
votre compte en un clic — {{ params.account_settings_url }}. Aucune
explication n'est demandée.

Si vous préférez juste réduire la fréquence des emails, c'est ici :
{{ params.email_preferences_url }}.

Et si vous avez un projet de séjour en suspens — Palaces parisiens,
Côte d'Azur, vignobles, Alpes — répondez simplement à cet email. Je
m'en occupe.

Le Concierge
```

**Garde-fous** :

- Ne pas relancer un membre qui s'est déjà désinscrit.
- Ne jamais utiliser de relance d'inactivité avec menace de
  suppression automatique en Phase 1 (interdit par CNIL pour les
  comptes gratuits sans engagement contractuel).
- Le lien `email_preferences_url` doit pointer vers `/compte/preferences`
  (à créer Sprint 5 si non existant).

---

## Implémentation technique

### Côté code (Sprint 4 livre les hooks, Sprint 5 livre les templates Brevo)

1. **Trigger d'événement** : étendre
   `apps/web/src/server/auth/actions.ts` pour pousser un événement Brevo
   à chaque inscription validée (envoi via
   `packages/integrations/brevo/events.ts` à créer Sprint 4.5).
2. **Variables dynamiques** : injecter `firstName`, `dashboard_url`
   (`/fr/compte`), `account_settings_url` (`/fr/compte/parametres`),
   `prestige_waitlist_url` (`/fr/le-concierge-club/prestige`),
   `next_month` (computed FR/EN).
3. **Brevo Lists** : créer 2 lists dédiées :
   - `club_members_fr` (= tous les membres `locale = 'fr'` opt-in)
   - `club_members_en` (= tous les membres `locale = 'en'` opt-in)
4. **Idempotency** : tous les events portent une `idempotencyKey` =
   `club:signup:<user_id>` (Redis 7j) pour éviter le double-déclenchement
   en cas de retry réseau.
5. **Observability** : chaque envoi déclenche un log structuré pino
   (`source: 'brevo'`, `template_id`, `delay_h`) — pas d'email PII en clair.

### Côté Brevo (Sprint 4 — manuel via UI)

1. Créer les 5 templates (`Marketing → Email templates → Create`).
2. Créer 5 automations (`Automations → Create scenario → From scratch`).
3. Configurer le trigger sur l'event `club_signup_completed`.
4. Activer le double opt-in pour la séquence 2 (FR : "Confirmez votre
   inscription à la newsletter du Concierge").
5. Tester chaque template avec 3 comptes de seed (`qa+club1@…`,
   `qa+club2@…`, `qa+club3@…`) avant publication.

## KPI à suivre (Sprint 5 dashboards)

- OR séquence 1 : ≥ 50% (transactionnel — confirmation attendue).
- OR séquence 2 (J+2) : ≥ 35%.
- OR séquence 3 (J+7) : ≥ 30%.
- CTR séquence 3 (clic sur une fiche hôtel) : ≥ 8%.
- Taux de désinscription cumulé séquences 2-5 : ≤ 5% sur 90 jours.
- % de réactivés post-séquence 5 (connexion dans les 30 jours) : ≥ 15%.

## Références

- `.cursor/skills/email-workflow-automation/SKILL.md`
- `packages/integrations/brevo/README.md`
- ADR-0011 — voix Concierge (subject lines + body copy).
- AGENTS.md §4ter — phasage Phase 6 (justifie le template Prestige en draft).
