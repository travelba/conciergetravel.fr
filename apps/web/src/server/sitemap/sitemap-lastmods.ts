import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Real `<lastmod>` values for the sitemap index (skill: seo-technical,
 * GSC audit 2026-06-29 §5.3).
 *
 * The index previously stamped every sub-sitemap with `new Date()` at
 * render time — seven identical timestamps that Google treats as
 * unreliable and therefore ignores for recrawl prioritisation. We now
 * derive each sub-sitemap's `<lastmod>` from `MAX(updated_at)` of the
 * published content it actually lists, so a real editorial edit (and
 * only a real edit) moves the freshness signal.
 *
 * Every query is independent and defensive: a failure (table/column
 * drift, Supabase blip) falls back to `null`, and the caller substitutes
 * the current time for that one sub-sitemap rather than dropping the
 * index. The route stays correct even if a single aggregate fails.
 */
export interface SitemapLastmods {
  readonly hotels: string;
  readonly rooms: string;
  readonly hubs: string;
  readonly guides: string;
  readonly rankings: string;
  readonly itineraries: string;
  readonly places: string;
}

function pickIso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Latest non-null timestamp, or `null` if both are absent. */
function maxIso(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

async function maxHotelsUpdatedAt(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return pickIso(data.updated_at);
  } catch {
    return null;
  }
}

async function maxRankingsUpdatedAt(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('editorial_rankings')
      .select('updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return pickIso(data.updated_at);
  } catch {
    return null;
  }
}

async function maxGuidesUpdatedAt(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('editorial_guides')
      .select('updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return pickIso(data.updated_at);
  } catch {
    return null;
  }
}

async function maxItinerariesUpdatedAt(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('itineraries')
      .select('updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return pickIso(data.updated_at);
  } catch {
    return null;
  }
}

async function maxPlacesUpdatedAt(): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('places')
      .select('updated_at')
      .eq('is_published', true)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error !== null || data === null) return null;
    return pickIso(data.updated_at);
  } catch {
    return null;
  }
}

/**
 * Resolves real per-sub-sitemap `<lastmod>` values. Missing aggregates
 * fall back to `now` so the index always carries a timestamp.
 *
 * Mapping rationale:
 *   - `rooms.xml` freshness is bounded by hotel edits (room sub-pages
 *     re-crawl when the parent fiche changes), so it reuses the hotels
 *     max — no separate `hotel_rooms` query needed.
 *   - `hubs.xml` lists destinations + the inlined city guides, so its
 *     freshness is `MAX(hotels, guides)`.
 */
export async function resolveSitemapLastmods(): Promise<SitemapLastmods> {
  const now = new Date().toISOString();
  const [hotels, rankings, guides, itineraries, places] = await Promise.all([
    maxHotelsUpdatedAt(),
    maxRankingsUpdatedAt(),
    maxGuidesUpdatedAt(),
    maxItinerariesUpdatedAt(),
    maxPlacesUpdatedAt(),
  ]);
  return {
    hotels: hotels ?? now,
    rooms: hotels ?? now,
    hubs: maxIso(hotels, guides) ?? now,
    guides: guides ?? now,
    rankings: rankings ?? now,
    itineraries: itineraries ?? now,
    places: places ?? now,
  };
}
