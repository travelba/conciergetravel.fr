---
name: membership-program
description: Le Concierge Club membership funnel for MyConciergeHotel.com — signup UX, anon/club/prestige three-state rendering, waitlist mechanics, dashboard refonte, JSON-LD MemberProgram, llms.txt + agent-skills.json wiring. Use for any change to the membership funnel, the `<ClubBenefitsBlock>`, the `/le-concierge-club*` pages, the dashboard, the press kit, or any LLM-actionable surface that mentions the programme.
---

# Membership program funnel — Le Concierge Club

This skill complements [`loyalty-program`](../loyalty-program/SKILL.md):
where `loyalty-program` owns the **domain logic** (tier rules, benefits
resolution), `membership-program` owns the **funnel + UI surfaces**
(landing pages, signup, dashboard, JSON-LD, LLM-actionable surfaces).

Architecture decisions: [ADR-0019](../../docs/adr/0019-le-concierge-club-architecture.md)

- [ADR-0020](../../docs/adr/0020-sea-member-pricing-constraints.md).

## Triggers

Invoke when:

- Touching any route under `/le-concierge-club*` or `/compte/rejoindre`.
- Editing `<ClubBenefitsBlock>` or its three-state rendering branches.
- Adding / extending the `MemberProgram` JSON-LD or any
  `memberProgramJsonLd` call site.
- Updating the press kit (`/presse/le-concierge-club`) or the dashboard
  panels (`/compte`).
- Adding a new LLM-actionable skill in `packages/seo/src/agent-skills.ts`
  related to the programme (signup, waitlist, dashboard…).
- Wiring Sentry custom events `club.*`.
- Wiring Vercel Edge Config flags `member_price_differential_enabled` /
  `little_personalization_enabled` (via `@mch/experiments`).
- Writing or modifying the SEA + Brevo briefs in `docs/marketing/`.

## Surfaces (Phase 1 catalogue)

| Surface            | URL                           | Owner                                                           | Notes                                                                                |
| ------------------ | ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Landing            | `/le-concierge-club`          | `apps/web/src/app/[locale]/le-concierge-club/page.tsx`          | `force-dynamic` (JSON-LD nonce) ; emits `MemberProgram` + `BreadcrumbList` JSON-LD   |
| Waitlist Prestige  | `/le-concierge-club/prestige` | `apps/web/src/app/[locale]/le-concierge-club/prestige/page.tsx` | `force-dynamic` ; emits `MemberProgram` (prestige tier) + `BreadcrumbList`           |
| Press kit          | `/presse/le-concierge-club`   | `apps/web/src/app/[locale]/presse/le-concierge-club/page.tsx`   | `force-dynamic` ; emits `Article` + `FAQPage` + `BreadcrumbList`                     |
| Quick signup       | `/compte/rejoindre`           | `apps/web/src/app/[locale]/compte/rejoindre/page.tsx`           | 3-field form, magic link + OAuth                                                     |
| Dashboard          | `/compte`                     | `apps/web/src/app/[locale]/compte/page.tsx`                     | Embeds `<ClubBenefitsBlock>`                                                         |
| Hotel fiche teaser | `/hotel/[slug]`               | `apps/web/src/app/[locale]/hotel/[slug]/page.tsx`               | Reserved for Phase 6 — the fiche **does NOT** embed `<ClubBenefitsBlock>` in Phase 1 |

## Non-negotiable rules

### Rendering — three-state machine

`<ClubBenefitsBlock>` is a Server Component with **three distinct
branches**. Adding a new branch (e.g. "trial expired") requires an ADR
update.

- `viewerTier === 'anon'` → catalogue maximaliste + disclaimer + CTA
  signup.
- `viewerTier === 'club'` + `littlePersonalisationEnabled === false` →
  catalogue + "Personnalisation en cours" disclaimer + CTA Prestige.
- `viewerTier === 'prestige'` (or `'club'` with
  `littlePersonalisationEnabled === true`) → personalised
  `hotelBenefits` rendering.

Never gate the **content** of the catalogue itself (perks code, body
copy) on the viewer tier — only the framing (disclaimers, CTAs)
changes. Cf. ADR-0019 D3.

### Force-dynamic + CSP nonce

All membership pages that emit JSON-LD must:

- `export const dynamic = 'force-dynamic';`
- Read `(await headers()).get('x-nonce')` once at the page boundary.
- Pass the nonce to every `<JsonLdScript />` as a prop — NEVER call
  `headers()` inside the leaf component.

See [`structured-data-schema-org`](../structured-data-schema-org/SKILL.md)
§CSP-nonce-contract.

### JSON-LD `MemberProgram` canonicality

- Emitted on `/le-concierge-club` (canonical anchor, both tiers).
- Emitted on `/le-concierge-club/prestige` (Prestige tier with a
  shorter `tiers[]` array but the same `@id` so search engines link
  both pages to the same programme node).
- **Never emitted on hotel fiches** — Phase 1. Phase 6 may re-evaluate
  if the Offer JSON-LD becomes member-aware (`eligibleCustomerType`).
- The builder lives in [`packages/seo/src/jsonld/member-program.ts`](../../packages/seo/src/jsonld/member-program.ts).
- `priceSpecification` is dropped for the free tier and, currently,
  for the Prestige tier (Phase 1 has no working checkout flow — Google
  would expect a working purchase). Phase 6 enables `99 EUR/ANN` once
  Stripe Checkout is live.

### Pricing copy — ADR-0020 compliance

- Phase 1: no member-rate differential ever rendered. No "tarif membre"
  / "prix exclusif" / "petit-déjeuner offert" in any SEA copy, landing
  page hero, or email subject.
- Phase 1: free tier copy may use "gratuit / free". Prestige copy must
  always carry the price (`€99/an`) when announced — "essai gratuit
  30 jours" is the only exception.
- Phase 6: differential pricing UI gated behind
  `member_price_differential_enabled` flag (Vercel Edge Config), so
  the rollout is reversible without a code deploy.

### Sentry custom events

The canonical emitter lives in
[`apps/web/src/server/observability/club-events.ts`](../../../apps/web/src/server/observability/club-events.ts).
It hashes any user id via HMAC-SHA256 (truncated to 32 chars) before
the event leaves the process — Sentry **never** sees the raw uuid.

Wire only the events listed below. New events require an ADR update so
the marketing dashboards stay stable.

- `club.signup.attempt` / `club.signup.success` / `club.signup.failure` —
  fired from `joinClubAction` in `apps/web/src/server/auth/actions.ts`.
- `club.magic_link.attempt` / `club.magic_link.failure` — fired from
  `sendMagicLinkAction`.
- `club.oauth.attempt` / `club.oauth.failure` — fired from
  `signInWithOAuthAction`.
- `club.benefits_viewed` — client-side, fired from `<ClubBenefitsBlock>`
  mount via `trackEvent({ name: 'club_benefits_viewed', … })`
  (`apps/web/src/lib/analytics/events.ts`).
- `club.waitlist_prestige_signup` / `club.waitlist_prestige_failure` —
  fired from `joinPrestigeWaitlistAction`.

PII rule: events carry `userIdHash` (truncated HMAC), `surface`,
`provider`, `errorKind`, `locale` — never email / name / phone / raw
user id. The emitter swallows Sentry failures so the funnel never
breaks because the DSN is missing or rate-limited.

### Edge Config flags

Two flags govern the programme behaviour, both declared in
`packages/experiments/src/flags.ts`:

- `member_price_differential_enabled` — gates the dual-price UI. Stays
  `false` in Phase 1.
- `little_personalization_enabled` — gates the per-hotel personalised
  benefits in `<ClubBenefitsBlock>`. Stays `false` in Phase 1.

Toggling either of these in production requires DPO + Conformité
sign-off because they switch the legal framing of the funnel (cf.
ADR-0020).

### LLM-actionable surfaces

Three skills under `packages/seo/src/agent-skills.ts` describe the
programme to LLM agents:

- `loyalty` — read-only programme overview.
- `join-concierge-club` — POST endpoint to sign up.
- `join-concierge-club-prestige-waitlist` — POST endpoint to join the
  waitlist.

The mirror endpoints live at `apps/web/src/app/api/agent/…` (to be
created Sprint 5 if not already shipped — see the agent endpoints test
in `packages/seo/src/agent-skills.test.ts` for the contract that fails
fast when a skill ships without its executable surface).

`llms.txt` lists the canonical URLs under the section "À propos &
EEAT" (FR + EN duplicate per locale).

## Anti-patterns to refuse

- Embedding `<ClubBenefitsBlock>` inside a hotel fiche in Phase 1
  (creates Offer-like content without a working booking flow).
- Adding a fourth state to the three-state machine without an ADR.
- Removing the `force-dynamic` export — the JSON-LD nonce contract
  silently breaks under ISR.
- Wiring Stripe / Little / Hotel Center loyalty rates feed without
  Phase 6 sign-off (AGENTS.md §4ter).
- Hard-coding "Concierge Club" / "Le Concierge Club" in `.tsx` instead
  of reading from i18n bundle keys.
- Translating "Prestige" — the tier label stays the same across all
  locales (brand decision, cf. ADR-0019 D6).
- Writing SEA copy that contradicts ADR-0020 R1-R4 — always check the
  assets-policy linter before merging.
- Emitting `MemberProgram` JSON-LD with a `priceSpecification` for the
  free tier — schema-illegal and triggers Google Rich Results
  warnings.

## Validation

- `pnpm --filter @mch/seo test` covers `memberProgramJsonLd` (5 tests).
- `pnpm --filter @mch/web typecheck` ensures the three-state branches
  compile and the i18n bundle keys exist.
- E2E Playwright spec `apps/web/e2e/le-concierge-club.spec.ts` covers
  the four membership surfaces (`/le-concierge-club`,
  `/le-concierge-club/prestige`, `/presse/le-concierge-club`,
  `/compte/rejoindre`) including `MemberProgram` JSON-LD shape, canonical
  href, honeypot wiring and the `next` deep-link forwarding.
- `apps/web/e2e/a11y.spec.ts` runs axe-core over the same five URLs in
  the dedicated "Le Concierge Club surfaces" cases.
- Lighthouse CI config at `lighthouserc.json` (root) covers the same
  URLs with `accessibility ≥ 0.95` and `seo ≥ 0.95` as error
  thresholds. Run locally via `pnpm lhci`.
- A/B testing — 3 experiments declared in
  `packages/experiments/src/club-experiments.ts` (covered by
  `club-experiments.test.ts`, 8 cases):
  - `club_cta_copy` (`control_decouvrir` / `urgent_rejoindre` / `soft_essai`).
  - `club_signup_oauth_order` (`oauth_first` / `password_first`).
  - `club_benefits_position` (`above_widget` / `below_faq`).

  Variant assignment is deterministic (FNV-1a hash of a visitor cookie),
  reportable via Sentry tags, and forceable in dev / Playwright via
  `MCH_EXPERIMENT_VARIANT_<NAME>=<variant>` env vars. Results analysed
  at 4 weeks.

## References

- [ADR-0019](../../docs/adr/0019-le-concierge-club-architecture.md) — programme architecture.
- [ADR-0020](../../docs/adr/0020-sea-member-pricing-constraints.md) — SEA pricing constraints.
- [ADR-0011](../../docs/adr/0011-concierge-voice.md) — Concierge voice (applies to all copy).
- Skills:
  [`loyalty-program`](../loyalty-program/SKILL.md),
  [`auth-role-management`](../auth-role-management/SKILL.md),
  [`backoffice-cms`](../backoffice-cms/SKILL.md),
  [`structured-data-schema-org`](../structured-data-schema-org/SKILL.md),
  [`geo-llm-optimization`](../geo-llm-optimization/SKILL.md),
  [`seo-technical`](../seo-technical/SKILL.md),
  [`email-workflow-automation`](../email-workflow-automation/SKILL.md),
  [`security-engineering`](../security-engineering/SKILL.md).
- Components:
  [`apps/web/src/components/loyalty/club-benefits-block.tsx`](../../apps/web/src/components/loyalty/club-benefits-block.tsx),
  [`packages/seo/src/jsonld/member-program.ts`](../../packages/seo/src/jsonld/member-program.ts).
- Marketing: `docs/marketing/sea-le-concierge-club-brief.md` +
  `docs/marketing/email-sequences.md`.
- Legal templates (Sprint 5):
  `docs/legal/le-concierge-club-cgv.md` + `docs/legal/hotel-addendum-concierge-club.md`.
