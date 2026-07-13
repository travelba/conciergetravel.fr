import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { DEMO_DESTINATIONS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export default async function DestinationHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('destination');

  return (
    <div className="ui-v2-container py-8">
      <header className="mb-8">
        <h1>{t('hubTitle')}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('hubSubtitle')}</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_DESTINATIONS.map((dest) => (
          <li key={dest.slug}>
            <Link
              href={{ pathname: '/destination/[citySlug]', params: { citySlug: dest.slug } }}
              className="flex items-center justify-between rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-5 py-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="font-medium">{dest.label}</span>
              <span className="text-sm text-[var(--color-muted)]">
                {t('hotelCount', { count: dest.hotelCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
