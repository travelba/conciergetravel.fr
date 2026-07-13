import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { DEMO_RANKING } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export default async function RankingsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ranking');

  return (
    <div className="ui-v2-container py-8">
      <h1>{t('title')}</h1>
      <ul className="mt-8 flex flex-col gap-3">
        <li>
          <Link
            href={{ pathname: '/classement/[slug]', params: { slug: DEMO_RANKING.slug } }}
            className="block rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-5 py-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
          >
            {DEMO_RANKING.title}
          </Link>
        </li>
      </ul>
    </div>
  );
}
