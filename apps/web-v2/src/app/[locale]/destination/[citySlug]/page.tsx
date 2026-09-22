import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { DEMO_DESTINATIONS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export default async function DestinationCityPage({
  params,
}: {
  params: Promise<{ locale: string; citySlug: string }>;
}) {
  const { locale, citySlug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('destination');

  const destination = DEMO_DESTINATIONS.find((d) => d.slug === citySlug);
  if (destination === undefined) notFound();

  return (
    <div className="ui-v2-container py-8">
      <Link
        href="/destination"
        className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        ← {t('backToHub')}
      </Link>
      <header className="mb-8 mt-4">
        <h1>{t('cityTitle', { city: destination.label })}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('citySubtitle')}</p>
      </header>
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <p className="text-sm text-[var(--color-muted)]">{t('placeholder')}</p>
        <Link
          href={{
            pathname: '/hotels/[pays]/[ville]',
            params: { pays: destination.countrySlug, ville: destination.slug },
          }}
          className="mt-4 inline-block text-sm font-medium text-[var(--color-fg)] underline-offset-4 hover:underline"
        >
          {t('browseHotels', { city: destination.label })}
        </Link>
      </div>
    </div>
  );
}
