/**
 * Backfill `hotels.official_url` catalogue-wide.
 *
 * Why
 * ---
 * The 2026-05-31 Phase B-pilot revealed two failure modes for the
 * press-kit pipeline:
 *   1. `official_url IS NULL` (~1500 rows) → Tavily falls back to the
 *      parent-group consortium domain, which yields 1-5 photos for
 *      most properties (median ~5 vs ~14 when the hotel URL is set).
 *   2. `official_url = corporate root` (~64 rows, e.g.
 *      `https://www.mandarinoriental.com/`) → Tavily mixes photos
 *      from every property in the chain. The Mandarin Oriental
 *      Cristallo Cortina fiche ended up showing a London building.
 *
 * This script fills both gaps in one pass: for every published hotel
 * that fails `isCorporateRootUrl()` OR has a NULL URL, it runs ONE
 * Tavily search (`"<name> <city> official site"`, OTAs excluded),
 * validates the top result against a confidence ruleset, and
 * UPDATEs `hotels.official_url` when the match is solid.
 *
 * Confidence rules (top result must satisfy ALL):
 *   - hostname is NOT in `HOSTNAME_BLOCKLIST_GLOBAL` (no OTAs)
 *   - hostname is NOT a corporate root (per `isCorporateRootUrl`)
 *   - URL path is non-trivial (more than `/`, `/en`, `/fr`)
 *   - EITHER:
 *       (a) hostname contains a normalized fragment of the hotel name
 *           (3+ chars from each significant word), OR
 *       (b) hostname matches the inferred parent-group domain AND the
 *           path contains a hotel-name fragment, OR
 *       (c) Tavily score >= 0.8 AND the hostname looks like a dedicated
 *           hotel site (`.com`, `.fr`, `.es`, etc., no `/wp-content/`
 *           magazine path).
 *
 * Side effects
 * ------------
 * Writes `runs/backfill-official-url-<ts>.jsonl` (one line per hotel
 * with status `updated|skipped|failed` + the proposed URL + the reason).
 *
 * CLI
 * ---
 *   # Cap to 5 hotels, dry-run (no DB write):
 *   pnpm photos:backfill-url --limit=5 --dry-run
 *
 *   # Specific hotels:
 *   pnpm photos:backfill-url --slugs=akelarre,le-bristol-paris
 *
 *   # Full catalogue (live):
 *   pnpm photos:backfill-url --concurrency=4
 *
 * Skill: photo-pipeline §Audit-driven rollout + Critical Learning #6
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tavilySearch } from '../enrichment/tavily-client.js';
import { loadPhotoEnv } from './env-photos.js';
import {
  HOSTNAME_BLOCKLIST_GLOBAL,
  inferParentGroup,
  isBlocklistedHostname,
  isCorporateRootUrl,
  PARENT_DOMAINS_BY_GROUP,
  SLUG_PARENT_GROUP_OVERRIDES,
} from './parent-group-mapping.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI ───────────────────────────────────────────────────────────────────

interface Args {
  readonly limit?: number;
  readonly concurrency: number;
  readonly slugs?: readonly string[];
  readonly dryRun: boolean;
  readonly includeNull: boolean;
  readonly includeCorporateRoot: boolean;
  /** Override Tavily score floor for the "low-signal" path. */
  readonly minScore: number;
  /** Sleep between two successive `processHotel()` STARTS in a worker
   *  (per worker, not global) to respect Tavily's 100 req/min free tier. */
  readonly throttleMs: number;
  /** Path to a previous runlog JSONL. Slugs found in it with status
   *  !== 'failed' are excluded from the eligible set. */
  readonly resumeFrom?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) map.set(a.slice(2), true);
      else map.set(a.slice(2, eq), a.slice(eq + 1));
    }
  }
  const toInt = (v: unknown): number | undefined => {
    if (typeof v !== 'string') return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const toFloat = (v: unknown, dflt: number): number => {
    if (typeof v !== 'string') return dflt;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : dflt;
  };
  const slugsRaw = map.get('slugs');
  const slugs =
    typeof slugsRaw === 'string'
      ? slugsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  const limit = toInt(map.get('limit'));
  // Default behaviour: process both NULL and corporate-root rows. Flags
  // let the operator narrow down (e.g. only fix the 64 landmines first).
  const onlyNull = map.has('only-null');
  const onlyCorp = map.has('only-corporate-root');
  const resumeFromRaw = map.get('resume-from');
  return {
    ...(limit !== undefined ? { limit } : {}),
    concurrency: Math.min(8, Math.max(1, toInt(map.get('concurrency')) ?? 4)),
    ...(slugs !== undefined ? { slugs } : {}),
    dryRun: map.has('dry-run'),
    includeNull: !onlyCorp,
    includeCorporateRoot: !onlyNull,
    minScore: toFloat(map.get('min-score'), 0.6),
    throttleMs: Math.max(0, toInt(map.get('throttle-ms')) ?? 0),
    ...(typeof resumeFromRaw === 'string' ? { resumeFrom: resumeFromRaw } : {}),
  };
}

/**
 * Read a previous runlog JSONL and return the set of slugs that were
 * NOT 'failed'. Used by --resume-from to skip the work already done.
 */
function readResumeSlugs(path: string): Set<string> {
  const completed = new Set<string>();
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/u)) {
    if (line.trim().length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as { slug?: unknown; status?: unknown };
        if (typeof obj.slug === 'string' && typeof obj.status === 'string') {
          if (obj.status === 'updated' || obj.status === 'skipped') {
            completed.add(obj.slug);
          }
        }
      }
    } catch {
      // ignore unparseable lines
    }
  }
  return completed;
}

// ─── Supabase fetch ────────────────────────────────────────────────────────

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly official_url: string | null;
}

interface RawRow {
  readonly id: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly city: unknown;
  readonly country_code: unknown;
  readonly luxury_tier: unknown;
  readonly official_url: unknown;
}

function buildSupabaseCfg(): SupabaseRestConfig {
  const env = loadPhotoEnv();
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

async function fetchTargets(
  cfg: SupabaseRestConfig,
  args: Args,
): Promise<{ readonly rows: readonly HotelRow[]; readonly totalEligible: number }> {
  const filters: string[] = ['is_published=eq.true'];
  if (args.slugs && args.slugs.length > 0) {
    filters.push(`slug=in.(${args.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  }
  const raws = await selectHotels<RawRow>(cfg, {
    columns: 'id,slug,name,city,country_code,luxury_tier,official_url',
    filters,
  });
  const mapped = raws
    .map((r): HotelRow | null => {
      if (typeof r.id !== 'string' || typeof r.slug !== 'string' || typeof r.name !== 'string') {
        return null;
      }
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        city: typeof r.city === 'string' ? r.city : null,
        country_code: typeof r.country_code === 'string' ? r.country_code : null,
        luxury_tier: typeof r.luxury_tier === 'string' ? r.luxury_tier : null,
        official_url: typeof r.official_url === 'string' ? r.official_url : null,
      };
    })
    .filter((r): r is HotelRow => r !== null);

  // Filter to rows that actually need backfill.
  const needsBackfill = mapped.filter((r) => {
    const isNull = r.official_url === null;
    const isCorp = r.official_url !== null && isCorporateRootUrl(r.official_url);
    if (args.includeNull && isNull) return true;
    if (args.includeCorporateRoot && isCorp) return true;
    return false;
  });

  let filtered = needsBackfill;
  if (typeof args.resumeFrom === 'string' && args.resumeFrom.length > 0) {
    const done = readResumeSlugs(args.resumeFrom);
    const before = filtered.length;
    filtered = filtered.filter((r) => !done.has(r.slug));
    console.log(
      `[backfill-official-url] --resume-from skipped ${before - filtered.length} already-processed slugs`,
    );
  }
  const totalEligible = filtered.length;
  const limited = args.limit !== undefined ? filtered.slice(0, args.limit) : filtered;
  return { rows: limited, totalEligible };
}

// ─── Hotel-name fragment helpers ───────────────────────────────────────────

/**
 * Tokens we ignore when computing "the hotel name appears in this URL".
 * Mostly category words like "hotel", "resort", articles, and a few
 * geographies that match too broadly (`paris` shouldn't promote a
 * random Parisian site to "official" for Le Bristol).
 */
const NAME_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'au',
  'aux',
  'casa',
  'chateau',
  'château',
  'de',
  'del',
  'des',
  'di',
  'du',
  'el',
  'gardens',
  'grand',
  'hostel',
  'hotel',
  'hôtel',
  'house',
  'inn',
  'la',
  'le',
  'les',
  'lodge',
  'mansion',
  'mansions',
  'maison',
  'palace',
  'palacio',
  'palazzo',
  'park',
  'place',
  'plaza',
  'resort',
  'resorts',
  'royal',
  'spa',
  'suites',
  'the',
  'villa',
  'villas',
  'y',
]);

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, '');
}

function nameSignificantTokens(name: string): readonly string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((tok) => tok.length >= 3 && !NAME_STOPWORDS.has(tok));
}

function tokenAppearsInUrl(token: string, url: string): boolean {
  return normalizeForMatch(url).includes(token);
}

// ─── Confidence scoring ────────────────────────────────────────────────────

type Verdict =
  | { readonly status: 'ok'; readonly confidence: 'high' | 'medium'; readonly reason: string }
  | { readonly status: 'skip'; readonly reason: string };

function urlPathIsTrivial(url: string): boolean {
  try {
    const u = new URL(url);
    const clean = u.pathname.replace(/\/$/u, '');
    return clean === '' || /^\/[a-z]{2}(?:[-_][a-z]{2})?$/iu.test(clean);
  } catch {
    return true;
  }
}

function isParentGroupDomain(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./u, '');
  for (const domains of Object.values(PARENT_DOMAINS_BY_GROUP)) {
    for (const d of domains) {
      if (h === d || h.endsWith(`.${d}`)) return true;
    }
  }
  return false;
}

function hostnameLooksLikeDedicatedSite(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./u, '');
  // Reject magazines/blogs/CMS hostings that often top Tavily for hotel queries.
  const reject = [
    'medium.com',
    'wordpress.com',
    'blogspot.',
    'wixsite.com',
    'forbes.com',
    'condenast',
    'cntraveler.com',
    'cntraveller.com',
    'travelandleisure.com',
    'theculturetrip.com',
    'tablethotels.com',
    'oyster.com',
    'fivestaralliance.com',
    'kiwicollection.com',
    'jacadatravel.com',
    'wikipedia.org',
    'wikimedia.org',
    'youtube.com',
    'vimeo.com',
    'linkedin.com',
    'instagram.com',
    'facebook.com',
    'twitter.com',
    'x.com',
  ];
  if (reject.some((r) => h.includes(r))) return false;
  // Reject IP-like, sub-3-char TLDs (.io, .co count as OK).
  return /\.[a-z]{2,}$/iu.test(h);
}

function judgeCandidate(
  hotel: HotelRow,
  candidate: { readonly url: string; readonly score: number },
  parentDomains: readonly string[],
): Verdict {
  const url = candidate.url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: 'skip', reason: 'invalid-url' };
  }
  const host = parsed.hostname.toLowerCase();
  const hostNoWww = host.replace(/^www\./u, '');

  if (isBlocklistedHostname(host)) {
    return { status: 'skip', reason: `blocklisted-host(${hostNoWww})` };
  }
  if (isCorporateRootUrl(url)) {
    return { status: 'skip', reason: `corporate-root(${hostNoWww})` };
  }

  const tokens = nameSignificantTokens(hotel.name);
  const tokenHits = tokens.filter((t) => tokenAppearsInUrl(t, url)).length;

  const hostIsParent = isParentGroupDomain(hostNoWww);
  const looksDedicated = hostnameLooksLikeDedicatedSite(hostNoWww);
  const trivial = urlPathIsTrivial(url);

  // HIGH-CONFIDENCE FIRST (order matters): hostname embeds the hotel
  // name on a dedicated single-property site like `chewtonglen.com`,
  // `fourseasonstianjin.com/en` — trivial path is OK here because the
  // hostname alone identifies the hotel unambiguously.
  if (tokenHits >= 1 && looksDedicated && !hostIsParent) {
    return {
      status: 'ok',
      confidence: 'high',
      reason: `hotel-name-in-host(tokens=${tokenHits}/${tokens.length}${trivial ? ',trivial-path-ok' : ''})`,
    };
  }

  // Trivial path on anything else = noise (no way to disambiguate).
  if (trivial) {
    return { status: 'skip', reason: `trivial-path(host=${hostNoWww})` };
  }

  // Medium-confidence: parent-group domain with a hotel-name path
  // (e.g. `mandarinoriental.com/en/muscat/shatti-al-qurum`).
  if (hostIsParent && tokenHits >= 1) {
    return {
      status: 'ok',
      confidence: 'medium',
      reason: `parent-domain-with-hotel-path(tokens=${tokenHits}/${tokens.length})`,
    };
  }

  // Medium-confidence: high Tavily score + dedicated-looking domain
  // + name token in path.
  if (looksDedicated && candidate.score >= 0.8 && tokenHits >= 1) {
    return {
      status: 'ok',
      confidence: 'medium',
      reason: `high-score-dedicated(score=${candidate.score.toFixed(2)},tokens=${tokenHits})`,
    };
  }

  return {
    status: 'skip',
    reason: `low-confidence(tokens=${tokenHits}/${tokens.length},score=${candidate.score.toFixed(2)},host=${hostNoWww})`,
  };
}

// ─── Tavily query ──────────────────────────────────────────────────────────

function buildQuery(hotel: HotelRow): string {
  const city = hotel.city ?? '';
  return `${hotel.name}${city.length > 0 ? ` ${city}` : ''} official site`.slice(0, 380);
}

interface Candidate {
  readonly url: string;
  readonly score: number;
}

async function findCandidates(hotel: HotelRow): Promise<readonly Candidate[]> {
  const response = await tavilySearch({
    query: buildQuery(hotel),
    searchDepth: 'basic',
    maxResults: 6,
    excludeDomains: [...HOSTNAME_BLOCKLIST_GLOBAL],
  });
  return response.results
    .map((r) => ({ url: r.url, score: r.score }))
    .filter((c) => c.url.startsWith('http'));
}

// ─── Pipeline per hotel ────────────────────────────────────────────────────

type Outcome =
  | {
      readonly status: 'updated';
      readonly url: string;
      readonly reason: string;
      readonly triedAt: number;
    }
  | {
      readonly status: 'skipped';
      readonly reason: string;
      readonly candidate: string | null;
      readonly triedCount: number;
    }
  | { readonly status: 'failed'; readonly error: string };

async function processHotel(
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  args: Args,
): Promise<Outcome> {
  try {
    const candidates = await findCandidates(hotel);
    if (candidates.length === 0) {
      return { status: 'skipped', reason: 'no-tavily-result', candidate: null, triedCount: 0 };
    }
    const parentGroup = inferParentGroup({
      slug: hotel.slug,
      officialUrl: hotel.official_url,
      luxuryTier: hotel.luxury_tier,
      slugOverrides: SLUG_PARENT_GROUP_OVERRIDES,
    });
    const parentDomains = parentGroup ? PARENT_DOMAINS_BY_GROUP[parentGroup] : [];

    // Iterate the top N candidates; accept the first one that passes
    // the confidence rules. This recovers cases where the #1 result is
    // a Facebook page (or Pinterest, Instagram, blocklisted CDN) and
    // the #2 is the real official site.
    let lastVerdictReason = '';
    let lastCandidate: Candidate | null = null;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      if (!candidate) continue;
      lastCandidate = candidate;
      const verdict = judgeCandidate(hotel, candidate, parentDomains);
      if (verdict.status === 'ok') {
        if (!args.dryRun) {
          await patchHotelById(cfg, hotel.id, { official_url: candidate.url });
        }
        return {
          status: 'updated',
          url: candidate.url,
          reason: `${verdict.reason}[rank=${i + 1}]`,
          triedAt: i + 1,
        };
      }
      lastVerdictReason = verdict.reason;
    }

    return {
      status: 'skipped',
      reason: lastVerdictReason || 'all-candidates-rejected',
      candidate: lastCandidate?.url ?? null,
      triedCount: candidates.length,
    };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Concurrency runner ────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  throttleMs: number,
  fn: (item: T, index: number) => Promise<R>,
  onResult?: (item: T, result: R, index: number) => void,
): Promise<readonly R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) continue;
      const r = await fn(item, i);
      results[i] = r;
      if (onResult) onResult(item, r, i);
      if (throttleMs > 0 && nextIndex < items.length) {
        await sleep(throttleMs);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = buildSupabaseCfg();

  console.log(
    `[backfill-official-url] dryRun=${args.dryRun} concurrency=${args.concurrency} throttleMs=${args.throttleMs} limit=${args.limit ?? '∞'} includeNull=${args.includeNull} includeCorpRoot=${args.includeCorporateRoot}`,
  );
  if (typeof args.resumeFrom === 'string') {
    console.log(`  resume-from: ${args.resumeFrom}`);
  }
  if (args.slugs && args.slugs.length > 0) {
    console.log(`  scoped to slugs=${args.slugs.join(',')}`);
  }

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');
  const logPath = resolve(runsDir, `backfill-official-url-${ts}.jsonl`);
  console.log(`  runlog: ${logPath}`);

  const { rows, totalEligible } = await fetchTargets(cfg, args);
  console.log(
    `[backfill-official-url] eligible=${totalEligible}, processing=${rows.length} (${rows.length < totalEligible ? `--limit=${args.limit}` : 'no limit'})`,
  );

  const counters = { updated: 0, skipped: 0, failed: 0 };
  const skipReasons = new Map<string, number>();

  await runWithConcurrency(
    rows,
    args.concurrency,
    args.throttleMs,
    async (hotel) => processHotel(cfg, hotel, args),
    (hotel, outcome, i) => {
      const tag = `[${(i + 1).toString().padStart(4, ' ')}/${rows.length}]`;
      if (outcome.status === 'updated') {
        counters.updated += 1;
        const rankSuffix = outcome.triedAt > 1 ? ` (#${outcome.triedAt})` : '';
        console.log(
          `${tag} [UPDATED] ${hotel.slug.padEnd(40, ' ')} → ${outcome.url}${rankSuffix}`,
        );
      } else if (outcome.status === 'skipped') {
        counters.skipped += 1;
        const reasonKey = outcome.reason.replace(/\([^)]*\)/gu, '(*)');
        skipReasons.set(reasonKey, (skipReasons.get(reasonKey) ?? 0) + 1);
        console.log(
          `${tag} [SKIPPED] ${hotel.slug.padEnd(40, ' ')} tried=${outcome.triedCount} reason=${outcome.reason} last=${outcome.candidate ?? 'none'}`,
        );
      } else {
        counters.failed += 1;
        console.log(`${tag} [FAILED ] ${hotel.slug.padEnd(40, ' ')} error=${outcome.error}`);
      }
      appendFileSync(logPath, `${JSON.stringify({ slug: hotel.slug, ...outcome })}\n`);
    },
  );

  console.log('');
  console.log('━━━ Summary ━━━');
  console.log(`  Processed : ${rows.length}`);
  console.log(`  Updated   : ${counters.updated}`);
  console.log(`  Skipped   : ${counters.skipped}`);
  console.log(`  Failed    : ${counters.failed}`);
  if (skipReasons.size > 0) {
    console.log('');
    console.log('  Skip-reason breakdown:');
    const sorted = [...skipReasons.entries()].sort((a, b) => b[1] - a[1]);
    for (const [reason, n] of sorted) {
      console.log(`    ${reason.padEnd(40, ' ')} ${n}`);
    }
  }
  console.log('');
  console.log(`  runlog → ${logPath}`);
}

main().catch((err) => {
  console.error('[backfill-official-url] FATAL', err);
  process.exit(1);
});
