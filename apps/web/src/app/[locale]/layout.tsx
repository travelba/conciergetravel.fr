import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Outfit, EB_Garamond } from 'next/font/google';
import { ConditionalAnalytics } from '@/components/analytics';
import { ConsentBanner } from '@/components/consent';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteSeoJsonLd } from '@/components/seo/site-json-ld';
import { Toaster } from '@mch/ui';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, routing } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import '@/styles/globals.css';
import '@/styles/kit.css';

// Body / UI font — validated brand dossier (DA crème/taupe): Outfit (sans).
const sans = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500'],
});

// Editorial / headline font — validated brand dossier (DA crème/taupe).
// EB Garamond — timeless editorial serif (titles, quotes, prices). Headings
// only; Outfit stays the body workhorse. No yellow gold, no trend-driven type.
const serif = EB_Garamond({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['400', '500'],
  style: ['normal', 'italic'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const locale = raw;
  return {
    alternates: {
      canonical: getPathname({ locale, href: '/' }),
      languages: buildHreflangAlternates((l) => getPathname({ locale: l, href: '/' })),
    },
    openGraph: {
      type: 'website',
      locale: ogLocale(locale),
      siteName: 'MyConciergeHotel',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isRoutingLocale(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  // Site-wide brand Organization (OTA) JSON-LD — the single source of truth
  // for the MyConciergeHotel entity, present on every page so search engines
  // and LLMs can resolve the brand from any URL (it carries a stable `@id`).
  // The CSP nonce is read here at the layout boundary (NOT inside a leaf RSC —
  // see `components/seo/json-ld.tsx`); on the few `force-static` routes
  // `headers()` yields no nonce, which is acceptable (low-priority legal pages).
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        <SiteSeoJsonLd locale={locale} nonce={nonce} />
        <NextIntlClientProvider messages={messages}>
          <SiteHeader />
          {/*
            Visible fil d'ariane (ADR-0014 §2.4) — mirror of the per-page
            `BreadcrumbList` JSON-LD. Returns `null` on the home page.
          */}
          <Breadcrumb />
          {/*
            `#main` is the skip-link target. Mark it as `role="main"` /
            `<main>`-equivalent landmark via the `id` and `tabIndex={-1}`
            so screen readers and keyboard users can jump straight from
            the header skip-link to the page content.
          */}
          <div id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </div>
          <SiteFooter />
          <ConsentBanner />
          {/* Global toast surface (sober-luxe styled) — see @mch/ui Toaster. */}
          <Toaster />
          {/*
            Consent-gated analytics — Vercel Analytics + Speed Insights
            only mount when `analytics === true` in the cookie. See
            `/components/analytics/conditional-analytics.tsx` and the
            cookie policy (`/cookies`).
          */}
          <ConditionalAnalytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
