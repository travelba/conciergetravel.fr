import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { pickByLocale } from '@/i18n/supported-locale';
import type { GuideLookup } from '@/server/itineraries/get-related-data';

interface RelatedGuidesProps {
  readonly locale: Locale;
  readonly guides: readonly GuideLookup[];
}

/**
 * Cross-link to editorial destination guides (CDC §6 mesh). Anchor
 * text uses the localised guide name — short and explicit, no
 * "see also" filler.
 */
export async function RelatedGuides({ locale, guides }: RelatedGuidesProps) {
  if (guides.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'itineraires.detail' });

  return (
    <section id="related-guides" className="mt-14 scroll-mt-24">
      <h2 className="text-fg mb-6 font-serif text-2xl md:text-3xl">{t('relatedGuidesHeading')}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {guides.map((g) => {
          const name = pickByLocale(locale, g.nameFr, g.nameEn ?? g.nameFr);
          const summary = pickByLocale(locale, g.summaryFr ?? '', g.summaryEn ?? g.summaryFr ?? '');
          return (
            <li key={g.slug}>
              <Link
                href={{ pathname: '/guide/[citySlug]', params: { citySlug: g.slug } }}
                className="border-border bg-bg group flex flex-col gap-2 rounded-md border p-4 hover:border-amber-400"
              >
                <span className="text-fg text-sm font-medium">{name}</span>
                {summary.length > 0 ? (
                  <span className="text-muted line-clamp-2 text-xs">{summary}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
