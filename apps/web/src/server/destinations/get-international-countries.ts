import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Per-country aggregate used by the homepage "Bientôt à l'international"
 * teaser. The count is the **total catalog count** (published + drafts)
 * so the teaser communicates the ambition of the expansion, not just
 * what is live. See ADR-tba (Phase 7 wakeup) and
 * `docs/editorial/yonder-intl-expansion-wakeup.md`.
 */
export interface InternationalCountry {
  readonly code: string;
  readonly labelFr: string | null;
  readonly labelEn: string | null;
  readonly count: number;
}

const CountryRowSchema = z.object({
  country_code: z.string().length(2),
  country_label_fr: z.string().nullish(),
  country_label_en: z.string().nullish(),
});

async function fetchInternationalCountries(): Promise<readonly InternationalCountry[]> {
  // All failure modes coerce to `[]` so the homepage renders an empty
  // teaser (or hides it) rather than a 500. Errors are logged for
  // observability — PII never reaches this query.
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('country_code, country_label_fr, country_label_en')
      .neq('country_code', 'FR')
      .limit(2000);
    if (error) {
      console.error('[destinations.intl-countries] Supabase returned error:', {
        message: error.message,
        code: error.code,
      });
      return [];
    }
    if (!Array.isArray(data)) return [];

    const counts = new Map<
      string,
      { code: string; labelFr: string | null; labelEn: string | null; count: number }
    >();
    for (const raw of data) {
      const parsed = CountryRowSchema.safeParse(raw);
      if (!parsed.success) continue;
      const row = parsed.data;
      const fr = row.country_label_fr ?? null;
      const en = row.country_label_en ?? null;
      const existing = counts.get(row.country_code);
      if (existing === undefined) {
        counts.set(row.country_code, {
          code: row.country_code,
          labelFr: fr,
          labelEn: en,
          count: 1,
        });
      } else {
        existing.count += 1;
        // Backfill labels lazily — an editor may have left them null
        // on the first row of a country but filled them on a later one.
        if (existing.labelFr === null && fr !== null) existing.labelFr = fr;
        if (existing.labelEn === null && en !== null) existing.labelEn = en;
      }
    }
    return [...counts.values()];
  } catch (e) {
    console.error(
      '[destinations.intl-countries] fetchInternationalCountries threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return [];
  }
}

/**
 * Cached accessor — homepage teaser refreshes hourly. Bound to the
 * `intl-countries` tag so back-office mutations (e.g. publishing the
 * first guide, adding a new country) can invalidate via
 * `revalidateTag('intl-countries')`.
 */
export const listInternationalCountries = unstable_cache(
  fetchInternationalCountries,
  ['intl-countries-v1'],
  { revalidate: 3600, tags: ['intl-countries'] },
);
