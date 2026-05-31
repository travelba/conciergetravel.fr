import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Editorial brand families surfaced as cross-link clusters. Detection
 * runs against the hotel name (case-insensitive). The order matters:
 * narrower needles win (e.g. `Ritz-Carlton Reserve` before `Ritz-Carlton`).
 *
 * Each family produces a stable slug that powers `/marque/[slug]`.
 *
 * ## Two-tier detection (2026-05-29)
 *
 * - `pattern !== null` → regex match against the hotel name. Detects
 *   un-affiliated rows (legacy catalogue, draft scaffolds) and the
 *   hotels whose `affiliations[]` column is still empty.
 * - `pattern === null` → no regex available (ambiguous needle, or brand
 *   identified solely via the structured `affiliations[]` column).
 *   The `/marque/[brandSlug]` route still resolves the slug from
 *   `affiliationBrandSlugs` on the index card.
 *
 * Either way, `KNOWN_BRANDS` is the source of truth for static params.
 * Brand slugs in `BRAND_FAMILIES` MUST stay aligned with `facet_slug`
 * values written by migration 0063 (so the JSON-LD `Brand.identifier`
 * → `/marque/<slug>` link never produces a soft-404).
 */
const BRAND_FAMILIES: readonly {
  slug: string;
  label: string;
  pattern: RegExp | null;
}[] = [
  // ── International collections (ADR-0021 — added 2026-05-28) ────────────
  // Aman: 37 published hotels — pattern matches "Aman Tokyo", "Amanjena",
  // "Amanpuri", … but NOT unrelated names like "Hotel Amano" (anchored
  // at start of name + must be followed by uppercase word boundary or
  // another lowercase letter for the portmanteau form).
  { slug: 'aman', label: 'Aman', pattern: /^aman(\b|[a-z])/iu },
  { slug: 'belmond', label: 'Belmond', pattern: /\bbelmond\b/iu },
  { slug: 'six-senses', label: 'Six Senses', pattern: /six\s*senses/iu },
  { slug: 'bulgari', label: 'Bulgari', pattern: /\bbulgari\b/iu },
  {
    slug: 'auberge-resorts',
    label: 'Auberge Resorts Collection',
    pattern: /auberge\s*resorts/iu,
  },
  // ── French + Asian author collections ──────────────────────────────────
  { slug: 'cheval-blanc', label: 'Cheval Blanc', pattern: /cheval\s*blanc/iu },
  { slug: 'airelles', label: 'Airelles', pattern: /\bairelles\b/iu },
  { slug: 'four-seasons', label: 'Four Seasons', pattern: /four\s*seasons/iu },
  { slug: 'rosewood', label: 'Rosewood', pattern: /\brosewood\b/iu },
  { slug: 'raffles', label: 'Raffles', pattern: /\braffles\b/iu },
  { slug: 'peninsula', label: 'The Peninsula', pattern: /\bpeninsula\b/iu },
  { slug: 'mandarin-oriental', label: 'Mandarin Oriental', pattern: /mandarin\s*oriental/iu },
  { slug: 'shangri-la', label: 'Shangri-La', pattern: /shangri-?\s*la/iu },
  { slug: 'park-hyatt', label: 'Park Hyatt', pattern: /park\s*hyatt/iu },
  {
    slug: 'oetker-collection',
    label: 'Oetker Collection',
    pattern: /(le\s*bristol|hôtel\s*du\s*cap|fouquet's|lapog[ée]e|l'apog[ée]e)/iu,
  },
  {
    slug: 'dorchester-collection',
    label: 'Dorchester Collection',
    pattern: /(le\s*meurice|plaza\s*ath[ée]n[ée]e)/iu,
  },
  { slug: 'les-k2', label: 'Les K2 Collections', pattern: /\bk2\b/iu },
  { slug: 'caudalie', label: 'Caudalie', pattern: /caudalie/iu },
  // ── Major American/Middle-Eastern/Asian chains backfilled by migration
  //    0063 (`affiliations[].kind = 'brand'`). Order matters: narrower
  //    needles like `ritz-carlton-reserve` must precede `ritz-carlton`.
  // ── 2026-05-29 ───────────────────────────────────────────────────────
  {
    slug: 'ritz-carlton-reserve',
    label: 'The Ritz-Carlton Reserve',
    pattern: /ritz[.\s-]*carlton[.\s-]*reserve/iu,
  },
  { slug: 'ritz-carlton', label: 'The Ritz-Carlton', pattern: /ritz[.\s-]*carlton/iu },
  { slug: 'st-regis', label: 'St. Regis', pattern: /\bst\.?\s*regis\b/iu },
  { slug: 'waldorf-astoria', label: 'Waldorf Astoria', pattern: /waldorf[\s-]*astoria/iu },
  { slug: 'fairmont', label: 'Fairmont', pattern: /\bfairmont\b/iu },
  { slug: 'kempinski', label: 'Kempinski', pattern: /\bkempinski\b/iu },
  { slug: 'anantara', label: 'Anantara', pattern: /\banantara\b/iu },
  { slug: 'jumeirah', label: 'Jumeirah', pattern: /\bjumeirah\b/iu },
  { slug: 'como', label: 'COMO Hotels', pattern: /\bcomo\b/iu },
  { slug: 'capella', label: 'Capella', pattern: /\bcapella\b/iu },
  { slug: 'viceroy', label: 'Viceroy', pattern: /\bviceroy\b/iu },
  { slug: 'soneva', label: 'Soneva', pattern: /\bsoneva\b/iu },
  { slug: 'nayara', label: 'Nayara', pattern: /\bnayara\b/iu },
  // No regex — name overlaps too easily with the English word "grace".
  // Resolved exclusively through the affiliations facet slug.
  { slug: 'grace-hotels', label: 'Grace Hotels', pattern: null },
  // Alias of `dorchester-collection` written by migration 0063. The two
  // co-exist transitionally; the route handler treats them as synonyms.
  { slug: 'dorchester', label: 'Dorchester Collection', pattern: null },
];

/**
 * Detects the editorial brand family for a hotel from its name.
 * Returns `null` when no family matches — independent properties
 * (Negresco, Lutetia, Crillon, Villa La Coste, etc.) stay un-clustered.
 *
 * Families with `pattern === null` are skipped (they rely on the
 * structured `affiliations[]` column instead).
 */
export function detectBrand(name: string): { slug: string; label: string } | null {
  for (const f of BRAND_FAMILIES) {
    if (f.pattern === null) continue;
    if (f.pattern.test(name)) return { slug: f.slug, label: f.label };
  }
  return null;
}

/** All known brand families — surfaced by the `/marque/[slug]` index. */
export const KNOWN_BRANDS = BRAND_FAMILIES.map((f) => ({ slug: f.slug, label: f.label }));

const RelatedHotelRowSchema = z.object({
  slug: z.string(),
  slug_en: z.string().nullable(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string(),
  // International hotels have NULL region (migration 0033). Coerce to empty
  // string so the existing UI (which treats region as `string`) keeps
  // working — the consumer falls back to country labels for non-FR hotels.
  region: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  stars: z.number().int(),
  is_palace: z.boolean(),
  hero_image: z.string().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
});

export type RelatedHotelRow = z.infer<typeof RelatedHotelRowSchema>;

export interface RelatedHotelsBundle {
  /** Other Palaces in the same city, capped to 6. */
  readonly sameCity: readonly RelatedHotelRow[];
  /** Other Palaces of the same brand family (across cities), capped to 6. */
  readonly sameBrand: readonly RelatedHotelRow[];
  /** Brand label + slug when the family was detected. */
  readonly brand: { readonly slug: string; readonly label: string } | null;
  /** Other Palaces in the same region (excluding `sameCity`), capped to 6. */
  readonly sameRegion: readonly RelatedHotelRow[];
}

const RELATED_COLUMNS =
  'slug, slug_en, name, name_en, city, region, stars, is_palace, hero_image, description_fr, description_en';

/**
 * Fetches the related-hotels bundle for the maillage interne (skill:
 * seo-technical §Maillage). One query per cluster (city, region) plus
 * one in-memory brand filter — at most three Supabase round-trips,
 * cached implicitly by Next.js because the helper is called from a
 * Server Component on an ISR route.
 *
 * Self is always excluded.
 */
export async function getRelatedHotels(args: {
  readonly currentSlug: string;
  readonly city: string;
  readonly region: string;
  readonly name: string;
}): Promise<RelatedHotelsBundle> {
  const supabase = getSupabaseAdminClient();
  const brand = detectBrand(args.name);

  // 1. Same city — ordered by `priority` then `name` for stable output.
  const cityRes = await supabase
    .from('hotels')
    .select(RELATED_COLUMNS)
    .eq('is_published', true)
    .eq('city', args.city)
    .neq('slug', args.currentSlug)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .limit(6);

  // 2. Same region (excluding the current city to keep clusters distinct).
  const regionRes = await supabase
    .from('hotels')
    .select(RELATED_COLUMNS)
    .eq('is_published', true)
    .eq('region', args.region)
    .neq('city', args.city)
    .neq('slug', args.currentSlug)
    .order('priority', { ascending: true })
    .order('name', { ascending: true })
    .limit(6);

  // 3. Same brand — we don't have a `brand` column yet, so we widen the
  //    query to the published catalog and filter in memory. With 30
  //    rows this is fine; once we cross ~500 properties we'll add a
  //    `brand_slug` column + index.
  const sameBrand: RelatedHotelRow[] = [];
  if (brand !== null) {
    const brandRes = await supabase
      .from('hotels')
      .select(RELATED_COLUMNS)
      .eq('is_published', true)
      .neq('slug', args.currentSlug)
      .order('priority', { ascending: true })
      .order('name', { ascending: true })
      .limit(100);
    const data = brandRes.data ?? [];
    for (const row of data) {
      const parsed = RelatedHotelRowSchema.safeParse(row);
      if (!parsed.success) continue;
      const detected = detectBrand(parsed.data.name);
      if (detected !== null && detected.slug === brand.slug) {
        sameBrand.push(parsed.data);
        if (sameBrand.length >= 6) break;
      }
    }
  }

  const parseList = (raw: unknown): RelatedHotelRow[] => {
    if (!Array.isArray(raw)) return [];
    const out: RelatedHotelRow[] = [];
    for (const r of raw) {
      const p = RelatedHotelRowSchema.safeParse(r);
      if (p.success) out.push(p.data);
    }
    return out;
  };

  return {
    sameCity: parseList(cityRes.data),
    sameBrand,
    brand,
    sameRegion: parseList(regionRes.data),
  };
}
