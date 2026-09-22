import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export default async function RankingsAxisPage({
  params,
}: {
  params: Promise<{ locale: string; axe: string; valeur: string }>;
}) {
  const { locale, axe, valeur } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('rankingAxis');

  return (
    <div className="ui-v2-container py-8">
      <Link
        href="/classements"
        className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        ← {t('backToRankings')}
      </Link>
      <header className="mb-8 mt-4">
        <h1>{t('title', { axe, valeur: valeur.replace(/-/g, ' ') })}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <p className="text-sm text-[var(--color-muted)]">{t('placeholder')}</p>
      </div>
    </div>
  );
}
