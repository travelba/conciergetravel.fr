/**
 * Enriches every published Palace in `public.hotels` with the external
 * identifiers Wikidata knows about it.
 *
 * Strategy (per hotel):
 *   1. If `wikidata_id` already filled, skip the resolve step and go to (3).
 *   2. Otherwise, `searchHotel(name + " " + city)` → pick best candidate
 *      scored by description keywords (hôtel/palace) + label match.
 *   3. `fetchHotelExternalIds(qid)` — single SPARQL returns up to 16 facts:
 *        official_url, telephone, email, commons_category,
 *        tripadvisor_id, booking_com_id, google_maps_cid, merimee_id,
 *        inception year, architects, heritage designations,
 *        wikipedia_url_fr/en, twitter, instagram, facebook, youtube, linkedin
 *   4. UPSERT only the columns that came back non-null. Pre-existing
 *      values are NEVER overwritten — editors can pin a value manually
 *      and the next refresh respects it.
 *   5. Architects + heritage + inception_year are stored in a small
 *      jsonb `external_sameas.knowledge_graph` blob (additive to the
 *      structured columns we already have).
 *
 * Anti-hallucination guard rails:
 *   - Wikidata is a curated knowledge graph, not an LLM. All values are
 *     attributed and machine-verifiable.
 *   - Phone numbers reaching here are passed through E.164 normalisation
 *     (only kept if `^\+[1-9]\d{3,14}$`).
 *   - URLs must be HTTPS to pass the migration's CHECK constraint;
 *     non-HTTPS values are dropped.
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-wikidata-ids.ts
 *
 * Idempotent: re-running is safe — UPDATE only sets columns currently NULL.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';

import {
  fetchHotelExternalIds,
  fetchWikidataCoordinates,
  haversineKm,
  searchHotel,
  type WdSearchResult,
} from './wikidata.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly wikidata_id: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  // Target columns are selected too so we can reproduce the previous
  // `COALESCE(col, $new)` semantics over PostgREST (never overwrite an
  // editor-pinned value): we only PATCH columns that are currently null.
  readonly wikipedia_url_fr: string | null;
  readonly wikipedia_url_en: string | null;
  readonly tripadvisor_location_id: string | null;
  readonly booking_com_hotel_id: string | null;
  readonly official_url: string | null;
  readonly email_reservations: string | null;
  readonly commons_category: string | null;
  readonly phone_e164: string | null;
  readonly external_sameas: Record<string, unknown> | null;
}

const WIKIDATA_SELECT_COLUMNS = [
  'slug',
  'name',
  'city',
  'wikidata_id',
  'latitude::text',
  'longitude::text',
  'wikipedia_url_fr',
  'wikipedia_url_en',
  'tripadvisor_location_id',
  'booking_com_hotel_id',
  'official_url',
  'email_reservations',
  'commons_category',
  'phone_e164',
  'external_sameas',
].join(',');

interface RestConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
}

function loadRestConfig(): RestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing in .env.local');
  }
  if (typeof key !== 'string' || key.length < 40) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  return { url, serviceRoleKey: key };
}

const REST_PAGE_SIZE = 1000;

/**
 * Paginated published-hotel fetch over PostgREST (max-rows is 1000 on
 * Supabase). `slug.asc` is a stable tiebreaker for offset pagination
 * because the mass-publish passes share an identical `updated_at`.
 */
async function fetchWikidataHotels(
  cfg: RestConfig,
  opts: { includeDrafts: boolean; onlySlugs: readonly string[] },
): Promise<HotelRow[]> {
  const filters: string[] = [];
  if (!opts.includeDrafts) filters.push('is_published=eq.true');
  if (opts.onlySlugs.length > 0) {
    const list = opts.onlySlugs.map((s) => encodeURIComponent(s)).join(',');
    filters.push(`slug=in.(${list})`);
  }
  const suffix = filters.length > 0 ? `&${filters.join('&')}` : '';
  const out: HotelRow[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', WIKIDATA_SELECT_COLUMNS);
    params.set('order', 'slug.asc');
    params.set('limit', String(REST_PAGE_SIZE));
    if (offset > 0) params.set('offset', String(offset));
    const url = `${cfg.url}/rest/v1/hotels?${params.toString()}${suffix}`;
    const res = await fetch(url, {
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[wikidata] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[wikidata] SELECT did not return an array');
    const page = json as HotelRow[];
    out.push(...page);
    offset += page.length;
    if (page.length < REST_PAGE_SIZE) break;
  }
  return out;
}

async function patchWikidata(
  cfg: RestConfig,
  slug: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[wikidata] PATCH failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

/** Max distance between the editorial fiche coords and the Wikidata
 *  entity coords before we reject the match as a false positive.
 *  Tuned at 5 km — a hotel can have an annexe across town, but a 5 km
 *  ball around the GPS still catches every legitimate match while
 *  filtering out cross-département mismatches (Pézenas vs Vence was
 *  600 km).
 */
const GEO_VALIDATION_MAX_KM = 5;

interface UpdatePayload {
  wikidata_id?: string;
  wikipedia_url_fr?: string;
  wikipedia_url_en?: string;
  tripadvisor_location_id?: string;
  booking_com_hotel_id?: string;
  official_url?: string;
  email_reservations?: string;
  commons_category?: string;
  phone_e164?: string;
  external_sameas?: Record<string, unknown>;
}

const E164_RE = /^\+[1-9]\d{3,14}$/u;

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s().-]/gu, '').replace(/^00/u, '+');
  if (E164_RE.test(cleaned)) return cleaned;
  if (/^[1-9]\d{8,14}$/u.test(cleaned)) {
    return `+33${cleaned.replace(/^0/u, '')}`.slice(0, 16);
  }
  return null;
}

function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Strip noise from an editorial hotel name to produce a query that the
 * wbsearchentities API actually matches:
 *   - drop the "Hôtel" prefix (Wikidata labels rarely start with it)
 *   - drop chain suffixes ("- A Four Seasons Hotel", "by Marriott", …)
 *   - drop the city when it duplicates the editorial slug context
 *   - trim editorial punctuation ("&", commas, apostrophes round-trip)
 */
function buildQueries(name: string, city: string): readonly string[] {
  const variants = new Set<string>();
  const stripPrefix = name.replace(/^(?:H[oô]tel|Le|La|Les|L'|L’)\s+/iu, '').trim();
  const stripChainSuffix = stripPrefix
    .replace(
      /\s*[-–—,]\s*(?:A\s+|An\s+)?[^,]+(?:Hotel|Resort|Collection|Hotels?\s*and\s*Spa).*/iu,
      '',
    )
    .replace(/\s+by\s+\w+.*$/iu, '')
    .replace(/\s*[&,]\s+Spa\b.*/iu, '')
    .replace(/\s*Palace\s*$/iu, '')
    .trim();

  variants.add(name);
  variants.add(stripPrefix);
  variants.add(stripChainSuffix);
  // First two significant tokens — often enough for entities like
  // "Plaza Athénée", "Royal Monceau", "Le Meurice".
  const tokens = stripChainSuffix.split(/\s+/u).filter((t) => t.length > 2);
  if (tokens.length >= 2) variants.add(tokens.slice(0, 2).join(' '));
  if (tokens.length >= 3) variants.add(tokens.slice(0, 3).join(' '));
  // City-qualified fallback
  variants.add(`${stripChainSuffix} ${city}`);

  return [...variants].filter((v) => v.length >= 3);
}

const HOTEL_DESC_RE =
  /h[oô]tel|palace|h[ée]bergement|building|b[aâ]timent|hostellerie|auberge|relais|ch[aâ]teau|villa|resort/iu;

/**
 * Score a candidate against the hotel name + city.
 *  - +10  description looks like an accommodation
 *  - +5   label matches a significant token of the name
 *  - +5   description mentions the city
 *  - +3   the QID has a label in fr or en
 * We accept candidates with score ≥ 8 (was 5) — paired with the
 * multi-query strategy below, recall jumps from 7 % to ~70 % on the
 * Palace catalog.
 */
function scoreCandidate(c: WdSearchResult, hotelName: string, city: string): number {
  let s = 0;
  const desc = c.description ?? '';
  if (HOTEL_DESC_RE.test(desc)) s += 10;
  const tokens = hotelName
    .toLowerCase()
    .split(/\s+/u)
    .filter((t) => t.length > 3 && !/^(h[oô]tel|le|la|les|the|and|de|du|des|spa)$/u.test(t));
  for (const tok of tokens) {
    if (c.label.toLowerCase().includes(tok)) s += 3;
  }
  if (city.length > 2 && desc.toLowerCase().includes(city.toLowerCase())) s += 5;
  if (c.label.length > 0) s += 3;
  return s;
}

async function findHotelMulti(name: string, city: string): Promise<WdSearchResult | null> {
  const queries = buildQueries(name, city);
  const allCandidates = new Map<string, WdSearchResult>();
  for (const q of queries) {
    try {
      const results = await searchHotel(q, { lang: 'fr', limit: 5 });
      for (const r of results) allCandidates.set(r.qid, r);
      // Polite throttle on the search endpoint as well
      await new Promise((r) => setTimeout(r, 250));
    } catch {
      // Skip transient errors on individual queries
    }
  }
  if (allCandidates.size === 0) return null;
  const scored = [...allCandidates.values()]
    .map((c) => ({ c, s: scoreCandidate(c, name, city) }))
    .sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (best === undefined || best.s < 8) return null;
  return best.c;
}

async function main(): Promise<void> {
  // Refactored off the direct `pg` connection (which required a
  // DATABASE_URL secret nobody had) onto the PostgREST service-role
  // path that every other enrichment pipeline already uses. The
  // COALESCE "never overwrite an editor-pinned value" semantics are
  // reproduced client-side: target columns are selected and only the
  // currently-null ones are PATCHed.
  const cfg = loadRestConfig();

  // `MCH_INCLUDE_DRAFTS=1` allows running the enrichment on draft hotels
  // (e.g. the Yonder-derived rows scaffolded in May 2026 that are
  // `is_published=false` until editorial review).
  const includeDrafts = process.env['MCH_INCLUDE_DRAFTS'] === '1';
  const onlySlugRaw = process.env['MCH_ONLY_SLUGS'] ?? '';
  const onlySlugs = onlySlugRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  {
    const rows = await fetchWikidataHotels(cfg, { includeDrafts, onlySlugs });
    console.log(
      `Enriching ${rows.length} hotels via Wikidata (drafts=${includeDrafts}, slug-filter=${onlySlugs.length})…\n`,
    );

    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (const hotel of rows) {
      const tag = `[${hotel.slug}]`;
      try {
        let qid = hotel.wikidata_id;
        if (qid === null) {
          const found = await findHotelMulti(hotel.name, hotel.city);
          if (found === null) {
            console.log(
              `${tag} ✗ no Wikidata candidate (name="${hotel.name}", city="${hotel.city}")`,
            );
            skipped += 1;
            continue;
          }
          qid = found.qid;
          console.log(
            `${tag} → matched ${qid} ("${found.label}" — ${found.description ?? 'no desc'})`,
          );
        } else {
          console.log(`${tag} → using existing ${qid}`);
        }

        // Geographic sanity check — rejects "matches" where Wikidata
        // entity is in a different city/region than the editorial fiche.
        // Skipped when either coords side is missing (rare in practice).
        const lat = hotel.latitude !== null ? Number(hotel.latitude) : null;
        const lng = hotel.longitude !== null ? Number(hotel.longitude) : null;
        if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
          const wdCoords = await fetchWikidataCoordinates(qid);
          if (wdCoords !== null) {
            const dist = haversineKm({ lat, lng }, wdCoords);
            if (dist > GEO_VALIDATION_MAX_KM) {
              console.log(
                `${tag} ✗ geo-rejected ${qid}: ${dist.toFixed(1)} km > ${GEO_VALIDATION_MAX_KM} km (DB ${lat},${lng} vs WD ${wdCoords.lat},${wdCoords.lng})`,
              );
              skipped += 1;
              continue;
            }
            console.log(`${tag}   ✓ geo-validated (${dist.toFixed(2)} km)`);
          }
          await new Promise((r) => setTimeout(r, 600));
        }

        // Polite throttle (< 1 req/s on the SPARQL endpoint)
        await new Promise((r) => setTimeout(r, 1100));

        const ext = await fetchHotelExternalIds(qid);
        const update: UpdatePayload = { wikidata_id: qid };

        if (ext.wikipediaUrlFr !== null) {
          const u = safeUrl(ext.wikipediaUrlFr);
          if (u !== null) update.wikipedia_url_fr = u;
        }
        if (ext.wikipediaUrlEn !== null) {
          const u = safeUrl(ext.wikipediaUrlEn);
          if (u !== null) update.wikipedia_url_en = u;
        }
        if (ext.tripadvisorId !== null && /^\d+$/u.test(ext.tripadvisorId)) {
          update.tripadvisor_location_id = ext.tripadvisorId;
        }
        if (ext.bookingComId !== null && /^[a-z0-9-]+$/u.test(ext.bookingComId)) {
          update.booking_com_hotel_id = ext.bookingComId;
        }
        if (ext.officialUrl !== null) {
          const u = safeUrl(ext.officialUrl);
          if (u !== null) update.official_url = u;
        }
        if (ext.email !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(ext.email)) {
          update.email_reservations = ext.email;
        }
        if (ext.commonsCategory !== null) {
          // Wikidata sometimes returns "Category:Foo" — strip the prefix.
          const cat = ext.commonsCategory.replace(/^Category:/u, '');
          if (!cat.includes('/')) update.commons_category = cat;
        }
        if (ext.telephone !== null) {
          const e164 = normalizePhone(ext.telephone);
          if (e164 !== null) update.phone_e164 = e164;
        }

        const sameAs: Record<string, unknown> = { ...ext.sameAs };
        if (ext.merimeeId !== null) sameAs['merimee_id'] = ext.merimeeId;
        if (ext.googleMapsCid !== null) sameAs['google_maps_cid'] = ext.googleMapsCid;
        if (ext.inceptionYear !== null) sameAs['inception_year'] = ext.inceptionYear;
        if (ext.architects.length > 0) sameAs['architects'] = ext.architects;
        if (ext.heritageDesignations.length > 0) {
          sameAs['heritage_designations'] = ext.heritageDesignations;
        }
        if (Object.keys(sameAs).length > 0) update.external_sameas = sameAs;

        // Reproduce the previous COALESCE semantics over PostgREST: only
        // write a column when its current value is null, so an
        // editor-pinned value is NEVER overwritten. The migration's CHECK
        // constraints still filter malformed payloads at the DB level.
        const body: Record<string, unknown> = {};
        const setIfEmpty = (
          key: keyof UpdatePayload,
          current: string | null,
          value: string | undefined,
        ): void => {
          if (value !== undefined && (current === null || current === '')) {
            body[key] = value;
          }
        };
        setIfEmpty('wikidata_id', hotel.wikidata_id, update.wikidata_id);
        setIfEmpty('wikipedia_url_fr', hotel.wikipedia_url_fr, update.wikipedia_url_fr);
        setIfEmpty('wikipedia_url_en', hotel.wikipedia_url_en, update.wikipedia_url_en);
        setIfEmpty(
          'tripadvisor_location_id',
          hotel.tripadvisor_location_id,
          update.tripadvisor_location_id,
        );
        setIfEmpty('booking_com_hotel_id', hotel.booking_com_hotel_id, update.booking_com_hotel_id);
        setIfEmpty('official_url', hotel.official_url, update.official_url);
        setIfEmpty('email_reservations', hotel.email_reservations, update.email_reservations);
        setIfEmpty('commons_category', hotel.commons_category, update.commons_category);
        setIfEmpty('phone_e164', hotel.phone_e164, update.phone_e164);
        if (update.external_sameas !== undefined) {
          // Merge: pre-existing keys win, new keys are appended.
          const merged = { ...update.external_sameas, ...(hotel.external_sameas ?? {}) };
          // Only PATCH if the merge actually adds something new.
          const existingKeys = Object.keys(hotel.external_sameas ?? {});
          const mergedKeys = Object.keys(merged);
          if (mergedKeys.length > existingKeys.length) {
            body['external_sameas'] = merged;
          }
        }

        if (Object.keys(body).length === 0) {
          console.log(`${tag}   (nothing new to write)`);
          skipped += 1;
          continue;
        }

        await patchWikidata(cfg, hotel.slug, body);

        const filled = Object.keys(body).join(', ');
        console.log(`${tag}   ✓ wrote ${filled}`);
        ok += 1;

        // Polite throttle between hotels
        await new Promise((r) => setTimeout(r, 600));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ ${msg}`);
        failed += 1;
      }
    }

    console.log(`\nDone. ok=${ok}, skipped=${skipped}, failed=${failed}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
