import { env } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * /.well-known/hotels.jsonl — machine-readable catalog of published
 * hotels, one JSON object per line (JSONL aka NDJSON). Designed for
 * LLM agents and AI search engines (Perplexity, ChatGPT Search,
 * Claude with Atlas, Gemini Deep Research…) that prefer streaming-
 * friendly data formats over crawl-and-parse HTML.
 *
 * Why JSONL (not JSON array) ?
 *   - Streamable: an agent can parse N rows without loading the whole
 *     payload — important when our catalog grows to 100+ hotels.
 *   - One row per line: trivially diffable, log-friendly, greppable.
 *   - Same convention as `llms-full.txt` companions.
 *
 * Headers:
 *   - `Content-Type: application/x-ndjson` (canonical NDJSON MIME).
 *   - `Cache-Control: public, max-age=300, s-maxage=3600` so the CDN
 *     keeps a hot copy but client UAs refresh every 5 min.
 *   - `Access-Control-Allow-Origin: *` for cross-origin LLM crawlers.
 *
 * Per-row schema (stable contract — extend additively only):
 *   id, slug, slug_en, name, name_en, stars, is_palace, city, region,
 *   country, country_en, country_code, latitude, longitude, address,
 *   postal_code, url, url_en, hero_image (Cloudinary public_id),
 *   summary_fr, summary_en, booking_mode, has_palace_distinction, updated_at,
 *
 * `country` / `country_en` / `country_code` are read from the DB
 * (migration 0033, ISO-3166-1 alpha-2), NOT hardcoded — the catalogue
 * spans 91+ countries (ADR-0021). Legacy FR-only rows with a NULL code
 * fall back to FR / France. `summary_*` prefers the 150-char IA-ready
 * `factual_summary_*` and falls back to a truncated description.
 *   schema_org_type ("LodgingBusiness" | "Hotel"),
 *   external_ids: { wikidata, wikipedia_fr, wikipedia_en, tripadvisor,
 *                   booking_com, google_maps_cid, official_url }.
 *
 * Skill: geo-llm-optimization §Machine-readable surfaces.
 */

// force-dynamic: the catalogue is read fresh per request; CDN caching is
// handled by the explicit Cache-Control header below (no ISR revalidate).
export const dynamic = 'force-dynamic';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

function safeString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safeBool(v: unknown): boolean {
  return v === true;
}

/**
 * Compact a long description into a citation-friendly summary when no
 * `factual_summary` is available. Cuts on a word boundary to avoid
 * mangled tokens, keeping JSONL rows small at catalogue scale.
 */
function summarise(factual: string | null, description: string | null): string | null {
  if (factual !== null) return factual;
  if (description === null) return null;
  if (description.length <= 280) return description;
  const slice = description.slice(0, 280);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 200 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

export async function GET(): Promise<Response> {
  const origin = siteOrigin();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('hotels')
    .select(
      'id, slug, slug_en, name, name_en, stars, is_palace, city, region, ' +
        'country_code, country_label_fr, country_label_en, ' +
        'latitude, longitude, address, postal_code, hero_image, ' +
        'factual_summary_fr, factual_summary_en, description_fr, description_en, ' +
        'booking_mode, updated_at, ' +
        'wikidata_id, wikipedia_url_fr, wikipedia_url_en, tripadvisor_location_id, ' +
        'booking_com_hotel_id, official_url',
    )
    .eq('is_published', true)
    .order('is_palace', { ascending: false })
    .order('stars', { ascending: false })
    .order('name', { ascending: true });

  if (error !== null || data === null) {
    return new Response('Error reading hotel catalog\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const lines: string[] = [];
  for (const row of data as unknown[]) {
    const r = row as Record<string, unknown>;
    const slug = safeString(r['slug']);
    const slugEn = safeString(r['slug_en']);
    const name = safeString(r['name']);
    if (slug === null || name === null) continue;
    const summaryFr = summarise(
      safeString(r['factual_summary_fr']),
      safeString(r['description_fr']),
    );
    const summaryEn = summarise(
      safeString(r['factual_summary_en']),
      safeString(r['description_en']),
    );
    const stars = safeNumber(r['stars']);
    const isPalace = safeBool(r['is_palace']);
    const codeRaw = safeString(r['country_code']);
    const countryCode = codeRaw !== null && codeRaw.length === 2 ? codeRaw.toUpperCase() : 'FR';
    const countryFr = safeString(r['country_label_fr']) ?? (countryCode === 'FR' ? 'France' : null);
    const countryEn = safeString(r['country_label_en']) ?? (countryCode === 'FR' ? 'France' : null);
    const obj = {
      id: safeString(r['id']),
      slug,
      slug_en: slugEn,
      name,
      name_en: safeString(r['name_en']),
      stars: stars ?? null,
      is_palace: isPalace,
      schema_org_type: 'LodgingBusiness' as const,
      city: safeString(r['city']),
      region: safeString(r['region']),
      country: countryFr,
      country_en: countryEn,
      country_code: countryCode,
      address: safeString(r['address']),
      postal_code: safeString(r['postal_code']),
      latitude: safeNumber(r['latitude']),
      longitude: safeNumber(r['longitude']),
      url: `${origin}/fr/hotel/${slug}`,
      url_en: slugEn !== null ? `${origin}/en/hotel/${slugEn}` : null,
      hero_image: safeString(r['hero_image']),
      summary_fr: summaryFr,
      summary_en: summaryEn,
      booking_mode: safeString(r['booking_mode']),
      has_palace_distinction: isPalace,
      updated_at: safeString(r['updated_at']),
      external_ids: {
        wikidata: safeString(r['wikidata_id']),
        wikipedia_fr: safeString(r['wikipedia_url_fr']),
        wikipedia_en: safeString(r['wikipedia_url_en']),
        tripadvisor: safeString(r['tripadvisor_location_id']),
        booking_com: safeString(r['booking_com_hotel_id']),
        official_url: safeString(r['official_url']),
      },
    };
    lines.push(JSON.stringify(obj));
  }

  const body = lines.join('\n') + '\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Catalog-Count': String(lines.length),
    },
  });
}
