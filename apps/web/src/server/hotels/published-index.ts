import 'server-only';

import { unstable_cache } from 'next/cache';

import { parseAffiliationsLenient } from '@mch/db';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isValidSlug, type PublishedHotelIndexCard } from '@/server/hotels/get-hotel-by-slug';

const stringOrEmpty = z
  .string()
  .nullish()
  .transform((v) => (typeof v === 'string' ? v : null));

const PrioritySchema = z.enum(['P0', 'P1', 'P2']);

const HotelIndexRowSchema = z.object({
  slug: z.string(),
  slug_en: stringOrEmpty,
  name: z.string(),
  name_en: stringOrEmpty,
  city: z.string(),
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  stars: z.number().int().min(1).max(5),
  is_palace: z.boolean(),
  priority: PrioritySchema,
  hero_image: stringOrEmpty,
  description_fr: stringOrEmpty,
  description_en: stringOrEmpty,
  country_code: z
    .string()
    .nullable()
    .transform((v) => (typeof v === 'string' && v.length === 2 ? v.toUpperCase() : null)),
  country_label_fr: stringOrEmpty,
  country_label_en: stringOrEmpty,
  affiliations: z.unknown().nullable().optional(),
});

const HOTEL_INDEX_COLUMNS =
  'slug, slug_en, name, name_en, city, region, stars, is_palace, priority, hero_image, description_fr, description_en, country_code, country_label_fr, country_label_en, affiliations';

/** Callers that passed 2500 wanted every published hotel. The old cap hid 427 rows. */
const FULL_INDEX_LIMIT = 2500;
const INDEX_PAGE_SIZE = 1000;
const INDEX_MAX_PAGES = 20;

function cardsFromIndexRows(data: readonly unknown[]): PublishedHotelIndexCard[] {
  const out: PublishedHotelIndexCard[] = [];
  for (const raw of data) {
    const parsed = HotelIndexRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;
    if (!isValidSlug(row.slug)) continue;
    const affs = parseAffiliationsLenient(row.affiliations).filter((a) => a.verified === true);
    const brandSlugs: string[] = [];
    const labelSlugs: string[] = [];
    const rankingSlugs: string[] = [];
    for (const a of affs) {
      if (typeof a.facet_slug !== 'string' || a.facet_slug.length === 0) continue;
      if (a.kind === 'brand' && !brandSlugs.includes(a.facet_slug)) brandSlugs.push(a.facet_slug);
      else if (a.kind === 'label' && !labelSlugs.includes(a.facet_slug))
        labelSlugs.push(a.facet_slug);
      else if (a.kind === 'ranking' && !rankingSlugs.includes(a.facet_slug))
        rankingSlugs.push(a.facet_slug);
    }
    out.push({
      slugFr: row.slug,
      slugEn:
        row.slug_en !== null && row.slug_en.length > 0 && isValidSlug(row.slug_en)
          ? row.slug_en
          : null,
      nameFr: row.name,
      nameEn: row.name_en !== null && row.name_en.length > 0 ? row.name_en : null,
      city: row.city,
      region: row.region,
      stars: row.stars,
      isPalace: row.is_palace,
      priority: row.priority,
      heroPublicId: row.hero_image,
      descriptionFr: row.description_fr,
      descriptionEn: row.description_en,
      countryCode: row.country_code,
      countryLabelFr: row.country_label_fr,
      countryLabelEn: row.country_label_en,
      affiliationBrandSlugs: brandSlugs,
      affiliationLabelSlugs: labelSlugs,
      affiliationRankingSlugs: rankingSlugs,
    });
  }
  return out;
}

async function fetchPublishedIndexPage(page: number): Promise<{
  cards: PublishedHotelIndexCard[];
  full: boolean;
}> {
  const supabase = getSupabaseAdminClient();
  const from = page * INDEX_PAGE_SIZE;
  const { data, error } = await supabase
    .from('hotels_published_list')
    .select(HOTEL_INDEX_COLUMNS)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .order('slug', { ascending: true })
    .range(from, from + INDEX_PAGE_SIZE - 1);
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message ?? 'published hotel index page failed');
  }
  return { cards: cardsFromIndexRows(data), full: data.length === INDEX_PAGE_SIZE };
}

const fetchPublishedIndexPageCached = unstable_cache(
  fetchPublishedIndexPage,
  ['published-hotel-index-page'],
  { revalidate: 3600, tags: ['hotels-catalogue'] },
);

async function loadAllPublishedHotelIndex(): Promise<readonly PublishedHotelIndexCard[]> {
  const out: PublishedHotelIndexCard[] = [];
  for (let page = 0; page < INDEX_MAX_PAGES; page += 1) {
    const { cards, full } = await fetchPublishedIndexPageCached(page);
    out.push(...cards);
    if (!full) break;
  }
  return out;
}

/**
 * Full published catalogue for hubs, marques and categories.
 * Descriptions come from `hotels_published_list` (320-character excerpts).
 * A limit of 2500 or more returns every row; a smaller limit keeps the head.
 */
export async function listPublishedHotelsForIndex(
  limit = 200,
): Promise<readonly PublishedHotelIndexCard[]> {
  try {
    const all = await loadAllPublishedHotelIndex();
    if (limit >= FULL_INDEX_LIMIT) return all;
    return all.slice(0, Math.max(0, limit));
  } catch (e) {
    console.error(
      '[listPublishedHotelsForIndex] failed:',
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}

async function readPublishedHotelsByAffiliation(
  facetSlug: string,
  kind: string,
  safeLimit: number,
): Promise<readonly PublishedHotelIndexCard[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('published_hotels_by_affiliation', {
    p_facet_slug: facetSlug,
    p_kind: kind.length > 0 ? kind : null,
    p_limit: safeLimit,
  });
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message ?? 'published hotels by affiliation failed');
  }
  return cardsFromIndexRows(data);
}

const readPublishedHotelsByAffiliationCached = unstable_cache(
  readPublishedHotelsByAffiliation,
  ['published-hotels-by-affiliation'],
  { revalidate: 3600, tags: ['hotels-catalogue'] },
);

export async function listPublishedHotelsByAffiliation(args: {
  readonly facetSlug: string;
  readonly kind?: 'brand' | 'label' | 'ranking' | 'guide';
  readonly limit?: number;
}): Promise<readonly PublishedHotelIndexCard[]> {
  try {
    return await readPublishedHotelsByAffiliationCached(
      args.facetSlug,
      args.kind ?? '',
      Math.max(1, Math.min(20000, args.limit ?? 20000)),
    );
  } catch (e) {
    console.error(
      '[listPublishedHotelsByAffiliation] failed:',
      e instanceof Error ? e.message : String(e),
    );
    return [];
  }
}
