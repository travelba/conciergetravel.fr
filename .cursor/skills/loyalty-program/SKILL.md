---
name: loyalty-program
description: Loyalty program domain logic for MyConciergeHotel.com — Le Concierge Club (free tier, no CB, no commitment) + Le Concierge Club Prestige (paid €99/year, Phase 6). Use for tier rules, benefits resolution, eligibility display, back-office membership management, or any code touching `loyalty_members` / `hotel_member_benefits` / `prestige_waitlist`.
---

# Loyalty program — MyConciergeHotel.com

The cahier des charges defines the loyalty programme as **Le Concierge
Club** with two tiers. The architecture is documented in
[ADR-0019 Le Concierge Club architecture](../../docs/adr/0019-le-concierge-club-architecture.md)
and the SEA constraints in [ADR-0020](../../docs/adr/0020-sea-member-pricing-constraints.md).
The domain logic lives in `packages/domain/src/loyalty/`.

> **Naming policy** — The legacy `free / premium` tier names from
> CDC v3.0 §8 + ADR-0005 have been superseded. The DB enum now stores
> `'club' | 'prestige'`. The UI uses _Le Concierge Club_ (free,
> capitalised) and _Le Concierge Club Prestige_ (paid). Any new code
> that surfaces a tier name must read from the i18n bundle keys
> `clubBenefits.tierBadge.{club|prestige}`, never hard-code.

## Triggers

Invoke when:

- Modifying tier rules, benefits, or trial / Stripe state.
- Adding tier-aware UI in fiches, the booking tunnel, or the account
  area.
- Reading the `hotel_member_benefits` table (Little API sync source
  Phase 6, manual addendum source Phase 1).
- Persisting `bookings.loyalty_tier` or `bookings.loyalty_benefits`
  on a confirmed booking.
- Adjusting a member's tier from Payload back-office.
- Writing any code that branches on `viewerTier` or
  `Loyalty.MemberTier`.

## Tiers

### Le Concierge Club (free)

- **Eligibility**: free signup, no CB, no engagement. Activable from
  `/compte/rejoindre` in 30 s (OAuth Google/Apple + magic link
  enabled).
- **Duration**: unlimited (no expiry).
- **DB enum value**: `'club'`.
- **Phase 1 deliverables** (active today):
  - Concierge monthly newsletter (Brevo, opt-in).
  - Dashboard `/compte` (Mon Concierge Club) with favourites,
    bookings, requests.
  - Prestige launch priority — Club members contacted first when
    Prestige opens (Phase 6).
- **Phase 6 deliverables** (catalogue-only Phase 1):
  - `member_rate_differential` (negociated rate ≤ public rate, sourced
    by an Amadeus cron).
  - Hotel-specific perks resolved from `hotel_member_benefits` (Little
    API sync nightly).
- **Operational cost Phase 1**: zero-ops. No WhatsApp, no live chat
  (Prestige-only).

### Le Concierge Club Prestige (paid)

- **Eligibility**: paid annual subscription €99/year, 30-day free
  trial, 1-click cancellation, Stripe Checkout flow. **Phase 6
  rollout** — Phase 1 ships the waitlist
  (`/le-concierge-club/prestige`) only.
- **DB enum value**: `'prestige'`.
- **Benefits** (all `availableInPhase1 = false` in `catalogue.ts`):
  - Breakfast for 2 on Little partner hotels.
  - Room upgrade subject to availability.
  - Hotel credit (amount per hotel from Little API).
  - Late check-out 14h (subject to availability).
  - Welcome gift in-room.
  - WhatsApp Concierge 24/7.
  - GM introduction (subject to availability).

The full hard-coded catalogue lives at
[`packages/domain/src/loyalty/catalogue.ts`](../../packages/domain/src/loyalty/catalogue.ts)
— it is the **single source of truth** for the 11 perk codes. Any new
code surfacing a benefit must validate the code against `isBenefitCode`
or `benefitByCode`; unknown codes from upstream (Little API) are
dropped.

## Non-negotiable rules

### Domain logic

- All loyalty functions live in `packages/domain/src/loyalty/` and are
  **pure** — no I/O, no `Date.now()` (inject a clock), no `Math.random()`.
- `tierFor(member?, today)` resolves the actual tier given the
  subscription state (handles `trial_started_at`, `trial_ends_at`,
  `paid_until`, `cancelled_at`).
- `eligibleBenefits({ tier, hotelBenefits })` returns the catalogue
  perks the viewer can claim. Phase 1 returns the maximalist catalogue
  for `'anon'` + `'club'` with `phase1NotePending=true`; Phase 6 reads
  `hotelBenefits` (sourced from `hotel_member_benefits`) and emits the
  real per-hotel reality.
- `canUpgradeToPrestige({ member })` is the gate function for the
  Prestige CTA — false when the member is already Prestige or has
  cancelled in the last 30 days (anti-spam).

### UI display rules (Phase 1)

- **Anonymous viewer** → render the catalogue maximaliste with the
  disclaimer "Vos avantages possibles…" (i18n key
  `clubBenefits.anonNotice`). CTA = "Rejoindre — c'est gratuit"
  pointing to `/compte/rejoindre`.
- **Club viewer Phase 1** → render the catalogue + mention "Personnalisation en
  cours" (`clubBenefits.clubPersonalisationPending`). CTA = "Découvrir
  Prestige" pointing to `/le-concierge-club/prestige`.
- **Prestige viewer** → render the personalised benefits when
  `hotelBenefits` non-empty; otherwise fall back to the catalogue with
  no disclaimer.
- The decision is centralised in
  [`apps/web/src/components/loyalty/club-benefits-block.tsx`](../../apps/web/src/components/loyalty/club-benefits-block.tsx)
  — **do not duplicate** the rendering logic elsewhere.

### Persistence

- On confirmed booking (Phase 6 only):
  - `bookings.loyalty_tier = active tier at booking time`.
  - `bookings.loyalty_benefits = applied benefits snapshot` (JSON,
    serialised from `eligibleBenefits` result).
  - If the user has no `loyalty_members` row, **do not** auto-create
    one — Phase 1 mandates explicit opt-in at `/compte/rejoindre`.

### Back-office

- Operator can manually adjust a member's tier with a reason
  (audited).
- Admin can extend `paid_until` or `trial_ends_at`.
- Read-only timeline view of bookings + tier changes per member.
- RBAC enforced on `hotel_member_benefits` + `club_eligibility` —
  see [`apps/admin/src/collections/hotel-member-benefits.ts`](../../apps/admin/src/collections/hotel-member-benefits.ts).

### Email touchpoints

- Brevo templates declared in `docs/marketing/email-sequences.md`:
  - `template-club-signup-confirmation` (transactional, J+0).
  - `template-club-discovery` (J+2, opt-in).
  - `template-club-editorial-tease` (J+7, opt-in).
  - `template-club-prestige-tease` (J+30, Phase 6 conditional).
  - `template-club-reactivation` (J+90, opt-in).

### Phase 6 scope

- Stripe Checkout, Stripe Portal, billing webhooks → `packages/integrations/stripe/`.
- Little API nightly sync → `packages/integrations/little-hotelier/sync/`
  populates `hotel_member_benefits` per hotel with `source='little_api'`.
- Amadeus cron → populates `member_price_differential` when offers
  carry a negociated member rate.
- Google Customer Match + Hotel Center loyalty rates feed — see
  [ADR-0020](../../docs/adr/0020-sea-member-pricing-constraints.md).
- `Offer` JSON-LD with `eligibleCustomerType` becomes possible
  (currently NOT emitted — AGENTS.md §4ter).

## Anti-patterns to refuse

- Hard-coding tier names in `.tsx` (`'free'`, `'premium'`, `'club'`,
  `'prestige'`) outside the catalogue + i18n bundle.
- Reading `auth.uid()` inline in an RLS policy instead of
  `(select auth.uid())` — see [supabase-postgres-rls](../supabase-postgres-rls/SKILL.md).
- Annoying tier-specific differentiated pricing in JSON-LD or the SEA
  copy in Phase 1 (cf. ADR-0020 R1).
- Wiring a third-party Customer Match or Hotel Center loyalty rates
  feed without DPO + legal sign-off (cf. ADR-0020 R4).
- Allowing a customer-role server action to set `tier = 'prestige'`
  directly (only Stripe webhook + admin override are valid sources).
- Duplicating the rendering logic of `<ClubBenefitsBlock>` in another
  component — it is the canonical surface.
- Showing different benefits in the fiche vs the confirmation email.

## References

- [ADR-0019](../../docs/adr/0019-le-concierge-club-architecture.md)
- [ADR-0020](../../docs/adr/0020-sea-member-pricing-constraints.md)
- [ADR-0005 loyalty premium deferred](../../docs/adr/0005-loyalty-premium-deferred.md)
- [ADR-0011 Concierge voice](../../docs/adr/0011-concierge-voice.md)
- Skills:
  [`membership-program`](../membership-program/SKILL.md),
  [`domain-driven-design`](../domain-driven-design/SKILL.md),
  [`booking-engine`](../booking-engine/SKILL.md),
  [`email-workflow-automation`](../email-workflow-automation/SKILL.md),
  [`backoffice-cms`](../backoffice-cms/SKILL.md),
  [`auth-role-management`](../auth-role-management/SKILL.md),
  [`supabase-postgres-rls`](../supabase-postgres-rls/SKILL.md).
- Migration: `packages/db/migrations/0057_loyalty_member_program.sql`
  (+ `0058_le_concierge_club_rls_fix.sql`).
- Marketing assets: `docs/marketing/sea-le-concierge-club-brief.md` +
  `docs/marketing/email-sequences.md`.
