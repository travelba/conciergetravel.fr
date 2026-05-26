import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound, redirect as nextRedirect } from 'next/navigation';

import { JsonLd } from '@mch/seo';
import * as Loyalty from '@mch/domain/loyalty';

import { ClubBenefitsBlock } from '@/components/loyalty/club-benefits-block';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { getOptionalUser } from '@/server/auth/session';
import { getLoyaltyMember } from '@/server/auth/loyalty-member';
import {
  joinPrestigeWaitlistAction,
  isOnPrestigeWaitlist,
} from '@/server/loyalty/waitlist-actions';

/**
 * `/le-concierge-club` — single programme landing page (post-2026-05-26
 * consolidation, PO decision).
 *
 * Was previously split across `/le-concierge-club` + `/le-concierge-
 * club/prestige`. The PO opted for the Michelin Guide-style single-page
 * layout where both tiers (free `club` + paid `prestige` waitlist) sit
 * side-by-side. The Prestige sub-route now 301-redirects here with a
 * `#prestige` anchor (see `next.config.ts redirects`).
 *
 * Page anatomy
 * ------------
 * 1. Hero + lede + primary CTA (signup / dashboard depending on session)
 * 2. Side-by-side tier cards (`Club gratuit` | `Prestige waitlist`)
 * 3. Unified benefits matrix (`<ClubBenefitsBlock>`)
 * 4. Anchored `#prestige` section — waitlist form with 3 states
 *    (anonymous / logged-in not on list / logged-in on list)
 * 5. FAQ (covers both tiers — `clubLanding.faq.items`)
 * 6. Trust note + Phase-1 transparency disclaimer
 *
 * JSON-LD
 * -------
 * Single `MemberProgram` with two `hasTiers` entries (club +
 * prestige). Phase 1 deliberately omits `priceSpecification` on the
 * Prestige tier — Google would otherwise expect a working Stripe
 * purchase flow on the URL (Phase 6 wires that). Cf. ADR-0020 §SEA
 * constraints.
 *
 * `force-dynamic`
 * ---------------
 * The page reads `cookies()` via `getOptionalUser`/`isOnPrestigeWait-
 * list` and emits CSP-nonced JSON-LD via `JsonLdScript`. ISR would
 * silently strip the nonce — see `structured-data-schema-org/SKILL.md`
 * §CSP-nonce-contract.
 *
 * Skills: nextjs-app-router, loyalty-program, membership-program,
 * seo-technical, structured-data-schema-org.
 */
export const dynamic = 'force-dynamic';

interface PageSearchParams {
  /** Set by `requireUser({ minTier: 'prestige' })` when a non-Prestige
   *  member tries to reach a gated surface. Triggers the warning banner
   *  + auto-anchors to `#prestige`. */
  readonly gated?: string;
  /** Set after a successful waitlist submission. */
  readonly joined?: string;
  /** Set after a failed waitlist submission. */
  readonly err?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const t = await getTranslations({ locale: raw, namespace: 'clubLanding.meta' });
  const languages = buildHreflangAlternates((loc) =>
    getPathname({ locale: loc, href: '/le-concierge-club' }),
  );
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getPathname({ locale: raw, href: '/le-concierge-club' }),
      languages,
    },
  };
}

interface FaqItem {
  readonly q: string;
  readonly a: string;
}

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

export default async function ConciergeClubLandingPage({
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

  const [t, tBenefits, tPrestige, user] = await Promise.all([
    getTranslations('clubLanding'),
    getTranslations('clubBenefits'),
    getTranslations('clubPrestigeWaitlist'),
    getOptionalUser(),
  ]);

  const member = user !== null ? await getLoyaltyMember(user.id) : null;
  const viewerTier: Loyalty.Tier = user === null ? 'anon' : (member?.tier ?? 'club');
  const isAnon = user === null;
  const alreadyOnList = user !== null ? await isOnPrestigeWaitlist(user.id) : false;
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  const programUrl = `${origin}${getPathname({ locale, href: '/le-concierge-club' })}`;
  const clubBenefitCodes = Loyalty.CONCIERGE_CLUB_BENEFITS.filter((b) => b.minTier === 'club').map(
    (b) => tBenefits(`codes.${b.code}.title` as const),
  );
  const prestigeBenefitCodes = Loyalty.CONCIERGE_CLUB_BENEFITS.filter(
    (b) => b.minTier === 'prestige',
  ).map((b) => tBenefits(`codes.${b.code}.title` as const));

  const memberProgramData = JsonLd.withSchemaOrgContext(
    JsonLd.memberProgramJsonLd({
      name: t('title'),
      description: t('meta.description'),
      url: programUrl,
      hostingOrganization: {
        name: 'MyConciergeHotel.com',
        url: origin,
      },
      tiers: [
        {
          id: 'club',
          name: tBenefits('tierBadge.club'),
          description: t('sections.freeBody'),
          requiresSubscription: false,
          benefits: clubBenefitCodes,
        },
        {
          id: 'prestige',
          name: tBenefits('tierBadge.prestige'),
          description: t('sections.transparencyBody'),
          requiresSubscription: true,
          // Phase 1: Prestige is announced (€99/an) but the activation
          // is gated by Phase 6 (Stripe Checkout). We do NOT emit a
          // priceSpecification yet — Google would then expect a working
          // purchase flow on this URL. Cf. ADR-0020 §SEA constraints.
          benefits: prestigeBenefitCodes,
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
      { name: t('title'), url: programUrl },
    ]),
  );

  const faqItemsRaw = t.raw('faq.items') as unknown;
  const faqItems = Array.isArray(faqItemsRaw)
    ? (faqItemsRaw.filter(
        (item): item is FaqItem =>
          item !== null &&
          typeof item === 'object' &&
          'q' in item &&
          'a' in item &&
          typeof (item as FaqItem).q === 'string' &&
          typeof (item as FaqItem).a === 'string',
      ) as ReadonlyArray<FaqItem>)
    : [];

  return (
    <main className="max-w-editorial container mx-auto px-4 py-10 sm:py-14">
      <JsonLdScript data={memberProgramData} nonce={nonce} />
      <JsonLdScript data={breadcrumbData} nonce={nonce} />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <header className="mb-12">
        <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('eyebrow')}</p>
        <h1 className="text-fg font-serif text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">{t('lede')}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={isAnon ? '/compte/rejoindre' : '/compte'}
            className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('primaryCta')}
          </Link>
          {/* Anchor link — same page, scrolls to the Prestige section.
              We use a raw `<a href="#prestige">` (not next-intl `<Link>`)
              because typed routes don't carry hashes. */}
          <a
            href="#prestige"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('secondaryCta')}
          </a>
        </div>
        <p className="text-muted mt-4 max-w-2xl text-xs">{t('trustNote')}</p>
      </header>

      {/* ─── Side-by-side tier cards ────────────────────────────── */}
      <section aria-labelledby="club-tiers-heading" className="mb-12 grid gap-6 md:grid-cols-2">
        <h2 id="club-tiers-heading" className="sr-only">
          {t('tiers.heading')}
        </h2>

        {/* Card 1 — Club gratuit */}
        <article className="border-border bg-bg flex h-full flex-col rounded-lg border p-6">
          <p className="text-muted text-xs uppercase tracking-[0.18em]">
            {tBenefits('tierBadge.club')}
          </p>
          <h3 className="text-fg mt-2 font-serif text-2xl">{t('tiers.club.name')}</h3>
          <p className="text-fg mt-3 font-serif text-3xl">
            {t('tiers.club.price')}
            <span className="text-muted ml-1 text-sm font-normal">
              {t('tiers.club.priceSuffix')}
            </span>
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">{t('tiers.club.body')}</p>
          <ul className="text-fg mt-4 flex flex-col gap-1.5 text-sm">
            {clubBenefitCodes.slice(0, 4).map((label) => (
              <li key={label} className="flex items-start gap-2">
                <span aria-hidden className="text-fg/60 mt-1 text-xs">
                  ●
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <Link
              href={isAnon ? '/compte/rejoindre' : '/compte'}
              className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('tiers.club.cta')}
            </Link>
          </div>
        </article>

        {/* Card 2 — Prestige waitlist */}
        <article className="border-border bg-muted/5 flex h-full flex-col rounded-lg border p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted text-xs uppercase tracking-[0.18em]">
              {tBenefits('tierBadge.prestige')}
            </p>
            <span className="border-border text-muted rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider">
              {t('tiers.prestige.badge')}
            </span>
          </div>
          <h3 className="text-fg mt-2 font-serif text-2xl">{t('tiers.prestige.name')}</h3>
          <p className="text-fg mt-3 font-serif text-3xl">
            {t('tiers.prestige.price')}
            <span className="text-muted ml-1 text-sm font-normal">
              {t('tiers.prestige.priceSuffix')}
            </span>
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">{t('tiers.prestige.body')}</p>
          <ul className="text-fg mt-4 flex flex-col gap-1.5 text-sm">
            {prestigeBenefitCodes.slice(0, 4).map((label) => (
              <li key={label} className="flex items-start gap-2">
                <span aria-hidden className="text-fg/60 mt-1 text-xs">
                  ●
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <a
              href="#prestige"
              className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              {t('tiers.prestige.cta')}
            </a>
          </div>
        </article>
      </section>

      {/* ─── Three-column value pillars ─────────────────────────── */}
      <section aria-labelledby="club-value-heading" className="mb-12 grid gap-6 sm:grid-cols-3">
        <article>
          <h2 id="club-value-heading" className="text-fg font-serif text-lg">
            {t('sections.valueTitle')}
          </h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.valueBody')}</p>
        </article>
        <article>
          <h2 className="text-fg font-serif text-lg">{t('sections.freeTitle')}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">{t('sections.freeBody')}</p>
        </article>
        <article>
          <h2 className="text-fg font-serif text-lg">{t('sections.transparencyTitle')}</h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            {t('sections.transparencyBody')}
          </p>
        </article>
      </section>

      {/* ─── Unified benefits matrix ────────────────────────────── */}
      <section className="mb-12">
        <ClubBenefitsBlock
          locale={locale}
          viewerTier={viewerTier}
          hotelBenefits={[]}
          littlePersonalisationEnabled={false}
        />
      </section>

      {/* ─── Prestige waitlist section (anchored) ───────────────── */}
      <section
        id="prestige"
        aria-labelledby="club-prestige-heading"
        className="border-border bg-muted/5 mb-12 scroll-mt-24 rounded-lg border p-6 sm:p-8"
      >
        <p className="text-muted text-xs uppercase tracking-[0.18em]">{tPrestige('eyebrow')}</p>
        <h2 id="club-prestige-heading" className="text-fg mt-2 font-serif text-2xl sm:text-3xl">
          {tPrestige('title')}
        </h2>
        <p className="text-muted mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
          {tPrestige('lede')}
        </p>

        {sp.gated === '1' ? (
          <p
            role="status"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            {tPrestige('gatedBanner')}
          </p>
        ) : null}

        {sp.joined === '1' ? (
          <p
            role="status"
            className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            {tPrestige('successBanner')}
          </p>
        ) : null}

        {sp.err === '1' ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          >
            {tPrestige('errorBanner')}
          </p>
        ) : null}

        <div className="mt-6">
          {user === null ? (
            <>
              <p className="text-muted mb-3 text-sm leading-relaxed">{tPrestige('anonNote')}</p>
              <Link
                href={{
                  pathname: '/compte/rejoindre',
                  query: { next: '/le-concierge-club#prestige' },
                }}
                className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
              >
                {tPrestige('anonCta')}
              </Link>
            </>
          ) : alreadyOnList ? (
            <p
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              {tPrestige('joinedNotice')}
            </p>
          ) : (
            <form action={joinWaitlist} className="flex flex-wrap gap-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="intent" value="trial_at_launch" />
              <button
                type="submit"
                className="bg-fg text-bg hover:bg-fg/90 focus-visible:ring-ring inline-flex items-center rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
              >
                {tPrestige('submit')}
              </button>
            </form>
          )}
        </div>

        <p className="text-muted mt-6 max-w-2xl text-xs">{tPrestige('policy')}</p>
      </section>

      {/* ─── FAQ ────────────────────────────────────────────────── */}
      {faqItems.length > 0 ? (
        <section aria-labelledby="club-faq-heading" className="mb-12">
          <h2 id="club-faq-heading" className="text-fg mb-4 font-serif text-2xl">
            {t('faq.title')}
          </h2>
          <ul className="flex flex-col gap-3">
            {faqItems.map((item, idx) => (
              <li key={idx}>
                <details
                  className="border-border bg-bg rounded-md border px-4 py-3"
                  open={idx === 0}
                >
                  <summary className="text-fg cursor-pointer text-sm font-medium">{item.q}</summary>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

/**
 * Server-action wrapper — converts the action result into a `redirect`
 * back to the `#prestige` anchor so the page stays declarative. Wraps
 * `joinPrestigeWaitlistAction` from `@/server/loyalty/waitlist-actions`.
 *
 * We use the raw `next/navigation` `redirect` (not next-intl's typed
 * one) because we need to append the `#prestige` fragment, which the
 * typed `Href` shape doesn't model.
 */
async function joinWaitlist(formData: FormData): Promise<void> {
  'use server';
  const localeRaw = String(formData.get('locale') ?? 'fr');
  const locale: Locale = isRoutingLocale(localeRaw) ? localeRaw : 'fr';
  const result = await joinPrestigeWaitlistAction(formData);
  const base = locale === 'en' ? '/en/the-concierge-club' : '/le-concierge-club';
  const flag = result.ok ? 'joined=1' : 'err=1';
  nextRedirect(`${base}?${flag}#prestige`);
}
