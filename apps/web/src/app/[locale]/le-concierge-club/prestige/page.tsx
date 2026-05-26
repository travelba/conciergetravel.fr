import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { ClubBenefitsBlock } from '@/components/loyalty/club-benefits-block';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname, redirect } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { getOptionalUser } from '@/server/auth/session';
import { getLoyaltyMember } from '@/server/auth/loyalty-member';
import {
  joinPrestigeWaitlistAction,
  isOnPrestigeWaitlist,
} from '@/server/loyalty/waitlist-actions';

import * as Loyalty from '@mch/domain/loyalty';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * `/le-concierge-club/prestige` — Prestige waitlist page.
 *
 * Phase 1: pure waitlist. Phase 6 will swap this page for the real
 * Stripe Checkout flow (subscription €99/year + 30-day trial).
 *
 * Three states:
 *   - **Anonymous** → render the lede + benefits + a CTA to
 *     `/compte/rejoindre?next=...` because the waitlist row is keyed
 *     on `user_id`.
 *   - **Logged-in, not yet on the list** → render the waitlist form
 *     (single submit button, no extra fields — we already know the
 *     user's email from auth).
 *   - **Logged-in, already on the list** → render a confirmation
 *     banner. The button is hidden to avoid duplicate inserts.
 *
 * `dynamic` because the page reads `cookies()` indirectly via
 * Supabase auth.
 */
export const dynamic = 'force-dynamic';

interface PageSearchParams {
  readonly gated?: string;
  readonly joined?: string;
  readonly err?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const t = await getTranslations({ locale: raw, namespace: 'clubPrestigeWaitlist.meta' });
  const languages = buildHreflangAlternates((loc) =>
    getPathname({ locale: loc, href: '/le-concierge-club/prestige' }),
  );
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getPathname({ locale: raw, href: '/le-concierge-club/prestige' }),
      languages,
    },
  };
}

export default async function PrestigeWaitlistPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [t, tBenefits, tLanding] = await Promise.all([
    getTranslations('clubPrestigeWaitlist'),
    getTranslations('clubBenefits'),
    getTranslations('clubLanding'),
  ]);
  const user = await getOptionalUser();
  const member = user !== null ? await getLoyaltyMember(user.id) : null;
  const tier: Loyalty.Tier = user === null ? 'anon' : (member?.tier ?? 'club');
  const alreadyOnList = user !== null ? await isOnPrestigeWaitlist(user.id) : false;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const programUrl = `${origin}${getPathname({ locale, href: '/le-concierge-club' })}`;
  const prestigeUrl = `${origin}${getPathname({ locale, href: '/le-concierge-club/prestige' })}`;
  const prestigeBenefitLabels = Loyalty.CONCIERGE_CLUB_BENEFITS.filter(
    (b) => b.minTier === 'prestige',
  ).map((b) => tBenefits(`codes.${b.code}.title` as const));

  const memberProgramData = JsonLd.withSchemaOrgContext(
    JsonLd.memberProgramJsonLd({
      name: tLanding('title'),
      description: t('lede'),
      url: programUrl,
      hostingOrganization: {
        name: 'MyConciergeHotel.com',
        url: origin,
      },
      tiers: [
        {
          id: 'prestige',
          name: tBenefits('tierBadge.prestige'),
          description: t('lede'),
          requiresSubscription: true,
          // Annual price is announced (€99) but not emitted as a
          // priceSpecification yet — Phase 6 wires the Stripe Checkout
          // flow that backs the rich-result purchase intent.
          benefits: prestigeBenefitLabels,
        },
      ],
    }),
  );
  const breadcrumbData = JsonLd.withSchemaOrgContext(
    JsonLd.breadcrumbJsonLd([
      {
        name: locale === 'fr' ? 'Accueil' : 'Home',
        url: `${origin}${getPathname({ locale, href: '/' })}`,
      },
      { name: tLanding('title'), url: programUrl },
      { name: t('title'), url: prestigeUrl },
    ]),
  );

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={memberProgramData} nonce={nonce} />
      <JsonLdScript data={breadcrumbData} nonce={nonce} />
      <header className="mb-10">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">{t('lede')}</p>
      </header>

      {sp.gated === '1' ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {t('lede')}
        </p>
      ) : null}

      {sp.joined === '1' ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {t('successBanner')}
        </p>
      ) : null}

      {sp.err === '1' ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {t('errorBanner')}
        </p>
      ) : null}

      {user === null ? (
        <section className="mb-10">
          <p className="text-muted mb-4 text-sm leading-relaxed">{t('anonNote')}</p>
          <Link
            href={{
              pathname: '/compte/rejoindre',
              query: { next: '/le-concierge-club/prestige' },
            }}
            className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('anonCta')}
          </Link>
        </section>
      ) : alreadyOnList ? (
        <section className="mb-10">
          <p
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            {t('joinedNotice')}
          </p>
        </section>
      ) : (
        <section className="mb-10">
          <form action={joinWaitlist} className="flex flex-wrap gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="intent" value="trial_at_launch" />
            <button
              type="submit"
              className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('submit')}
            </button>
          </form>
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-fg mb-4 font-serif text-2xl">{t('benefitsHeading')}</h2>
        <ClubBenefitsBlock
          locale={locale}
          viewerTier={tier === 'anon' ? 'anon' : 'prestige'}
          hotelBenefits={[]}
          littlePersonalisationEnabled={false}
        />
      </section>

      <p className="text-muted mt-8 max-w-2xl text-xs">{t('policy')}</p>
    </main>
  );
}

/**
 * Server-action wrapper — converts the form-data return into a
 * `redirect()` so the page itself stays declarative. The wrapper is a
 * separate exported helper so the form can `action={joinWaitlist}`
 * directly without needing to inline-import the server action with
 * its FormData boundary.
 */
async function joinWaitlist(formData: FormData): Promise<void> {
  'use server';
  const localeRaw = String(formData.get('locale') ?? 'fr');
  const locale: Locale = isRoutingLocale(localeRaw) ? localeRaw : 'fr';
  const result = await joinPrestigeWaitlistAction(formData);
  redirect({
    href: {
      pathname: '/le-concierge-club/prestige',
      query: result.ok ? { joined: '1' } : { err: '1' },
    },
    locale,
  });
}
