import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

type AccountSubPageProps = {
  readonly params: Promise<{ locale: string }>;
  readonly namespace:
    | 'account.tripsPage'
    | 'account.favoritesPage'
    | 'account.profilePage'
    | 'account.preferencesPage'
    | 'account.securityPage'
    | 'account.privacyPage';
};

export async function AccountSubPage({
  params,
  namespace,
}: AccountSubPageProps): Promise<React.ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations(namespace);
  const tAccount = await getTranslations('account');

  return (
    <div className="ui-v2-container py-8">
      <Link
        href="/compte"
        className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
      >
        ← {tAccount('backToHub')}
      </Link>
      <header className="mb-8 mt-4">
        <h1>{t('title')}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <p className="text-sm text-[var(--color-muted)]">{t('placeholder')}</p>
      </div>
    </div>
  );
}
