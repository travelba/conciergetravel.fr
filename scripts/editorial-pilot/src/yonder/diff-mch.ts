/**
 * diff-mch.ts — Phase A2 diff of the yonder.fr hotel inventory against the FULL
 * MyConciergeHotel catalogue (published AND draft), with a curation triage.
 *
 * Reads:
 *   - yonder/hotels.json        (unique yonder hotels, output of extract-yonder.ts)
 *   - yonder/rankings-map.json  (ranking → hotels + scope, output of build-rankings-map.ts)
 *   - public.hotels via PostgREST (slug, name, city, country_code, luxury_tier,
 *     is_palace, stars, is_published) — the `pg` direct host fails on this box.
 *
 * Match precedence (mirrors diff-relais-chateaux.ts):
 *   1. slug-key equality (normalised name key)
 *   2. (name, city) tuple
 *   3. name-only (guarded by country when known)
 *
 * Curation triage on the MISSING set (garde-fou: only `qualifie` get onboarded):
 *   `qualifie` when ANY of:
 *     - yonder is_palace hint === true
 *     - yonder hint_stars >= 5
 *     - the hotel appears on >=1 qualifying-scope ranking (palace / 5-etoiles /
 *       relais-chateaux / luxe)
 *     - the name matches a recognised luxury brand
 *   else `hors-cible` (mid-range — never auto-onboarded).
 *
 * Outputs: yonder/diff-missing.json, yonder/diff-already.json.
 *
 * Run (after extract-yonder.ts + build-rankings-map.ts):
 *   pnpm --filter @mch/editorial-pilot exec tsx src/yonder/diff-mch.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PILOT_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(PILOT_ROOT, '../..');
const YONDER_DIR = path.resolve(PILOT_ROOT, 'yonder');

// ─── Env (PostgREST) ───────────────────────────────────────────────────────

const ENV_CACHE: Record<string, string> = {};
async function loadEnvFile(relPath: string): Promise<void> {
  try {
    const txt = await fs.readFile(path.resolve(REPO_ROOT, relPath), 'utf8');
    for (const line of txt.split(/\r?\n/u)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/u);
      const k = m?.[1];
      const v = m?.[2];
      if (k !== undefined && v !== undefined && ENV_CACHE[k] === undefined) {
        ENV_CACHE[k] = v.trim().replace(/^['"]|['"]$/gu, '');
      }
    }
  } catch {
    /* ignore */
  }
}
function readEnv(name: string): string {
  return ENV_CACHE[name] ?? process.env[name] ?? '';
}

// ─── Normalisation (mirrors diff-relais-chateaux.ts) ───────────────────────

function normaliseKey(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, ' ')
    .replace(/\bhotel\b|\bspa\b|\bresort\b|\band\b|\bdu\b|\bde\b|\bla\b|\ble\b|\bles\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
function citySlug(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bsaint\b/g, 'st')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ─── Luxury brand recognition (triage) ─────────────────────────────────────

const LUXURY_BRAND_RE =
  /\b(aman|four seasons|ritz[\s-]?carlton|ritz paris|mandarin oriental|rosewood|bulgari|cheval blanc|belmond|six senses|st\.? ?regis|park hyatt|grand hyatt|waldorf astoria|peninsula|one ?& ?only|oberoi|raffles|soneva|anantara|capella|auberge|shangri[\s-]?la|jumeirah|banyan tree|como\b|bvlgari|dorchester|claridge|savoy|baur au lac|cipriani|danieli|gritti|le bristol|plaza athenee|le meurice|crillon|george v|negresco|byblos|airelles|relais|chateau|palace|conrad|edition|nobu|kempinski|sofitel legend|fairmont|st regis|the langham|montage|rosewood)\b/i;

// ─── Types ─────────────────────────────────────────────────────────────────

const YonderHotelSchema = z.object({
  key: z.string(),
  name: z.string(),
  sources: z.array(z.string()),
  hint_city: z.string().nullable(),
  hint_region: z.string().nullable(),
  hint_country: z.string().nullable(),
  hint_stars: z.number().nullable(),
  is_palace: z.boolean().nullable(),
});
type YonderHotel = z.infer<typeof YonderHotelSchema>;

interface MchHotel {
  id: string;
  slug: string;
  name: string;
  city: string;
  country_code: string | null;
  luxury_tier: string | null;
  is_palace: boolean;
  stars: number;
  is_published: boolean;
}

interface RankingMapEntry {
  yonder_slug: string;
  scope: string;
  qualifying: boolean;
  hotels: { key: string; name: string }[];
}

async function fetchMchHotels(url: string, key: string): Promise<MchHotel[]> {
  const select = 'id,slug,name,city,country_code,luxury_tier,is_palace,stars,is_published';
  const pageSize = 1000;
  const rows: MchHotel[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const q = `${url}/rest/v1/hotels?select=${select}&order=slug.asc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(q, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error('SELECT did not return an array.');
    for (const r of json) {
      const o = r as Record<string, unknown>;
      rows.push({
        id: String(o['id']),
        slug: String(o['slug']),
        name: String(o['name'] ?? ''),
        city: String(o['city'] ?? ''),
        country_code: typeof o['country_code'] === 'string' ? o['country_code'] : null,
        luxury_tier: typeof o['luxury_tier'] === 'string' ? o['luxury_tier'] : null,
        is_palace: Boolean(o['is_palace']),
        stars: typeof o['stars'] === 'number' ? o['stars'] : 0,
        is_published: Boolean(o['is_published']),
      });
    }
    if (json.length < pageSize) break;
  }
  return rows;
}

async function main(): Promise<void> {
  await loadEnvFile('apps/web/.env.local');
  await loadEnvFile('.env.local');
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/u, '');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url.length === 0 || key.length === 0) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  }

  const yonder = z
    .array(YonderHotelSchema)
    .parse(JSON.parse(await fs.readFile(path.join(YONDER_DIR, 'hotels.json'), 'utf8')));
  console.log(`[load] ${yonder.length} yonder hotels`);

  // Ranking-map → qualifying-scope membership per hotel key.
  const rankingMapRaw = JSON.parse(
    await fs.readFile(path.join(YONDER_DIR, 'rankings-map.json'), 'utf8'),
  ) as { rankings: RankingMapEntry[] };
  const qualifyingScopeKeys = new Set<string>();
  const scopesByKey = new Map<string, Set<string>>();
  for (const r of rankingMapRaw.rankings) {
    for (const h of r.hotels) {
      const set = scopesByKey.get(h.key) ?? new Set<string>();
      set.add(r.scope);
      scopesByKey.set(h.key, set);
      if (r.qualifying) qualifyingScopeKeys.add(h.key);
    }
  }

  const mch = await fetchMchHotels(url, key);
  console.log(
    `[load] ${mch.length} MCH hotels (published=${mch.filter((m) => m.is_published).length}, draft=${mch.filter((m) => !m.is_published).length})`,
  );

  // Indices.
  const byNameKey = new Map<string, MchHotel[]>();
  const byNameCityKey = new Map<string, MchHotel[]>();
  const pushTo = (map: Map<string, MchHotel[]>, k: string, v: MchHotel): void => {
    const arr = map.get(k);
    if (arr) arr.push(v);
    else map.set(k, [v]);
  };
  for (const m of mch) {
    const nk = normaliseKey(m.name);
    if (!nk) continue;
    pushTo(byNameKey, nk, m);
    pushTo(byNameCityKey, `${nk}|${citySlug(m.city)}`, m);
  }

  type MatchReason = 'name_city' | 'name_only';
  interface AlreadyRow {
    yonder: YonderHotel;
    mch_slug: string;
    mch_name: string;
    mch_city: string;
    mch_is_published: boolean;
    reason: MatchReason;
  }

  const already: AlreadyRow[] = [];
  const missing: YonderHotel[] = [];

  for (const y of yonder) {
    const nk = normaliseKey(y.name);
    const ck = citySlug(y.hint_city);
    const nc = byNameCityKey.get(`${nk}|${ck}`) ?? [];
    if (nc.length === 1 && nc[0]) {
      const c = nc[0];
      already.push({
        yonder: y,
        mch_slug: c.slug,
        mch_name: c.name,
        mch_city: c.city,
        mch_is_published: c.is_published,
        reason: 'name_city',
      });
      continue;
    }
    // Name-only fallback: yonder's country hint is too noisy to gate on.
    const nOnly = byNameKey.get(nk) ?? [];
    if (nOnly.length >= 1 && nOnly[0]) {
      const c = nOnly[0];
      already.push({
        yonder: y,
        mch_slug: c.slug,
        mch_name: c.name,
        mch_city: c.city,
        mch_is_published: c.is_published,
        reason: 'name_only',
      });
      continue;
    }
    missing.push(y);
  }

  // ─── Triage missing ───────────────────────────────────────────────────────
  interface TriagedMissing {
    key: string;
    name: string;
    hint_city: string | null;
    hint_region: string | null;
    hint_country: string | null;
    hint_stars: number | null;
    is_palace: boolean | null;
    source_count: number;
    sources: string[];
    scopes: string[];
    classification: 'qualifie' | 'hors-cible';
    qualifie_reasons: string[];
  }
  const triaged: TriagedMissing[] = missing.map((y) => {
    const reasons: string[] = [];
    if (y.is_palace === true) reasons.push('palace_hint');
    if ((y.hint_stars ?? 0) >= 5) reasons.push('stars>=5');
    if (qualifyingScopeKeys.has(y.key)) reasons.push('qualifying_scope_ranking');
    if (LUXURY_BRAND_RE.test(y.name)) reasons.push('luxury_brand');
    const scopes = Array.from(scopesByKey.get(y.key) ?? []);
    return {
      key: y.key,
      name: y.name,
      hint_city: y.hint_city,
      hint_region: y.hint_region,
      hint_country: y.hint_country,
      hint_stars: y.hint_stars,
      is_palace: y.is_palace,
      source_count: y.sources.length,
      sources: y.sources,
      scopes,
      classification: reasons.length > 0 ? 'qualifie' : 'hors-cible',
      qualifie_reasons: reasons,
    };
  });

  const qualifie = triaged.filter((t) => t.classification === 'qualifie');
  const horsCible = triaged.filter((t) => t.classification === 'hors-cible');

  // Ventilation by zone (hint_city → fallback hint_region → hint_country) for qualifie.
  const byZone = new Map<string, number>();
  for (const q of qualifie) {
    const zone = q.hint_city ?? q.hint_region ?? q.hint_country ?? '(inconnu)';
    byZone.set(zone, (byZone.get(zone) ?? 0) + 1);
  }
  const topZones = Array.from(byZone.entries()).sort((a, b) => b[1] - a[1]);

  await fs.writeFile(
    path.join(YONDER_DIR, 'diff-missing.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalYonder: yonder.length,
        totalMissing: missing.length,
        qualifieCount: qualifie.length,
        horsCibleCount: horsCible.length,
        topZonesQualifie: topZones.slice(0, 30).map(([zone, n]) => ({ zone, count: n })),
        qualifie: qualifie.sort((a, b) => b.source_count - a.source_count),
        horsCible: horsCible.sort((a, b) => b.source_count - a.source_count),
      },
      null,
      2,
    ),
    'utf8',
  );
  await fs.writeFile(
    path.join(YONDER_DIR, 'diff-already.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalAlready: already.length,
        published: already.filter((a) => a.mch_is_published).length,
        draft: already.filter((a) => !a.mch_is_published).length,
        already,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log('\n━━━ A2 diff vs MCH ━━━');
  console.log(`  Yonder hotels:      ${yonder.length}`);
  console.log(
    `  Already in MCH:     ${already.length} (published=${already.filter((a) => a.mch_is_published).length}, draft=${already.filter((a) => !a.mch_is_published).length})`,
  );
  console.log(`  Missing total:      ${missing.length}`);
  console.log(`  → qualifie:         ${qualifie.length}`);
  console.log(`  → hors-cible:       ${horsCible.length}`);
  console.log('\n  Top 20 zones (qualifie):');
  for (const [zone, n] of topZones.slice(0, 20)) {
    console.log(`    ${String(n).padStart(3)}  ${zone}`);
  }
}

main().catch((err) => {
  console.error('[diff-mch] FAILED:', err);
  process.exit(1);
});
