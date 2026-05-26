<!--
Merci de bien vouloir compléter ce template avant la revue.
-->

## Contexte

<!-- Quel besoin produit / technique cette PR adresse-t-elle ? Lien vers la phase du plan ou l'ADR concerné. -->

- Phase :
- ADR(s) :
- Lien CDC : v3.0 §

## Changements

<!-- Liste concise des modifications. Mentionnez les fichiers / packages touchés. -->

- [ ] `apps/web` : …
- [ ] `apps/admin` : …
- [ ] `packages/...` : …
- [ ] migrations `packages/db/migrations/...` : …
- [ ] documentation (`docs/...`, ADR) : …

## Validation

- [ ] `pnpm lint` pass
- [ ] `pnpm typecheck` pass
- [ ] `pnpm test` pass
- [ ] e2e Playwright (si flow utilisateur impacté)
- [ ] Lighthouse CI (si page front impactée)
- [ ] vérification manuelle sur preview Vercel

## SEO / GEO / sécurité

- [ ] Aucune régression `index/follow` sur les pages éditoriales
- [ ] hreflang + canonical inchangés ou corrigés explicitement
- [ ] aucune donnée carte ne transite/n'est stockée
- [ ] aucun secret commité

## Le Concierge Club (cocher uniquement si la PR touche le programme)

<!--
Skill: `.cursor/skills/membership-program/SKILL.md`
ADR: `docs/adr/0019-le-concierge-club-architecture.md` + `docs/adr/0020-sea-member-pricing-constraints.md`
-->

- [ ] N/A — la PR ne touche pas le programme.
- [ ] Pas de `<ClubBenefitsBlock>` embarqué dans la fiche hôtel (Phase 1, cf. ADR-0019).
- [ ] Toute page emittant du JSON-LD `MemberProgram` est `force-dynamic` + lit `x-nonce` au niveau page.
- [ ] Aucune copie SEA mentionne un tarif membre, un avantage hôtel-spécifique, ou utilise "exclusif" / "réservé" sans qualifier "à l'inscription gratuite" (ADR-0020 §R1-R4).
- [ ] Si nouveau event Sentry `club.*` : ADR mis à jour + skill `membership-program` réécrit.
- [ ] Si nouveau flag Edge Config : `packages/experiments/src/flags.ts` mis à jour + tests.
- [ ] CGV / addendum partenariat hôtelier (`docs/legal/`) cohérents avec les changements de scope.

## Simplifications / dette

<!-- Toute simplification volontaire est documentée par un ADR ou une note dans `docs/`. -->
