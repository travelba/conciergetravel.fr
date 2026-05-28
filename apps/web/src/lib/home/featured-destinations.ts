import 'server-only';

import type { HomeDestinationCardData } from '@/components/home/home-destination-grid';
import type { Locale } from '@/i18n/routing';

/**
 * Curated 8 destinations strip on the home grid — « Là où le Concierge
 * aime envoyer ses clients » (PO décision 2026-05-28).
 *
 * The set mixes three surface types so every link lands on a real
 * editorial page, not a 404:
 *
 * - `city`    — FR cities with a published `/destination/[slug]` hub.
 *               Hint copy uses the live published-hotel count so the
 *               number stays in sync with the catalogue.
 * - `country` — countries with a dedicated `/guide/<country>` page
 *               (Italie, Japon, Maroc, États-Unis today).
 * - `ranking` — countries that don't have a guide yet but already own
 *               a published ranking (`meilleurs-hotels-grece`,
 *               `meilleurs-hotels-royaume-uni`). When the guide ships
 *               later, flip the variant to `country` and remove the
 *               ranking entry from `editorial_rankings` cross-link if
 *               needed — the user-facing label doesn't change.
 *
 * Order in the array matches the visual order on the home grid (2×4
 * desktop, 2×4 tablet, 1×8 mobile). The PO asked for Paris and Côte
 * d'Azur first to signal the FR heritage, then a mix of intl gems.
 */

interface CityDef {
  readonly variant: 'city';
  readonly key: string;
  readonly citySlug: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

interface CountryDef {
  readonly variant: 'country';
  readonly key: string;
  readonly href: '/guide/italie' | '/guide/japon' | '/guide/maroc' | '/guide/etats-unis';
  readonly labelFr: string;
  readonly labelEn: string;
}

interface RankingDef {
  readonly variant: 'ranking';
  readonly key: string;
  readonly rankingSlug: string;
  readonly labelFr: string;
  readonly labelEn: string;
}

type DestinationDef = CityDef | CountryDef | RankingDef;

/**
 * The canonical 8 destinations. Editorial order, not alphabetic.
 *
 * Note on Côte d'Azur — the canonical city slug is `cannes` (cluster
 * head on `LIEUX`, also used by `TOP_DESTINATION_NAV_ENTRIES`). The
 * label reads "Côte d'Azur" to align with how the PO frames the cluster
 * editorially.
 */
const HOME_DESTINATIONS: readonly DestinationDef[] = [
  {
    variant: 'city',
    key: 'paris',
    citySlug: 'paris',
    labelFr: 'Paris',
    labelEn: 'Paris',
  },
  {
    variant: 'city',
    key: 'cote-d-azur',
    citySlug: 'cannes',
    labelFr: "Côte d'Azur",
    labelEn: 'French Riviera',
  },
  {
    variant: 'country',
    key: 'italie',
    href: '/guide/italie',
    labelFr: 'Italie',
    labelEn: 'Italy',
  },
  {
    variant: 'ranking',
    key: 'grece',
    rankingSlug: 'meilleurs-hotels-grece',
    labelFr: 'Grèce',
    labelEn: 'Greece',
  },
  {
    variant: 'country',
    key: 'japon',
    href: '/guide/japon',
    labelFr: 'Japon',
    labelEn: 'Japan',
  },
  {
    variant: 'country',
    key: 'maroc',
    href: '/guide/maroc',
    labelFr: 'Maroc',
    labelEn: 'Morocco',
  },
  {
    variant: 'country',
    key: 'etats-unis',
    href: '/guide/etats-unis',
    labelFr: 'États-Unis',
    labelEn: 'United States',
  },
  {
    variant: 'ranking',
    key: 'royaume-uni',
    rankingSlug: 'meilleurs-hotels-royaume-uni',
    labelFr: 'Royaume-Uni',
    labelEn: 'United Kingdom',
  },
];

/**
 * Build the 8 destination cards for `<HomeDestinationGrid>`.
 *
 * `cityCounts` is the live `slug → published_count` map from
 * `listPublishedCities()`. We use it to attach a hint label
 * ("X adresses") on the city variants so the grid stays honest about
 * the catalogue density (currently 250+ Paris, 30+ Cannes). When a
 * city has 0 published rows in a degraded environment, the hint
 * gracefully collapses to an empty string instead of "0 adresses".
 */
export function pickHomeDestinations(
  cityCounts: ReadonlyMap<string, number>,
  locale: Locale,
  hotelCountLabel: (count: number) => string,
): readonly HomeDestinationCardData[] {
  const isEn = locale === 'en';
  const out: HomeDestinationCardData[] = [];

  for (const def of HOME_DESTINATIONS) {
    const label = isEn ? def.labelEn : def.labelFr;
    if (def.variant === 'city') {
      const count = cityCounts.get(def.citySlug) ?? 0;
      out.push({
        key: def.key,
        label,
        variant: 'city',
        citySlug: def.citySlug,
        hint: count > 0 ? hotelCountLabel(count) : '',
      });
    } else if (def.variant === 'country') {
      out.push({
        key: def.key,
        label,
        variant: 'country',
        href: def.href,
      });
    } else {
      out.push({
        key: def.key,
        label,
        variant: 'ranking',
        rankingSlug: def.rankingSlug,
      });
    }
  }
  return out;
}
