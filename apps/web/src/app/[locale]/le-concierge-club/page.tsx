import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { JsonLd } from '@mch/seo';

import { ClubBenefitsBlock } from '@/components/loyalty/club-benefits-block';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Link, getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { buildHreflangAlternates } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { getOptionalUser } from '@/server/auth/session';
import { getLoyaltyMember } from '@/server/auth/loyalty-member';

import * as Loyalty from '@mch/domain/loyalty';

/**
 * `/le-concierge-club` — programme landing page.
 *
 * - Public, indexable. No gating: every visitor sees the full pitch
 *   + the maximalist benefits catalogue. The CTA toggles between
 *   "Rejoindre — c'est gratuit" (anon) and "Mon Concierge Club"
 *   (logged-in) based on the session.
 * - ISR with revalidate = 3600 — content is static once the i18n
 *   keys are stable. The dynamic part (tier badge, CTA copy) lives
 *   in the `<ClubBenefitsBlock>` Server Component which reads
 *   session per request.
 *
 * Phase 1: emits no `Offer` JSON-LD (booking infra is gated by
 * Phase 6 — see AGENTS.md §4ter). FAQPage JSON-LD optional and
 * deferred to Sprint 4 when the FAQ copy is fact-checked.
 *
 * Skill: nextjs-app-router + loyalty-program + seo-technical.
 *
 * `force-dynamic` is required because the page emits JSON-LD blocks
 * whose `<script type="application/ld+json">` carries the per-request
 * CSP nonce. ISR would silently strip the nonce and break browser
 * execution — see `structured-data-schema-org/SKILL.md` §CSP-nonce-contract.
 */
export const dynamic = 'force-dynamic';

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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) notFound();
  const locale: Locale = raw;
  setRequestLocale(locale);

  const [t, tBenefits, user] = await Promise.all([
    getTranslations('clubLanding'),
    getTranslations('clubBenefits'),
    getOptionalUser(),
  ]);

  const viewerTier: Loyalty.Tier = await resolveTier(user?.id);
  const isAnon = user === null;
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
          // Phase 1: priced tier is announced but the actual €99/an
          // activation is gated by Phase 6 (Stripe Checkout). We do
          // NOT emit a priceSpecification yet — Google would then
          // expect a working purchase flow on the URL.
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
      <header className="mb-10">
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
          <Link
            href="/le-concierge-club/prestige"
            className="border-border text-fg hover:bg-muted/10 focus-visible:ring-ring inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('secondaryCta')}
          </Link>
        </div>
        <p className="text-muted mt-4 max-w-2xl text-xs">{t('trustNote')}</p>
      </header>

      <section aria-labelledby="club-value-heading" className="mb-10 grid gap-6 sm:grid-cols-3">
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

      <section className="mb-12">
        <ClubBenefitsBlock
          locale={locale}
          viewerTier={viewerTier}
          hotelBenefits={[]}
          littlePersonalisationEnabled={false}
        />
      </section>

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

async function resolveTier(userId: string | undefined): Promise<Loyalty.Tier> {
  if (userId === undefined) return 'anon';
  const member = await getLoyaltyMember(userId);
  return member?.tier ?? 'club';
}
