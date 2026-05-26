# ADR 0020 — Contraintes d'acquisition payante (SEA) sur le pricing membre

- Status: accepted
- Date: 2026-05-26
- Refs: [ADR-0019 Le Concierge Club](0019-le-concierge-club-architecture.md), rule `seo-geo`, rule `security-csp`, skill `loyalty-program`, skill `membership-program`, `docs/marketing/sea-le-concierge-club-brief.md`

## Décision

Adopter quatre règles dures qui encadrent **toute communication SEA**
(Google Ads, Bing Ads, Meta Ads, TikTok Ads, partenariats display)
mentionnant Le Concierge Club ou Le Concierge Club Prestige :

1. **R1 — Aucun différentiel tarifaire en trafic froid Phase 1.**
   Le prix membre = prix public en Phase 1 (R5 / D1 d'ADR-0019).
   Annoncer un différentiel fictif est interdit (DGCCRF + DSA art. 25 +
   Google Ads "deceptive pricing claims" policy).
2. **R2 — Aucun avantage hôtel-spécifique nominatif en trafic froid.**
   Les avantages publiés à l'audience large sont **génériques**
   (newsletter, dashboard, futur tarif négocié). Les avantages
   hôtel-par-hôtel (`hotel_member_benefits`) ne s'affichent qu'aux
   utilisateurs authentifiés sur leur dashboard ou la fiche
   correspondante.
3. **R3 — Le qualificatif "gratuit" est réservé au tier Le Concierge Club.**
   Aucune annonce "free / gratuit" ne peut concerner Prestige. Les
   essais 30 jours Prestige sont décrits comme "essai gratuit 30
   jours" — le programme global Prestige reste payant et doit toujours
   afficher le prix `€99/an` quand il est mentionné dans un asset.
4. **R4 — Google Customer Match + Hotel Center loyalty rates feed
   différés à Phase 6.** Aucun audience custom basé sur l'identifiant
   membre n'est synchronisé avec Google Ads tant que :
   - L'opt-in marketing explicite et trackable n'est pas confirmé
     (DPO sign-off).
   - L'audit légal Hotel Center loyalty rates feed n'est pas validé.
   - L'infrastructure de réservation Phase 6 n'est pas en service
     (sinon le tarif membre annoncé n'est pas livrable et viole R1).

## Contexte

Le projet planifie un volume SEA significatif (4 campagnes × €1 200-2 000
mensuels — cf. `docs/marketing/sea-le-concierge-club-brief.md`). Sans
règles écrites, l'équipe Growth peut être tentée :

- d'afficher "Tarif membre exclusif -10 %" en headline Search → DGCCRF
  flag pour pratique commerciale trompeuse (cas Booking 2020).
- d'annoncer "Petit-déjeuner offert sur 30+ Palaces" → DSA art. 25
  flag dès qu'un seul hôtel listé n'offre pas effectivement le
  petit-déjeuner.
- d'utiliser le mot "gratuit" sur la liste d'attente Prestige →
  Google Ads policy "Inaccurate claims" → suspend account.
- de synchroniser les inscrits Concierge Club avec Google Customer
  Match sans opt-in explicite → CNIL audit (cas Carrefour 2023).

La jurisprudence européenne (Booking 2020, Expedia 2023-2024,
TripAdvisor 2024) confirme que les autorités regardent en premier
lieu **l'annonce**, pas la page d'atterrissage. Une promesse fausse en
headline Google Ads sanctionne l'éditeur même si la landing page
nuance.

## Alternatives considérées

**Alternative A — Annoncer le tarif membre dès Phase 1 avec un
différentiel artificiel = 0 %.** Rejetée. Annoncer "tarif membre" sans
livrer un différentiel mesurable est trompeur — même si le prix est le
même, l'utilisateur clique en espérant un avantage tarifaire qu'il ne
trouvera pas (cf. DGCCRF Booking 2020).

**Alternative B — Annoncer des avantages hôtels-spécifiques (petit-déj
sur Le Bristol, surclassement sur Plaza Athénée) en trafic froid pour
booster le CTR.** Rejetée. Le tableau `hotel_member_benefits` reste
vide en Phase 1 (sync Little Phase 6). Annoncer un avantage hôtel-
spécifique sans capacité technique à le livrer = DSA art. 25 +
risque réputationnel direct (le client arrive, demande le bénéfice
annoncé, on lui répond "Phase 6").

**Alternative C — Activer Customer Match dès Phase 1 sur les inscrits
opt-in.** Rejetée. Sans page de confirmation explicite du
consentement marketing trackable (audit logs CNIL), le risque d'audit
est élevé. Phase 6 livre cette infrastructure conjointement avec le
Hotel Center loyalty rates feed.

**Alternative D — Pas de SEA Phase 1, attendre Phase 6.** Rejetée.
Le programme a besoin d'une masse critique d'inscrits pour valider la
demande Prestige et structurer les négociations avec les hôtels
Little. Phase 1 SEA = capture éditoriale gratuite, pas commercialisation
de pricing membre.

## Conséquences

### Positives

- **Conformité légale claire et défendable** vis-à-vis de la DGCCRF,
  de la CNIL et des règles Google Ads.
- **Cohérence avec ADR-0019** (perks-only Phase 1, free tier zero-ops).
- **Pas de risque de suspension Google Ads** sur l'account `MyConciergeHotel.com`
  (suspension = perte revenus immédiate sur le canal d'acquisition
  principal).
- **Optimisation séquentielle** : Phase 1 mesure le CPL d'inscription,
  Phase 6 mesure le LTV. Sans contamination par des promesses
  pricing non livrables.

### Négatives

- **CTR potentiellement plus faible** que des annonces "tarif
  membre exclusif" — accepté comme coût de conformité.
- **Aucune Customer Match Phase 1** = pas de remarketing avancé sur
  les inscrits. Mitigé par les séquences email Brevo (J+2, J+7, J+30,
  J+90) qui couvrent partiellement le besoin.
- **Coordination plus lourde** entre Growth, Éditorial et Conformité —
  chaque asset Ads doit passer la checklist du brief SEA avant
  publication. Ralentit le rythme de production des assets de 2-3 j à
  4-5 j.

## Plan d'exécution

1. **Sprint 4** — Publication du brief
   `docs/marketing/sea-le-concierge-club-brief.md` avec la checklist
   conformité pré-lancement. Audit asset par asset.
2. **Sprint 5** — Ajout des tests automatisés `assets-policy.spec.ts`
   qui scannent les fichiers de copy Ads (`docs/marketing/sea/*.md`) à
   la recherche de pattern bannis (`tarif membre`, `prix exclusif`,
   `petit-déjeuner offert`, `surclassement garanti`) — fail CI si
   présents.
3. **Phase 6** — Quand Stripe + Little API + Hotel Center sont prêts :
   - Audit légal DGCCRF + DSA art. 25 + CNIL (DPO).
   - Activation Customer Match (audience opt-in confirmée).
   - Bascule des assets vers "Tarif membre [-X%] sur 50 hôtels".
   - Activation Hotel Center loyalty rates feed (sous réserve audit).
   - ADR de mise à jour 0020 ou ADR successeur.

## Plan de rollback

Si Google Ads suspend l'account :

1. Désactiver toutes les campagnes immédiatement.
2. Diagnostic des assets concernés via `Disapprovals report`.
3. Si la suspension touche les claims pricing : appel formel sous 7 j
   avec preuves d'audit (brief + checklist conformité).
4. Reprise progressive — campagne 1 (`Search Brand`) en premier, puis
   campagne 2-4 après 14 j sans nouveau flag.

## Validation

- **Pre-launch checklist** — section "Conformité — checklist
  pré-lancement" du brief SEA, validée par juridique + DPO.
- **Audit hebdo sprint 5 + 4 premières semaines de prod** — review
  manuelle de tous les assets (copy + visuels + landing pages) par
  un membre de l'équipe Conformité.
- **CI policy linter** — `assets-policy.spec.ts` (Sprint 5) bloque
  toute PR qui mentionne un terme banni dans `docs/marketing/sea/*.md`.
- **Search Console + Google Ads monitor** — alerte Sentry si
  `Policy violations` ≥ 1.
- **Sentry custom event** — `seo.policy_audit.violation` capté pour
  les écarts en interne.
