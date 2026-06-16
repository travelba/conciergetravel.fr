/**
 * Single-hotel Algolia re-indexer (skill: search-engineering).
 *
 * The `promote-*-golden` scripts write editorial/photo content straight to
 * `public.hotels` via PostgREST — they bypass Payload, so the Payload
 * `afterChange` hook (`syncHotelPublicationToAlgolia`) never fires and the
 * row silently drifts out of the search index. That is exactly how Conrad
 * Los Angeles ended up published but unsearchable (2026-06-16).
 *
 * This helper closes the gap: every golden promote calls
 * `reindexHotelInAlgolia(cfg, slug)` after its PATCH so the FR + EN
 * `hotels_<locale>` records are upserted (or deleted when the row is
 * unpublished), reusing the exact mappers the hook + bulk reindexer use.
 *
 * It is deliberately **non-throwing**: a missing Algolia env or a transient
 * Algolia outage logs a warning but never fails the promote (the catalogue
 * write already succeeded). Run the bulk `search:reindex -- --rest` to
 * recover any rows that warned here.
 */

import {
  createAlgoliaIndexingService,
  HotelSourceRowSchema,
  syncHotelPublicationToAlgolia,
} from '@mch/integrations/algolia-admin';

import type { SupabaseRestConfig } from '../hotels/supabase-hotels.js';

const HOTEL_COLUMNS = [
  'id',
  'slug',
  'slug_en',
  'name',
  'name_en',
  'city',
  'district',
  'region',
  'country_code',
  'country_label_fr',
  'country_label_en',
  'is_palace',
  'stars',
  'amenities',
  'highlights',
  'description_fr',
  'description_en',
  'is_little_catalog',
  'priority',
  'google_rating',
  'google_reviews_count',
  'is_published',
].join(',');

type RawHotel = Record<string, unknown>;

function str(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

async function fetchHotelRow(cfg: SupabaseRestConfig, slug: string): Promise<RawHotel | null> {
  const params = new URLSearchParams();
  params.set('select', HOTEL_COLUMNS);
  params.set('or', `(slug.eq.${slug},slug_en.eq.${slug})`);
  params.set('limit', '1');
  const url = `${cfg.url}/rest/v1/hotels?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(
      `[reindex-hotel] SELECT failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0) return null;
  return json[0] as RawHotel;
}

/**
 * Builds the indexer source shape from a raw `hotels` row, coalescing the
 * frequently-null `region` to the country label / ISO code so international
 * rows stay indexable — identical rule to the bulk reindexer.
 */
function toSourceRow(raw: RawHotel): Record<string, unknown> {
  const countryCode = str(raw['country_code']);
  const countryLabelFr = str(raw['country_label_fr']);
  const countryLabelEn = str(raw['country_label_en']);
  const region = str(raw['region']) ?? countryLabelFr ?? countryLabelEn ?? countryCode ?? '—';
  return {
    id: raw['id'],
    slug: raw['slug'],
    slug_en: raw['slug_en'] ?? null,
    name: raw['name'],
    name_en: raw['name_en'] ?? null,
    city: raw['city'],
    district: raw['district'] ?? null,
    region,
    country_code: countryCode,
    country_label_fr: countryLabelFr,
    country_label_en: countryLabelEn,
    is_palace: raw['is_palace'],
    stars: typeof raw['stars'] === 'string' ? Number(raw['stars']) : raw['stars'],
    amenities: raw['amenities'],
    highlights: raw['highlights'],
    description_fr: raw['description_fr'] ?? null,
    description_en: raw['description_en'] ?? null,
    is_little_catalog: raw['is_little_catalog'],
    priority: raw['priority'],
    google_rating: raw['google_rating'] ?? null,
    google_reviews_count:
      typeof raw['google_reviews_count'] === 'string'
        ? Number(raw['google_reviews_count'])
        : (raw['google_reviews_count'] ?? null),
    is_published: raw['is_published'],
  };
}

/**
 * Upserts (or deletes when unpublished) the FR + EN Algolia records for a
 * single hotel slug. Non-throwing — logs a warning and returns `false` on
 * any failure so the calling promote script is never broken by Algolia.
 */
export async function reindexHotelInAlgolia(
  cfg: SupabaseRestConfig,
  slug: string,
): Promise<boolean> {
  const appId = process.env['NEXT_PUBLIC_ALGOLIA_APP_ID'] ?? '';
  const apiKey = process.env['ALGOLIA_ADMIN_API_KEY'] ?? '';
  const indexPrefix = process.env['ALGOLIA_INDEX_PREFIX'] ?? 'dev_';
  if (appId.length === 0 || apiKey.length === 0) {
    console.warn(
      `[reindex-hotel] ⚠ skipped "${slug}" — missing NEXT_PUBLIC_ALGOLIA_APP_ID / ALGOLIA_ADMIN_API_KEY. ` +
        'Run `search:reindex -- --rest` later to sync the index.',
    );
    return false;
  }

  try {
    const raw = await fetchHotelRow(cfg, slug);
    if (raw === null) {
      console.warn(`[reindex-hotel] ⚠ no hotel row for "${slug}" — nothing to index.`);
      return false;
    }
    const parsed = HotelSourceRowSchema.safeParse(toSourceRow(raw));
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const detail = first ? `${first.path.join('.')}: ${first.message}` : 'invalid row';
      console.warn(`[reindex-hotel] ⚠ "${slug}" failed schema parse (${detail}) — skipped.`);
      return false;
    }
    const svc = createAlgoliaIndexingService({ appId, apiKey, indexPrefix });
    const result = await syncHotelPublicationToAlgolia(svc, parsed.data);
    if (!result.ok) {
      console.warn(`[reindex-hotel] ⚠ Algolia sync failed for "${slug}": ${result.error.kind}.`);
      return false;
    }
    const verb = parsed.data.is_published ? 'indexed (fr+en)' : 'removed (unpublished)';
    console.log(`[reindex-hotel] ✓ "${slug}" ${verb} → prefix="${indexPrefix}".`);
    return true;
  } catch (e: unknown) {
    console.warn(
      `[reindex-hotel] ⚠ "${slug}" reindex errored (non-fatal): ${e instanceof Error ? e.message : String(e)}`,
    );
    return false;
  }
}
