import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function ItinerairesHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('itineraires');

  return (
    <div className="ui-v2-container py-8">
      <header className="mb-8">
        <h1>{t('title')}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <p className="text-sm text-[var(--color-muted)]">{t('placeholder')}</p>
      </div>
    </div>
  );
}
