import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { DEMO_COUNTRIES } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export default async function HotelsDirectoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('hotels');

  return (
    <div className="ui-v2-container py-8">
      <h1>{t('directoryTitle')}</h1>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_COUNTRIES.map((country) => (
          <li key={country.slug}>
            <Link
              href={{ pathname: '/hotels/[pays]', params: { pays: country.slug } }}
              className="flex items-center justify-between rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-5 py-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="font-medium">{country.label}</span>
              <span className="text-sm text-[var(--color-muted)]">{country.hotelCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
