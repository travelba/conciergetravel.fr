import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default async function BrandHubPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('taxonomy');

  const label = slug.replace(/-/g, ' ');

  return (
    <div className="ui-v2-container py-8">
      <Link
        href="/hotels"
        className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        ← {t('backToCatalogue')}
      </Link>
      <header className="mb-8 mt-4">
        <h1>{t('brandTitle', { label })}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('brandSubtitle')}</p>
      </header>
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <p className="text-sm text-[var(--color-muted)]">{t('placeholder')}</p>
      </div>
    </div>
  );
}
