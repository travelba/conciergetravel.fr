import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Playfair_Display } from 'next/font/google';
import { ConditionalAnalytics } from '@/components/analytics';
import { ConsentBanner } from '@/components/consent';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, routing } from '@/i18n/routing';
import { buildHreflangAlternates, ogLocale } from '@/i18n/runtime';
import '@/styles/globals.css';

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const serif = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  weight: ['500', '600', '700'],
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

  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body className="flex min-h-dvh flex-col">
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
