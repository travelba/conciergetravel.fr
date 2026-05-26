import type React from 'react';
import { getTranslations } from 'next-intl/server';

import * as Loyalty from '@mch/domain/loyalty';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * `<ClubBenefitsBlock>` — public surface of the Le Concierge Club
 * benefits, rendered on the hotel detail page and on the
 * `/le-concierge-club` landing.
 *
 * Three rendering states (pure, driven by `@mch/domain/loyalty`):
 *
 *   - **Anonymous viewer** → full maximalist catalogue + aspirational
 *     disclaimer + CTA to `/compte/rejoindre`. The disclaimer is
 *     visible to satisfy DSA art. 25 (no manipulative interfaces) and
 *     Google Ads policies on benefits advertised to cold traffic.
 *
 *   - **Club member, no hotel reality available (Phase 1)** → filtered
 *     catalogue (perks whose `minTier === 'club'`) + "personnalisation
 *     en cours" copy + Prestige upsell teaser.
 *
 *   - **Member + hotel reality (Phase 6)** → only the perks the hotel
 *     actually agreed to deliver via `hotelBenefits` (sourced by the
 *     nightly Little API sync — `source='little_api'`).
 *
 * No interactive client island needed: the viewer tier is known at
 * request time via `requireUser` / `getOptionalUser`. Pure Server
 * Component → zero JS shipped to the client, which is the whole
 * point of the "perks-only Phase 1" decision.
 *
 * Skill: loyalty-program + accessibility + nextjs-app-router.
 */

export interface ClubBenefitsBlockProps {
  readonly locale: Locale;
  readonly viewerTier: Loyalty.Tier;
  /** Empty array in Phase 1 — populated by Little API sync in Phase 6. */
  readonly hotelBenefits?: ReadonlyArray<Loyalty.HotelBenefit>;
  /** Edge Config flag (false in Phase 1, true in Phase 6 rollout). */
  readonly littlePersonalisationEnabled?: boolean;
  /**
   * When false, render a compact variant (no headline, no surrounding
   * card) — used inline on long-read pages where the section already
   * has its own headline.
   */
  readonly compact?: boolean;
}

export async function ClubBenefitsBlock({
  locale: _locale,
  viewerTier,
  hotelBenefits = [],
  littlePersonalisationEnabled = false,
  compact = false,
}: ClubBenefitsBlockProps): Promise<React.ReactElement> {
  const t = await getTranslations('clubBenefits');
  const resolved = Loyalty.eligibleBenefits({
    viewerTier,
    hotelBenefits,
    littlePersonalisationEnabled,
  });

  const isAnon = viewerTier === 'anon';
  const isPersonalised = resolved.some((row) => row.personalised);
  const showPendingPersonalisation = !isAnon && !isPersonalised;

  return (
    <section
      aria-labelledby="club-benefits-heading"
      className={
        compact
          ? 'border-border bg-bg/40 rounded-lg border p-4'
          : 'border-border bg-bg rounded-xl border p-6 shadow-sm sm:p-8'
      }
      data-loyalty-tier={viewerTier}
    >
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="club-benefits-heading"
          className={compact ? 'text-fg font-serif text-xl' : 'text-fg font-serif text-2xl'}
        >
          {t('heading')}
        </h2>
        <TierBadge tier={viewerTier} t={t} />
      </header>

      {isAnon ? <p className="text-muted mb-4 text-sm leading-relaxed">{t('anonNotice')}</p> : null}

      {showPendingPersonalisation ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {t('clubPersonalisationPending')}
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {resolved.map(({ benefit, personalised, hotelOverride }) => (
          <BenefitCard
            key={benefit.code}
            benefit={benefit}
            personalised={personalised}
            hotelOverride={hotelOverride}
            t={t}
          />
        ))}
      </ul>

      {isAnon ? (
        <p className="mt-6">
          <Link
            href="/compte/rejoindre"
            className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('clubCta')}
          </Link>
        </p>
      ) : viewerTier === 'club' ? (
        <p className="mt-6">
          <Link
            href="/le-concierge-club/prestige"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('prestigeCta')}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

interface TierBadgeProps {
  readonly tier: Loyalty.Tier;
  readonly t: Awaited<ReturnType<typeof getTranslations<'clubBenefits'>>>;
}

function TierBadge({ tier, t }: TierBadgeProps): React.ReactElement | null {
  if (tier === 'anon') return null;
  return (
    <span className="border-border text-muted inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wider">
      {t(`tierBadge.${tier}` as const)}
    </span>
  );
}

interface BenefitCardProps {
  readonly benefit: Loyalty.Benefit;
  readonly personalised: boolean;
  readonly hotelOverride: Loyalty.HotelBenefit | undefined;
  readonly t: Awaited<ReturnType<typeof getTranslations<'clubBenefits'>>>;
}

function BenefitCard({
  benefit,
  personalised,
  hotelOverride,
  t,
}: BenefitCardProps): React.ReactElement {
  const titleKey = `codes.${benefit.code}.title` as const;
  const bodyKey = `codes.${benefit.code}.body` as const;
  // `subject_to_availability` on a personalised row trumps the
  // catalogue default — a hotel may activate the perk as "guaranteed"
  // or as "on-request" depending on its addendum.
  const subjectToAvailability =
    hotelOverride?.subjectToAvailability ?? benefit.subjectToAvailability;

  return (
    <li
      className="border-border bg-bg/60 rounded-md border p-3"
      data-benefit-code={benefit.code}
      data-personalised={personalised}
    >
      <h3 className="text-fg text-sm font-medium">{t(titleKey)}</h3>
      <p className="text-muted mt-1 text-sm leading-relaxed">{t(bodyKey)}</p>
      <ul className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {subjectToAvailability ? <li>{t('subjectToAvailability')}</li> : null}
        {!benefit.availableInPhase1 ? <li>{t('phase6Notice')}</li> : null}
      </ul>
    </li>
  );
}
