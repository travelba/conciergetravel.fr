# ADR 0019 — Architecture du programme Le Concierge Club

- Status: accepted
- Date: 2026-05-26
- Refs: [ADR-0005 loyalty premium deferred](0005-loyalty-premium-deferred.md), [ADR-0007 ISR auth island](0007-isr-via-auth-client-island.md), [ADR-0011 Concierge voice](0011-concierge-voice.md), [ADR-0017 agent endpoints](0017-agent-actionable-endpoints.md), rules `seo-geo`, `hotel-detail-page`, skills `loyalty-program`, `membership-program`

## Décision

Implémenter **Le Concierge Club** comme un programme de fidélité à
**deux tiers** :

1. **Le Concierge Club** — tier gratuit, sans CB, sans engagement.
   Activable en 30 secondes depuis `/compte/rejoindre`. Phase 1 = un
   compte + une newsletter + la promesse d'un tarif négocié à venir.
2. **Le Concierge Club Prestige** — tier payant `€99/an` avec essai
   gratuit 30 jours. Activation Phase 6 via Stripe Checkout. Liste
   d'attente ouverte Phase 1 depuis `/le-concierge-club/prestige`.

L'enum DB porte `'club' | 'prestige'` (migration `0057_loyalty_member_program.sql`).
Le pseudo-tier `'anon'` est une dérivation UI de l'absence de session,
jamais persistée en base.

Architecture validée par 6 sous-décisions verrouillées :

| #      | Décision                                                                            | Justification                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Perks-only Phase 1, aucune ligne "Tarif Club" tant que le prix membre = prix public | DGCCRF + DSA art. 25 : annoncer un tarif différencié inexistant = pratique commerciale trompeuse. Phase 6 active le différentiel via `member_price_differential` (table vide en Phase 1). |
| **D2** | Tout le contenu reste public et indexable                                           | Le membership n'achète pas de l'information mais une action (réserver à tarif négocié, recevoir des attentions opérationnelles). Cohérent avec la stratégie SEO/GEO du projet.            |
| **D3** | Vue anonyme maximaliste + disclaimer ; vue membre sur-mesure                        | Phase 1 = catalogue maximaliste affiché à tous, avec mention "selon disponibilité hôtel". Phase 6 = personnalisation par hôtel via sync Little API.                                       |
| **D4** | Free tier zero-ops                                                                  | Aucune ligne opérationnelle (pas de WhatsApp 24/7, pas de chat humain) sur le tier gratuit. WhatsApp Concierge réservé Prestige.                                                          |
| **D5** | Architecture éligibilité opt-in par hôtel                                           | Table `club_eligibility` (`is_eligible=true` + `addendum_signed_at` non null) côté Payload — un hôtel n'apparaît dans les bénéfices personnalisés que s'il a signé l'avenant.             |
| **D6** | Le programme = un `MemberProgram` JSON-LD canonique                                 | Émis sur `/le-concierge-club` et `/le-concierge-club/prestige` uniquement. Les fiches hôtel restent légères (Hotel + Place + Review[] + FAQPage…).                                        |

## Contexte

Avant cette décision, le projet exposait :

- Un programme "Essentiel / Prestige" mentionné dans `llms.txt` et
  `agent-skills.json` mais sans implémentation effective côté DB ni UI
  (ADR-0005 — loyalty premium deferred).
- Une page `/le-concierge/fidelite` rédigée comme une page éditoriale
  promesse, sans formulaire d'inscription rapide.
- Aucune surface réservant l'accès aux avantages aux membres
  authentifiés.

Le brief utilisateur du 25 mai 2026 fixe quatre exigences :

1. Inspiration Michelin Guide — prix public visible, prix membre + avantages
   réservés à l'inscription.
2. SEA conforme aux règles Google Ads (notamment Hotel Center loyalty
   rates).
3. Login frictionless (OAuth Google + Apple + magic links).
4. Contenu éditorial public — pas de gating éditorial.

## Alternatives considérées

**Alternative A — Tier unique gratuit (pas de Prestige)** : rejetée.
Sans tier payant, le programme reste un outil de capture sans levier de
revenu après les premiers semestres. Le SEA P&L exige un futur LTV
positif (Prestige = €99/an avec 6 % de conversion attendue).

**Alternative B — Tier unique payant (€99/an direct)** : rejetée.
Réduit la conversion top-of-funnel d'un facteur 8 sur les benchmarks
hôtellerie luxe (Mr & Mrs Smith Smith Heroes, Tablet Hotels Plus,
Conde Nast Traveler Concierge). Le tier gratuit est l'infrastructure
de capture sans laquelle Prestige n'a aucun reach.

**Alternative C — 3 tiers (Découverte / Concierge Club / Prestige)** :
rejetée. La granularité induit une fatigue décisionnelle sans
différenciation lisible. Michelin Guide opère lui-même un seul tier
gratuit (visible / membres) → standard du marché du voyage de luxe.

**Alternative D — Gating éditorial partiel (Conseil du Concierge réservé membres)** :
rejetée. Le `concierge_advice` (ADR-0011) est le différenciateur SEO/GEO
le plus fort du catalogue — le retirer du contenu public détruirait
l'EEAT et la citation par Perplexity / ChatGPT Search. Le membership
achète un service, jamais un accès.

## Conséquences

### Positives

- **Programme cohérent avec l'architecture existante** : pas de
  refonte de l'auth, réutilisation du `requireUser` helper, intégration
  dans le dashboard `/compte`.
- **SEO/GEO préservé** : contenu intégralement public, JSON-LD
  `MemberProgram` canonique, mises à jour `llms.txt` + `agent-skills.json`
  cohérentes.
- **Conformité Google Ads + DGCCRF + DSA** : aucun différentiel
  affiché en Phase 1, audit légal en Phase 6 avant ouverture Hotel
  Center loyalty rates feed.
- **Phasage propre** : Phase 1 = capture + promesse, Phase 6 = Stripe
  - Little API + personnalisation. Pas d'engagement irréversible avant
    Phase 6.
- **Zero-ops Phase 1** : pas de coût opérationnel WhatsApp/chat, le
  programme s'auto-finance par la newsletter mensuelle.

### Négatives

- **Coût LLM éditorial** : pipeline 4 passes (`conseil_enrichi`,
  `quartier`, `gastronomie`, `timing_acces`) × 443 hôtels publiés en
  Phase 1 — estimé 80-120 € via `gpt-4o-mini` (échelonné sur 2
  semaines).
- **Charge éditoriale humaine** : fact-check des top 50 hôtels avant
  ouverture SEA (Sprint 4, doc `fact-check-top-50-runbook.md`).
- **Risque CAC mal calibré Phase 1** : sans LTV mesurable avant
  Phase 6, le CPL Concierge Club doit rester ≤ €12 (cf.
  `docs/marketing/sea-le-concierge-club-brief.md`).
- **Dépendance Little API Phase 6** : si la sync Little Hotelier prend
  du retard, la personnalisation per-hôtel reste en mode "catalogue +
  disclaimer".

## Plan d'exécution

Détaillé dans `.cursor/plans/le_concierge_club_…plan.md` (8 sprints +
Phase 6 différée). Récapitulatif :

1. **Sprint 1** — Migration `0057_loyalty_member_program.sql` + domain
   `packages/domain/src/loyalty/` + auth refonte + Payload + Edge
   Config flags.
2. **Sprint 2** — Pipeline éditorial premium (4 passes LLM Tavily +
   Zod + tests).
3. **Sprint 2.5** — Pilote 5-10 hôtels + scoring 4 axes + gate Go/No-Go.
4. **Sprint 3a** — Génération massive 443 hôtels (parallèle 3b).
5. **Sprint 3b** — UI : `<ClubBenefitsBlock>` + pages programme +
   refonte `/compte`.
6. **Sprint 4** — Fact-check humain + SEA brief + email sequences +
   JSON-LD MemberProgram + press kit.
7. **Sprint 5** — Polish (E2E + axe + Lighthouse CI + Sentry events +
   A/B testing + ADRs 0019/0020 + skill `membership-program` + 5 skills
   étendus + template addendum + CGV).
8. **Phase 6** — Stripe + Little Hotelier sync + Offer JSON-LD +
   Google Ads Customer Match + Hotel Center loyalty feed.

## Plan de rollback

Si le programme dégrade les conversions e-commerce existantes (perte

> 10 % du trafic organique sur les fiches hôtel en 8 semaines après
> déploiement) :

1. Désactiver la mise en avant SEA (campagne 1 `Search Brand`) — le
   reste du funnel reste fonctionnel.
2. Retirer le bloc `<ClubBenefitsBlock>` des fiches hôtels (composant
   isolé, retrait propre) — la page `/le-concierge-club` reste
   accessible mais non promue.
3. Conserver les données `loyalty_members` (aucune perte côté
   utilisateur).
4. Sentry alerts + tableau Vercel Analytics surveillent la métrique
   `hotel.organic_traffic_index` en daily check pendant 30 jours.

Aucune migration DB destructive — toutes les colonnes ajoutées sont
optionnelles ou portent des défauts cohérents.

## Validation

- **Smoke** : 5 inscriptions de test (`qa+club1@…` à `qa+club5@…`)
  vérifient l'OAuth Google + Apple + magic link + dashboard accessible.
- **E2E Playwright** : `apps/web/e2e/le-concierge-club.spec.ts` couvre
  les 3 états (`anon → club → prestige`) + axe a11y scan.
- **JSON-LD** : Google Rich Results Test sur `/fr/le-concierge-club` et
  `/fr/le-concierge-club/prestige` — pas d'avertissement `MemberProgram`.
- **Sentry custom events** : `club.signup.completed`, `club.benefits_viewed`,
  `club.waitlist_prestige_signup` capturés + dashboard partagé avec
  l'équipe.
- **A/B testing** : 3 expériences (`club_cta_copy`,
  `club_signup_oauth_order`, `club_benefits_position`) — analyse à 4
  semaines.
- **Audit légal** : pré-lancement validé par DPO + responsable
  juridique (CGV Le Concierge Club + politique RGPD + cookies).
