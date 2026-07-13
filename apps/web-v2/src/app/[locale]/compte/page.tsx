import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@mch/ui-v2';

import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

const ACCOUNT_TILES = [
  { id: 'trips', href: '/compte/voyages', icon: '🧳' },
  { id: 'favorites', href: '/compte/favoris', icon: '♥' },
  { id: 'profile', href: '/compte/profil', icon: '👤' },
  { id: 'preferences', href: '/compte/preferences', icon: '🔔' },
  { id: 'security', href: '/compte/securite', icon: '🔒' },
  { id: 'privacy', href: '/compte/confidentialite', icon: '🛡' },
  { id: 'member', href: '/programme-membre', icon: '★' },
] as const;

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('account');

  return (
    <div className="ui-v2-container py-8">
      <header className="mb-8">
        <h1>{t('title')}</h1>
        <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_TILES.map((tile) => (
          <Link
            key={tile.id}
            href={tile.href}
            className="flex min-h-[120px] flex-col justify-between rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
          >
            <span className="text-2xl" aria-hidden>
              {tile.icon}
            </span>
            <span className="font-medium">{t(tile.id)}</span>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-6">
        <Badge variant="member">Concierge Club</Badge>
        <p className="mt-3 text-sm text-[var(--color-muted)]">{t('signInPrompt')}</p>
      </div>
    </div>
  );
}
