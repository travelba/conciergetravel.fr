import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FooterV2, HeaderV2 } from '@mch/ui-v2';

import { Link } from '@/i18n/navigation';
import { isRoutingLocale, routing } from '@/i18n/routing';
import '@/styles/globals.css';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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
  const t = await getTranslations('header');
  const tf = await getTranslations('footer');

  const tabs = [
    { id: 'stays', label: t('tabs.stays'), href: '/', active: false },
    { id: 'rankings', label: t('tabs.rankings'), href: '/classements', active: false },
    { id: 'hotels', label: t('tabs.hotels'), href: '/hotels', active: false },
    {
      id: 'member',
      label: t('tabs.member'),
      href: '/programme-membre',
      active: false,
    },
  ];

  const footerColumns = [
    {
      id: 'discover',
      title: tf('discover'),
      links: [
        { id: 'search', label: t('tabs.stays'), href: '/recherche' },
        { id: 'rankings', label: t('tabs.rankings'), href: '/classements' },
        { id: 'hotels', label: t('tabs.hotels'), href: '/hotels' },
      ],
    },
    {
      id: 'account',
      title: tf('account'),
      links: [
        { id: 'account', label: t('account'), href: '/compte' },
        { id: 'member', label: t('tabs.member'), href: '/programme-membre' },
      ],
    },
  ];

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col bg-[var(--color-bg)] antialiased">
        <NextIntlClientProvider messages={messages}>
          <HeaderV2
            logo={
              <Link href="/" className="font-serif text-xl text-[var(--color-fg)]">
                MyConciergeHotel
              </Link>
            }
            tabs={tabs}
            localeLabel={locale === 'fr' ? 'FR' : 'EN'}
            currencyLabel={t('currency')}
            accountLabel={t('account')}
            accountHref="/compte"
            helpHref="/le-concierge/faq"
          />
          <main className="flex-1">{children}</main>
          <FooterV2 columns={footerColumns} tagline={tf('tagline')} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
