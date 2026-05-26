import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';

/**
 * `ConciergeSisterLinks` — shared sibling navigation strip for the
 * 6 Concierge institutional pages.
 *
 * Audit 2026-05-25: the institutional pages
 * (`/le-concierge`, `/le-conseil-du-concierge`,
 * `/le-concierge/methode-editoriale`, `/le-concierge/pour-les-hoteliers`,
 * `/le-concierge/mice-et-seminaires`, `/le-concierge/presse-et-partenaires`)
 * were a silo — each page referenced its siblings in plain prose
 * ("voir /le-concierge/methode-editoriale") but emitted zero
 * outbound `<Link>`. From an EEAT / internal-PageRank / UX
 * perspective this leaks crawl signal and forces visitors back to
 * the mega-menu to navigate the cluster.
 *
 * This Server Component renders the other 5 institutional pages as
 * compact cards (title + 1-line description) below the page body
 * and above the FAQ. The `currentSlug` prop excludes the present
 * page from the list.
 *
 * Translations live in the `conciergeNav` namespace
 * (`messages/{fr,en}.json#conciergeNav.items.<slug>`).
 *
 * Renders no JSON-LD — the breadcrumb on each page already wires
 * the parent/child relationships, and the sister links amplify
 * the existing `Organization`/`TravelAgency` Knowledge Panel
 * anchoring instead of duplicating the structured data.
 */

type SisterSlug = 'concierge' | 'conseil' | 'methode' | 'hoteliers' | 'mice' | 'presse';

interface SisterDef {
  readonly slug: SisterSlug;
  readonly href:
    | '/le-concierge'
    | '/le-conseil-du-concierge'
    | '/le-concierge/methode-editoriale'
    | '/le-concierge/pour-les-hoteliers'
    | '/le-concierge/mice-et-seminaires'
    | '/le-concierge/presse-et-partenaires';
}

const SISTERS: readonly SisterDef[] = [
  { slug: 'concierge', href: '/le-concierge' },
  { slug: 'conseil', href: '/le-conseil-du-concierge' },
  { slug: 'methode', href: '/le-concierge/methode-editoriale' },
  { slug: 'hoteliers', href: '/le-concierge/pour-les-hoteliers' },
  { slug: 'mice', href: '/le-concierge/mice-et-seminaires' },
  { slug: 'presse', href: '/le-concierge/presse-et-partenaires' },
];

export async function ConciergeSisterLinks({
  currentSlug,
}: {
  readonly currentSlug: SisterSlug;
}): Promise<ReactElement> {
  const t = await getTranslations('conciergeNav');
  const siblings = SISTERS.filter((s) => s.slug !== currentSlug);

  return (
    <section
      aria-labelledby="concierge-sister-title"
      className="border-border mt-14 border-t pt-10"
    >
      <h2
        id="concierge-sister-title"
        className="text-muted mb-6 text-xs font-medium uppercase tracking-[0.18em]"
      >
        {t('heading')}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {siblings.map((sibling) => (
          <li key={sibling.slug}>
            <Link
              href={sibling.href}
              className="border-border bg-bg hover:border-fg/40 focus-visible:ring-ring block h-full rounded-lg border p-4 transition focus-visible:outline-none focus-visible:ring-2"
            >
              <h3 className="text-fg font-serif text-base">{t(`items.${sibling.slug}.title`)}</h3>
              <p className="text-muted mt-1.5 text-xs leading-relaxed">
                {t(`items.${sibling.slug}.lede`)}
              </p>
              <span className="text-fg mt-3 inline-block text-xs font-medium underline-offset-4 group-hover:underline">
                {t('cta')} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
