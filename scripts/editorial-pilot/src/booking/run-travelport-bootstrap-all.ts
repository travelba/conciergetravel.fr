/**
 * run-travelport-bootstrap-all.ts — catalogue-wide, FULLY AUTOMATED Travelport
 * mapping bootstrap (scales the per-hotel cascade to the ~2200-hotel catalogue).
 *
 * For every eligible hotel (published, geocoded, with ≥ 1 editorial room) it runs
 * the deterministic→LLM cascade from bootstrap-travelport-mappings.ts:
 *   - authenticates to Travelport ONCE (shared memory-redis token cache) ;
 *   - continue-on-failure (skill llm-output-robustness Rule 6) — one hotel that
 *     has no Travelport property or errors never aborts the batch ;
 *   - bounded concurrency (Rule 7) — default 3 to respect Travelport rate limits ;
 *   - NO human step anywhere: ambiguous rooms simply stay on graceful fallback.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot travelport:bootstrap:all -- [--dry-run]
 *     [--city=Paris] [--slugs=a,b,c] [--limit=50] [--offset=0]
 *     [--concurrency=3] [--min-overlap=2] [--no-llm] [--radius=1] [--adults=1]
 *
 * Pilot → validate → scale (Rule 11): start with --city=Paris --limit=10 --dry-run.
 *
 * Skills : llm-output-robustness, api-integration, redis-caching,
 *          windows-dev-environment.
 */
import {
  bootstrapTravelportHotel,
  buildTravelportCreds,
  createMemoryRedis,
  parseBootEnv,
  type BootEnv,
  type BootstrapOptions,
  type BootstrapResult,
  type BootstrapStatus,
  type HotelRow,
} from './bootstrap-travelport-mappings.js';

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

async function sbGetPaged(env: BootEnv, basePath: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const sep = basePath.includes('?') ? '&' : '?';
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${basePath}${sep}limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(
        `Supabase GET ${basePath} failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
      );
    }
    const page = (await res.json()) as Record<string, unknown>[];
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      for (;;) {
        const i = idx++;
        if (i >= items.length) break;
        results[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const parsed = parseBootEnv();
  if (!parsed.ok) {
    process.exitCode = 1;
    return;
  }
  const env = parsed.env;

  const llmModel = flag('llm-model');
  const opts: BootstrapOptions = {
    dryRun: flag('dry-run') === 'true',
    adults: Number.parseInt(flag('adults') ?? '1', 10) || 1,
    radius: Number.parseFloat(flag('radius') ?? '1') || 1,
    minOverlap: Math.max(1, Number.parseInt(flag('min-overlap') ?? '2', 10) || 2),
    useLlm: flag('no-llm') !== 'true',
    ...(llmModel !== undefined ? { llmModel } : {}),
    verbose: false,
  };
  const concurrency = Math.max(1, Number.parseInt(flag('concurrency') ?? '3', 10) || 3);
  const limit = flag('limit') !== undefined ? Number.parseInt(flag('limit')!, 10) : undefined;
  const offset = Number.parseInt(flag('offset') ?? '0', 10) || 0;
  const city = flag('city');
  const slugsArg = flag('slugs');
  const slugFilter =
    slugsArg !== undefined
      ? new Set(
          slugsArg
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : undefined;

  if (opts.useLlm && env.OPENAI_API_KEY === undefined) {
    console.warn('[tp:all] OPENAI_API_KEY absent — TIER 2 LLM désactivé (déterministe seul).');
  }

  // Eligible hotels: published, geocoded. Then keep only those with ≥1 room.
  let hotelsPath =
    'hotels?select=id,name,slug,latitude,longitude' +
    '&is_published=eq.true&latitude=not.is.null&longitude=not.is.null&order=name.asc';
  if (city !== undefined) hotelsPath += `&city=eq.${encodeURIComponent(city)}`;

  console.log('[tp:all] chargement des hôtels éligibles…');
  const [hotelRows, roomRows] = await Promise.all([
    sbGetPaged(env, hotelsPath),
    sbGetPaged(env, 'hotel_rooms?select=hotel_id'),
  ]);
  const hotelsWithRooms = new Set(roomRows.map((r) => String(r['hotel_id'])));

  let candidates: HotelRow[] = hotelRows
    .filter((h) => hotelsWithRooms.has(String(h['id'])))
    .filter((h) => slugFilter === undefined || slugFilter.has(String(h['slug'])))
    .map((h) => ({
      id: String(h['id']),
      name: String(h['name']),
      latitude: Number(h['latitude']),
      longitude: Number(h['longitude']),
    }));

  if (offset > 0) candidates = candidates.slice(offset);
  if (limit !== undefined && Number.isFinite(limit)) candidates = candidates.slice(0, limit);

  console.log(
    `[tp:all] ${candidates.length} hôtel(s) à traiter ` +
      `(concurrency=${concurrency}, llm=${opts.useLlm}, dry-run=${opts.dryRun}).`,
  );
  if (candidates.length === 0) {
    console.log('[tp:all] rien à faire.');
    return;
  }

  const creds = buildTravelportCreds(env, createMemoryRedis());

  const tally: Record<BootstrapStatus, number> = {
    ok: 0,
    search_failed: 0,
    no_property: 0,
    no_rooms: 0,
  };
  let totalMapped = 0;
  let totalTier1 = 0;
  let totalLlm = 0;
  let processed = 0;

  const results = await runWithConcurrency<HotelRow, BootstrapResult>(
    candidates,
    concurrency,
    async (hotel) => {
      try {
        const r = await bootstrapTravelportHotel(env, creds, hotel, opts);
        processed += 1;
        if (r.status === 'ok') {
          totalMapped += r.mappedRoomCount;
          totalTier1 += r.tier1Mappings;
          totalLlm += r.llmMappings;
          console.log(
            `  [${processed}/${candidates.length}] ✓ ${hotel.name} — ${r.mappedRoomCount} mapping(s) ` +
              `(t1=${r.tier1Mappings}, llm=${r.llmMappings})`,
          );
        } else {
          console.log(`  [${processed}/${candidates.length}] · ${hotel.name} — ${r.status}`);
        }
        return r;
      } catch (err) {
        processed += 1;
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`  [${processed}/${candidates.length}] ✗ ${hotel.name} — ${detail}`);
        return {
          status: 'search_failed' as const,
          hotelName: hotel.name,
          editorialRoomCount: 0,
          tier1Mappings: 0,
          llmMappings: 0,
          mappedRoomCount: 0,
          detail,
        };
      }
    },
  );

  for (const r of results) tally[r.status] += 1;

  console.log('\n[tp:all] ───────── résumé ─────────');
  console.log(`  hôtels traités     : ${candidates.length}`);
  console.log(`  connectés (ok)     : ${tally.ok}`);
  console.log(`  sans propriété TP  : ${tally.no_property}`);
  console.log(`  sans chambre édito : ${tally.no_rooms}`);
  console.log(`  recherche KO       : ${tally.search_failed}`);
  console.log(`  mappings écrits    : ${totalMapped} (tier1=${totalTier1}, llm=${totalLlm})`);
  if (opts.dryRun) console.log('  (dry-run — aucune écriture en base)');
}

main().catch((e: unknown) => {
  console.error('[tp:all] fatal', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
