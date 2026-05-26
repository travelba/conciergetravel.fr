import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Link } from '@/i18n/navigation';

import { HERITAGE_FLAT_NAV_HREFS, HERITAGE_FLAT_NAV_LABEL_KEYS } from './heritage-nav-config';

const headerLinkClass =
  'text-on-surface-variant hover:text-primary-heritage focus-visible:ring-primary-heritage text-label-caps tracking-caps inline-flex h-full items-center px-1 transition-colors focus-visible:outline-none focus-visible:ring-2';

const mobileLinkClass =
  'text-primary-heritage hover:bg-surface-container-low focus-visible:ring-primary-heritage rounded-md px-3 py-2.5 text-base focus-visible:outline-none focus-visible:ring-2';

interface HeritageFlatNavProps {
  readonly layout: 'header' | 'mobile';
}

/**
 * Stitch "L'Héritage Editorial" — 4 flat nav entries (Destinations, Guides,
 * Classements, Concierge). Replaces mega-menus on hotel fiches only.
 */
export async function HeritageFlatNav({ layout }: HeritageFlatNavProps): Promise<ReactElement> {
  const t = await getTranslations('header');

  if (layout === 'mobile') {
    return (
      <ul className="flex flex-col gap-1">
        {HERITAGE_FLAT_NAV_HREFS.map((item, index) => {
          const labelKey = HERITAGE_FLAT_NAV_LABEL_KEYS[index];
          if (labelKey === undefined) return null;
          return (
            <li key={item.pathname}>
              <Link href={item.pathname} className={mobileLinkClass}>
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      {HERITAGE_FLAT_NAV_HREFS.map((item, index) => {
        const labelKey = HERITAGE_FLAT_NAV_LABEL_KEYS[index];
        if (labelKey === undefined) return null;
        return (
          <Link key={item.pathname} href={item.pathname} className={headerLinkClass}>
            {t(labelKey)}
          </Link>
        );
      })}
    </>
  );
}
