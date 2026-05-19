import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { intlLocaleTag } from '@/i18n/runtime';

interface LastUpdatedBadgeProps {
  /** ISO 8601 date or `YYYY-MM-DD`. */
  readonly isoDate: string | null | undefined;
  readonly locale: Locale;
  readonly variant?: 'inline' | 'block';
}

/**
 * Triple-sync freshness signal (CDC §6 + .cursor/rules/seo-geo.mdc).
 * Visible UI ↔ sitemap.xml `<lastmod>` ↔ JSON-LD `dateModified`.
 *
 * Use in two flavours:
 *   - `inline` — sits under the H1, single line ("Mise à jour le …").
 *   - `block`  — small standalone card, used in editorial sidebars.
 *
 * Server Component — calls `getTranslations` directly. The badge is
 * rendered on routes that already opt into per-locale rendering, so
 * the synchronous `await` carries no extra cost beyond the existing
 * route boundary.
 */
export async function LastUpdatedBadge({
  isoDate,
  locale,
  variant = 'inline',
}: LastUpdatedBadgeProps) {
  if (typeof isoDate !== 'string' || isoDate.length === 0) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  let formatted: string;
  try {
    formatted = new Intl.DateTimeFormat(intlLocaleTag(locale), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    formatted = isoDate.slice(0, 10);
  }
  const t = await getTranslations({ locale, namespace: 'lastUpdated' });
  const label = t(variant, { date: formatted });

  if (variant === 'block') {
    return (
      <aside
        className="border-border/60 text-muted/90 bg-bg/40 my-3 inline-flex items-center gap-2 rounded border px-3 py-1 text-xs"
        aria-label={label}
      >
        <span aria-hidden="true">🕓</span>
        <time dateTime={isoDate.slice(0, 10)}>{label}</time>
      </aside>
    );
  }
  return (
    <p className="text-muted/80 mt-3 text-xs" aria-label={label}>
      <time dateTime={isoDate.slice(0, 10)}>{label}</time>
    </p>
  );
}
