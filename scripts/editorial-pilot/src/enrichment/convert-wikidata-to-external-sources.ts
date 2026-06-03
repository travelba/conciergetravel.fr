/**
 * convert-wikidata-to-external-sources.ts — convert the Wikidata-derived
 * identifiers already resolved on `public.hotels` (wikidata_id,
 * wikipedia_url_fr/en, official_url, tripadvisor_location_id,
 * booking_com_hotel_id, commons_category, external_sameas) into
 * provenance entries inside the `external_sources` jsonb array.
 *
 * Why this exists
 * ---------------
 * The 2026-05-28 audit showed only 26 / 2218 published hotels had any
 * `external_sources` data, while 1298 / 2218 already had a resolved
 * `wikidata_id` and 590 had `external_sameas` knowledge-graph facts.
 * That signal is sitting in scalar columns instead of the structured
 * provenance array that EEAT readers (Google, AI Overviews, Perplexity,
 * Claude, the editorial Sources block, agent-skills.json) actually
 * consume.
 *
 * This pipeline performs ZERO new external API calls — it only
 * re-projects what's already on disk. Idempotent: an entry is keyed by
 * `(source, field)` and re-running merges without duplicating.
 *
 * Shape produced (per entry — see ADR-0023 / migration 0038):
 *   {
 *     field: string,
 *     value: string | object | array,
 *     source: 'wikidata' | 'wikipedia' | 'wikimedia_commons' | 'tripadvisor' | 'booking_com',
 *     source_url?: string,
 *     confidence: 'high' | 'medium' | 'low',
 *     collected_at: string  // ISO timestamp
 *   }
 *
 * CLI:
 *   --slug=<slug>            single hotel (debug)
 *   --slugs=a,b,c            explicit list
 *   --limit=<N>              cap to N hotels
 *   --include-drafts         include rows where `is_published = false`
 *   --dry-run                print the diff, do NOT write back
 *
 * Examples:
 *   pnpm exec tsx scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts --limit=5 --dry-run
 *   pnpm exec tsx scripts/editorial-pilot/src/enrichment/convert-wikidata-to-external-sources.ts
 *
 * Skill: content-enrichment-pipeline, content-modeling, editorial-pilot.
 * ADR-0023 — affiliations vs external_sources.
 */

import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

// PostgREST occasionally proxies through a TLS cert whose chain my
// Windows store doesn't trust out of the box. Other editorial-pilot
// scripts already disable strict TLS for this exact reason — keep the
// behaviour consistent here so the script works on fresh laptops.
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] ??= '0';

// ─── PostgREST config ──────────────────────────────────────────────────────

interface PostgrestEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPostgrestEnv(): PostgrestEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error(
      '[convert-wikidata] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local',
    );
  }
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PostgrestEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

// ─── External source entry shape ───────────────────────────────────────────

type Confidence = 'high' | 'medium' | 'low';

interface ExternalSourceEntry {
  readonly field: string;
  readonly value: unknown;
  readonly source: string;
  readonly source_url?: string;
  readonly confidence: Confidence;
  readonly collected_at: string;
}

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly wikidata_id: string | null;
  readonly wikipedia_url_fr: string | null;
  readonly wikipedia_url_en: string | null;
  readonly official_url: string | null;
  readonly tripadvisor_location_id: string | null;
  readonly booking_com_hotel_id: string | null;
  readonly commons_category: string | null;
  readonly external_sameas: Record<string, unknown> | null;
  readonly external_sources: ReadonlyArray<ExternalSourceEntry> | null;
}

const SELECT_COLUMNS = [
  'slug',
  'name',
  'city',
  'wikidata_id',
  'wikipedia_url_fr',
  'wikipedia_url_en',
  'official_url',
  'tripadvisor_location_id',
  'booking_com_hotel_id',
  'commons_category',
  'external_sameas',
  'external_sources',
].join(',');

const REST_PAGE_SIZE = 1000;

interface FetchOptions {
  readonly includeDrafts: boolean;
  readonly onlySlugs: readonly string[];
}

async function fetchEligibleHotels(env: PostgrestEnv, opts: FetchOptions): Promise<HotelRow[]> {
  const out: HotelRow[] = [];
  let offset = 0;
  for (;;) {
    // Manual query string assembly — PostgREST's `or=(…)` operator
    // requires literal parentheses and comma-separated predicates with
    // no key encoding. `URLSearchParams` corrupts the operator into
    // something PostgREST tries to parse as a column (=> the famous
    // `column "or…id" does not exist` 400). Other pipelines in this
    // repo (`enrich-wikidata-ids.ts`) build the string by hand for the
    // same reason.
    const segments: string[] = [
      `select=${SELECT_COLUMNS}`,
      'order=slug.asc',
      `limit=${REST_PAGE_SIZE}`,
    ];
    if (offset > 0) segments.push(`offset=${offset}`);
    if (!opts.includeDrafts) segments.push('is_published=eq.true');
    segments.push(
      'or=(' +
        [
          'wikidata_id.not.is.null',
          'wikipedia_url_fr.not.is.null',
          'wikipedia_url_en.not.is.null',
          'official_url.not.is.null',
          'tripadvisor_location_id.not.is.null',
          'booking_com_hotel_id.not.is.null',
          'commons_category.not.is.null',
          'external_sameas.not.is.null',
        ].join(',') +
        ')',
    );
    if (opts.onlySlugs.length > 0) {
      const list = opts.onlySlugs.map((s) => encodeURIComponent(s)).join(',');
      segments.push(`slug=in.(${list})`);
    }
    const url = `${env.restBase}/hotels?${segments.join('&')}`;
    const res = await fetch(url, { headers: pgHeaders(env) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[convert-wikidata] SELECT failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('[convert-wikidata] SELECT did not return an array');
    const page = json as HotelRow[];
    out.push(...page);
    offset += page.length;
    if (page.length < REST_PAGE_SIZE) break;
  }
  return out;
}

async function patchExternalSources(
  env: PostgrestEnv,
  slug: string,
  next: ReadonlyArray<ExternalSourceEntry>,
): Promise<void> {
  const url = `${env.restBase}/hotels?slug=eq.${encodeURIComponent(slug)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: pgHeaders(env, { Prefer: 'return=minimal' }),
    body: JSON.stringify({ external_sources: next }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[convert-wikidata] PATCH ${slug} failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
}

// ─── Derivation rules ──────────────────────────────────────────────────────

function tripadvisorUrl(id: string): string {
  // TA's canonical /Hotel_Review-d{id} URL still resolves with the
  // numeric ID alone — the locality slug is for SEO, not for routing.
  return `https://www.tripadvisor.com/Hotel_Review-d${encodeURIComponent(id)}.html`;
}

function bookingComUrl(id: string): string {
  // booking.com slugs are `{country}/{name}.{locale}.html`; without the
  // country prefix the link still 302-redirects to the right property.
  return `https://www.booking.com/hotel/${encodeURIComponent(id)}.html`;
}

function commonsCategoryUrl(category: string): string {
  // Commons category names contain spaces — keep them so the URL
  // is human-readable. Wikimedia accepts encoded or decoded forms.
  return `https://commons.wikimedia.org/wiki/Category:${category.replace(/\s+/gu, '_')}`;
}

function wikidataItemUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
}

/**
 * SEO-squatter / OTA / booking-engine domains that the scaffold pass
 * scraped into `official_url` (see
 * `docs/audits/toxic-official-url-cleanup-2026-06-02.md`). We refuse to
 * project these into the EEAT provenance array — a spam link served to
 * Google + LLMs is worse than no link at all. Scoped to `official_url`
 * only: the canonical `tripadvisor.com` / `booking.com` URLs built from
 * the dedicated `*_location_id` / `*_hotel_id` columns ARE legitimate
 * references (their own footer kinds) and must NOT be filtered.
 *
 * OTA names are anchored to the registrable domain so brand domains that
 * merely end in `hotels.com` (rosewoodhotels.com, bulgarihotels.com,
 * comohotels.com, tajhotels.com, …) are NOT caught.
 */
const TOXIC_OFFICIAL_URL_RE =
  /(\.com-hotel\.(com|info))|(\.(ae-dubai|sa-riyadh|uk-hotel)\.info)|(:\/\/([a-z0-9-]+\.)*hotel[a-z]+\.info)|(h-rez\.com)|(:\/\/([a-z0-9-]+\.)*(tripadvisor\.[a-z.]+|trip\.com|booking\.com|agoda\.com|hotels\.com|expedia\.[a-z.]+|trivago\.[a-z.]+|kayak\.[a-z.]+|hostelworld\.com|ostrovok\.ru|makemytrip\.com))/iu;

function isToxicOfficialUrl(url: string): boolean {
  return TOXIC_OFFICIAL_URL_RE.test(url);
}

/**
 * Build the canonical set of `external_sources` entries that derive
 * from the scalar Wikidata-resolved columns on a hotel row.
 *
 * Each entry is fully self-describing — `source_url` always points to
 * a resource an LLM (or a human reviewer) can hit to verify the value.
 */
function deriveEntries(row: HotelRow, collectedAt: string): ExternalSourceEntry[] {
  const entries: ExternalSourceEntry[] = [];

  if (row.wikidata_id !== null && row.wikidata_id.length > 0) {
    entries.push({
      field: 'wikidata_id',
      value: row.wikidata_id,
      source: 'wikidata',
      source_url: wikidataItemUrl(row.wikidata_id),
      confidence: 'high',
      collected_at: collectedAt,
    });
  }

  if (row.wikipedia_url_fr !== null && row.wikipedia_url_fr.length > 0) {
    entries.push({
      field: 'wikipedia_url_fr',
      value: row.wikipedia_url_fr,
      source: 'wikipedia',
      source_url: row.wikipedia_url_fr,
      confidence: 'high',
      collected_at: collectedAt,
    });
  }

  if (row.wikipedia_url_en !== null && row.wikipedia_url_en.length > 0) {
    entries.push({
      field: 'wikipedia_url_en',
      value: row.wikipedia_url_en,
      source: 'wikipedia',
      source_url: row.wikipedia_url_en,
      confidence: 'high',
      collected_at: collectedAt,
    });
  }

  if (
    row.official_url !== null &&
    row.official_url.length > 0 &&
    !isToxicOfficialUrl(row.official_url)
  ) {
    // Provenance of `official_url` depends on how it was resolved:
    //  - row carries a `wikidata_id` → the URL came from Wikidata P856,
    //    attribute to `wikidata`, high confidence.
    //  - otherwise it was sourced by the editorial scaffold / Tavily pass
    //    → attribute to the site itself (`official_site`), medium
    //    confidence (not encyclopaedia-grounded). Mislabelling these as
    //    `wikidata` would serve a false attribution to LLMs through the
    //    `/api/agent/hotel-sources` endpoint. The footer reader maps by
    //    `field` (`official_url` → kind `official`) regardless of source,
    //    so this only refines the served attribution, not the rendering.
    const fromWikidata = row.wikidata_id !== null && row.wikidata_id.length > 0;
    entries.push({
      field: 'official_url',
      value: row.official_url,
      source: fromWikidata ? 'wikidata' : 'official_site',
      source_url: row.official_url,
      confidence: fromWikidata ? 'high' : 'medium',
      collected_at: collectedAt,
    });
  }

  if (row.tripadvisor_location_id !== null && row.tripadvisor_location_id.length > 0) {
    entries.push({
      field: 'tripadvisor_location_id',
      value: row.tripadvisor_location_id,
      source: 'tripadvisor',
      source_url: tripadvisorUrl(row.tripadvisor_location_id),
      // IDs come from Wikidata, not from a direct TA API call yet —
      // demote to medium until we ground them against the TA Content
      // API or scrape verification step.
      confidence: 'medium',
      collected_at: collectedAt,
    });
  }

  if (row.booking_com_hotel_id !== null && row.booking_com_hotel_id.length > 0) {
    entries.push({
      field: 'booking_com_hotel_id',
      value: row.booking_com_hotel_id,
      source: 'booking_com',
      source_url: bookingComUrl(row.booking_com_hotel_id),
      confidence: 'medium',
      collected_at: collectedAt,
    });
  }

  if (row.commons_category !== null && row.commons_category.length > 0) {
    entries.push({
      field: 'commons_category',
      value: row.commons_category,
      source: 'wikimedia_commons',
      source_url: commonsCategoryUrl(row.commons_category),
      confidence: 'high',
      collected_at: collectedAt,
    });
  }

  // Knowledge-graph blob → split into individual provenance entries.
  // Each blob key surfaces as its own `(source, field)` entry so the
  // downstream consumers can cite them independently (e.g. heritage
  // designation as a TrustSignal, inception year in the long
  // description).
  if (row.external_sameas !== null && typeof row.external_sameas === 'object') {
    const kg = row.external_sameas;
    const inception = kg['inception_year'];
    if (typeof inception === 'number' && Number.isFinite(inception) && inception > 1000) {
      entries.push({
        field: 'inception_year',
        value: inception,
        source: 'wikidata',
        source_url: row.wikidata_id !== null ? wikidataItemUrl(row.wikidata_id) : undefined,
        confidence: 'high',
        collected_at: collectedAt,
      } as ExternalSourceEntry);
    }
    const architects = kg['architects'];
    if (Array.isArray(architects) && architects.length > 0) {
      const filtered = architects.filter((a): a is string => typeof a === 'string' && a.length > 0);
      if (filtered.length > 0) {
        entries.push({
          field: 'architects',
          value: filtered,
          source: 'wikidata',
          source_url: row.wikidata_id !== null ? wikidataItemUrl(row.wikidata_id) : undefined,
          confidence: 'high',
          collected_at: collectedAt,
        } as ExternalSourceEntry);
      }
    }
    const heritage = kg['heritage_designations'];
    if (Array.isArray(heritage) && heritage.length > 0) {
      const filtered = heritage.filter((h): h is string => typeof h === 'string' && h.length > 0);
      if (filtered.length > 0) {
        entries.push({
          field: 'heritage_designations',
          value: filtered,
          source: 'wikidata',
          source_url: row.wikidata_id !== null ? wikidataItemUrl(row.wikidata_id) : undefined,
          confidence: 'high',
          collected_at: collectedAt,
        } as ExternalSourceEntry);
      }
    }

    // Social handles — each is its own EEAT signal (verifiable identity
    // claim that ties the entity to a public account). Confidence is
    // `high` because the URL is the value itself; if it 404s the LLM
    // simply ignores the link. We surface them under a generic
    // `social_handle` field with the platform encoded in `source` —
    // that keeps the (source, field) merge key collision-free across
    // platforms while letting downstream renderers group by source.
    const SOCIAL_FIELDS: ReadonlyArray<{ key: string; source: string; field: string }> = [
      { key: 'twitter', source: 'twitter', field: 'social_handle' },
      { key: 'instagram', source: 'instagram', field: 'social_handle' },
      { key: 'facebook', source: 'facebook', field: 'social_handle' },
      { key: 'youtube', source: 'youtube', field: 'social_handle' },
      { key: 'linkedin', source: 'linkedin', field: 'social_handle' },
    ];
    for (const def of SOCIAL_FIELDS) {
      const raw = kg[def.key];
      if (typeof raw !== 'string' || raw.length === 0) continue;
      // Wikidata stores these as URLs (P2002/Twitter, P2003/Instagram,
      // P2013/Facebook, P2397/YouTube, P4264/LinkedIn) — surface the
      // URL as both `value` and `source_url`.
      entries.push({
        field: def.field,
        value: raw,
        source: def.source,
        source_url: raw,
        confidence: 'high',
        collected_at: collectedAt,
      });
    }
  }

  return entries;
}

/**
 * Idempotent merge: keep every entry from `existing` whose `(source,
 * field)` pair is NOT in `derived`; then append every `derived` entry.
 * The result is a new array — neither input is mutated.
 *
 * Rationale: the editor may have manually curated an entry (e.g. a
 * Tavily seed or a press citation). On re-run we MUST NOT erase it.
 * But we DO want to refresh wikidata/wikipedia entries because the
 * underlying scalar may have been re-resolved by `enrich-wikidata-ids`.
 */
function mergeEntries(
  existing: ReadonlyArray<ExternalSourceEntry>,
  derived: ReadonlyArray<ExternalSourceEntry>,
): ExternalSourceEntry[] {
  const derivedKeys = new Set(derived.map((e) => `${e.source}::${e.field}`));
  const kept = existing.filter((e) => !derivedKeys.has(`${e.source}::${e.field}`));
  return [...kept, ...derived];
}

// ─── CLI ───────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slug?: string;
  readonly slugs: readonly string[];
  readonly limit?: number;
  readonly includeDrafts: boolean;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const slugRaw = map.get('slug');
  const slugsRaw = map.get('slugs');
  const limitRaw = map.get('limit');
  const out: {
    slug?: string;
    slugs: readonly string[];
    limit?: number;
    includeDrafts: boolean;
    dryRun: boolean;
  } = {
    slugs: [],
    includeDrafts: map.has('include-drafts'),
    dryRun: map.has('dry-run'),
  };
  if (typeof slugRaw === 'string') out.slug = slugRaw;
  if (typeof slugsRaw === 'string') {
    out.slugs = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof limitRaw === 'string') {
    const n = Number(limitRaw);
    if (Number.isFinite(n) && n > 0) out.limit = Math.floor(n);
  }
  return out;
}

interface RunStats {
  total: number;
  patched: number;
  noop: number;
  skipped: number;
  errored: number;
  entriesBefore: number;
  entriesAfter: number;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPostgrestEnv();
  const collectedAt = new Date().toISOString();

  const fetchOpts: FetchOptions = {
    includeDrafts: args.includeDrafts,
    onlySlugs: args.slug !== undefined ? [args.slug] : args.slugs,
  };

  console.log(
    `[convert-wikidata] mode dryRun=${args.dryRun} drafts=${args.includeDrafts} slug-filter=${fetchOpts.onlySlugs.length}`,
  );

  const all = await fetchEligibleHotels(env, fetchOpts);
  const rows = args.limit !== undefined ? all.slice(0, args.limit) : all;
  console.log(`[convert-wikidata] ${rows.length} hotel(s) eligible (fetched ${all.length}).`);
  if (rows.length === 0) {
    console.log('[convert-wikidata] nothing to do.');
    return;
  }

  const stats: RunStats = {
    total: rows.length,
    patched: 0,
    noop: 0,
    skipped: 0,
    errored: 0,
    entriesBefore: 0,
    entriesAfter: 0,
  };

  for (const row of rows) {
    const tag = `[${row.slug}]`;
    try {
      const existing = Array.isArray(row.external_sources) ? row.external_sources : [];
      const derived = deriveEntries(row, collectedAt);
      if (derived.length === 0) {
        console.log(`${tag} ✗ no derivable entries (data missing?), skipping`);
        stats.skipped += 1;
        continue;
      }
      const next = mergeEntries(existing, derived);

      // No-op detection: same `(source, field)` set with the same
      // value as last time → don't write back (avoids touching
      // updated_at and burning a Postgres tuple for no signal).
      const existingKey = existing
        .map((e) => `${e.source}::${e.field}::${JSON.stringify(e.value)}`)
        .sort()
        .join('|');
      const nextKey = next
        .map((e) => `${e.source}::${e.field}::${JSON.stringify(e.value)}`)
        .sort()
        .join('|');
      const isNoop = existingKey === nextKey;

      stats.entriesBefore += existing.length;
      stats.entriesAfter += next.length;

      if (isNoop) {
        console.log(`${tag} = noop (${existing.length} entries, all current)`);
        stats.noop += 1;
        continue;
      }

      if (args.dryRun) {
        console.log(
          `${tag} → would PATCH: ${existing.length} → ${next.length} (+${derived.length} derived)`,
        );
      } else {
        await patchExternalSources(env, row.slug, next);
        console.log(`${tag} ✓ PATCH ok (${existing.length} → ${next.length})`);
      }
      stats.patched += 1;
    } catch (err) {
      console.error(`${tag} ✗ ERROR ${(err as Error).message}`);
      stats.errored += 1;
    }
  }

  console.log('---');
  console.log(
    `[convert-wikidata] DONE: patched=${stats.patched} noop=${stats.noop} skipped=${stats.skipped} errored=${stats.errored} (${stats.total} total)`,
  );
  console.log(
    `[convert-wikidata] entries: ${stats.entriesBefore} → ${stats.entriesAfter} across the eligible set`,
  );
  if (stats.errored > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[convert-wikidata] FATAL', err);
  process.exit(1);
});
