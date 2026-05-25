/**
 * fix-rc-uncountry.ts — patch the 13 R&C hotels whose country couldn't be
 * derived from the FR breadcrumb (the city was listed but the country line
 * was suppressed by the JS hydration race on the page).
 *
 * Resolves them via a manual url_slug → country mapping. Also excludes the
 * two cruise ships ("Le Ponant — Caraïbes" + "Le Ponant" Méditerranée),
 * which are not hotels and shouldn't enter public.hotels.
 *
 * Idempotent — re-running is safe.
 *
 * Usage:
 *   pnpm tsx src/global-sources/fix-rc-uncountry.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

interface CountryFix {
  readonly country_code: string;
  readonly country_fr: string;
  readonly country_en: string;
}

const FIX_BY_SLUG: Readonly<Record<string, CountryFix | 'EXCLUDE'>> = {
  'eden-roc-cap-cana': {
    code: 'DO',
    country_code: 'DO',
    country_fr: 'République dominicaine',
    country_en: 'Dominican Republic',
  } as unknown as CountryFix, // narrow below
  'la-maison-20-degres-sud': { country_code: 'MU', country_fr: 'Maurice', country_en: 'Mauritius' },
  'le-bora-bora': {
    country_code: 'PF',
    country_fr: 'Polynésie française',
    country_en: 'French Polynesia',
  },
  'le-nuku-hiva': {
    country_code: 'PF',
    country_fr: 'Polynésie française',
    country_en: 'French Polynesia',
  },
  'le-ponant-caraibes': 'EXCLUDE', // cruise ship, not a hotel
  'le-ponant-mediterranee': 'EXCLUDE', // cruise ship, not a hotel
  'delfin-amazon-cruises': 'EXCLUDE', // river cruise, not a hotel
  'le-taha-a': {
    country_code: 'PF',
    country_fr: 'Polynésie française',
    country_en: 'French Polynesia',
  },
  'le-tikehau': {
    country_code: 'PF',
    country_fr: 'Polynésie française',
    country_en: 'French Polynesia',
  },
  'pine-cay': {
    country_code: 'TC',
    country_fr: 'Îles Turques-et-Caïques',
    country_en: 'Turks and Caicos',
  },
  'sitatunga-private-island': {
    country_code: 'BW',
    country_fr: 'Botswana',
    country_en: 'Botswana',
  },
  'villa-32': { country_code: 'TW', country_fr: 'Taïwan', country_en: 'Taiwan' },
  'volando-urai-spring-spa-resort': {
    country_code: 'TW',
    country_fr: 'Taïwan',
    country_en: 'Taiwan',
  },
  'yihe-mansions': { country_code: 'CN', country_fr: 'Chine', country_en: 'China' },
};

// Re-narrow the explicit cast for the first entry
(FIX_BY_SLUG as unknown as Record<string, CountryFix>)['eden-roc-cap-cana'] = {
  country_code: 'DO',
  country_fr: 'République dominicaine',
  country_en: 'Dominican Republic',
};

// Some hotels also have wrong city ("Botswana" as city → fix to a real city)
const CITY_FIX_BY_SLUG: Readonly<Record<string, string>> = {
  'sitatunga-private-island': 'Okavango Delta',
  // Pine Cay is on an eponymous private island, but Providenciales is fine as the closest hub.
  // These remained city-null in the JSON-LD; we provide the nearest known town.
  'anjajavy-le-lodge': 'Anjajavy',
  'duba-plains-camp': 'Okavango Delta',
};

interface AggregatedHotel {
  url_slug: string;
  rc_url: string;
  name: string;
  city: string | null;
  country_code: string | null;
  country_fr: string | null;
  country_en: string | null;
  michelin_stars: number | null;
  michelin_green_star: boolean | null;
  number_of_rooms: number | null;
  number_of_meeting_rooms: number | null;
  mice_max_capacity: number | null;
  pet_friendly: boolean | null;
  has_pool: boolean | null;
  has_spa: boolean | null;
  short_tagline_fr: string | null;
}

function main(): void {
  const file = resolve(ROOT, 'rc-hotels.json');
  const hotels: AggregatedHotel[] = JSON.parse(readFileSync(file, 'utf8'));

  let patched = 0;
  let excluded = 0;
  const out: AggregatedHotel[] = [];

  for (const h of hotels) {
    const fix = FIX_BY_SLUG[h.url_slug];
    if (fix === 'EXCLUDE') {
      console.log(`[exclude] ${h.url_slug} (cruise ship, not a hotel)`);
      excluded++;
      continue;
    }
    if (h.country_code === null && fix) {
      h.country_code = fix.country_code;
      h.country_fr = fix.country_fr;
      h.country_en = fix.country_en;
      patched++;
      console.log(`[patch] ${h.url_slug} → ${fix.country_code} (${fix.country_fr})`);
    }
    const cityFix = CITY_FIX_BY_SLUG[h.url_slug];
    if (cityFix && h.city !== cityFix) {
      console.log(`[city]  ${h.url_slug}: "${h.city}" → "${cityFix}"`);
      h.city = cityFix;
    }
    out.push(h);
  }

  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\n[done] ${out.length} hotels (patched=${patched}, excluded=${excluded})`);

  const missing = out.filter((h) => h.country_code === null);
  if (missing.length > 0) {
    console.warn(`\n[warn] ${missing.length} hotels STILL without country_code:`);
    for (const m of missing) console.warn(`       ${m.url_slug} (${m.name} / ${m.city})`);
  } else {
    console.log(`[ok]   100% of hotels now have a country_code`);
  }
}

main();
