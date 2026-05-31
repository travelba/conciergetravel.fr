/**
 * Photo readiness audit — catalogue-wide.
 *
 * Pilots the Phase B/C/D rollout of the press-kit pipeline by giving
 * us, per hotel:
 *   - photos_count, has_hero, has_pinterest_hotlinks
 *   - inferred parent_group (oetker, hyatt, marriott_lux, …)
 *   - urgency_tier (A/B/C/D/DONE) — see the table below
 *
 * Aggregates by parent_group, country_code, luxury_tier and urgency
 * tier so the PO can pick the right batch (e.g. "all Hyatt published
 * hotels with < 5 photos" → run press-kit pipeline at concurrency=8).
 *
 * URGENCY TIERS
 *   A  = 0-2 photos AND parent_group !== null   — highest ROI: small
 *        gap, known press-kit CDN, predictable Tavily harvest.
 *   B  = 3-9 photos AND parent_group !== null   — backfill to ≥ 10.
 *   C  = ≥ 10 photos but hero_image IS NULL      — just promote one
 *        existing photo via the auto-hero rule in
 *        upload-press-kit-images.ts (no API calls).
 *   D  = 0-9 photos AND parent_group === null    — independents.
 *        Tavily restricted to own official_url; expect ~50 % success.
 *  DONE = ≥ 10 photos AND hero_image NOT NULL    — nothing to do.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/audit-photo-readiness.ts
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/audit-photo-readiness.ts --include-drafts
 *
 * Output
 *   scripts/editorial-pilot/runs/photo-readiness-<ts>.json   (full detail)
 *   scripts/editorial-pilot/runs/photo-readiness-<ts>.md     (PO summary)
 *
 * Skill: photo-pipeline §industrialisation, content-modeling
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPhotoEnv } from './env-photos.js';
import {
  countSuspiciousGalleryRows,
  inferParentGroup,
  SLUG_PARENT_GROUP_OVERRIDES,
  trustedDomainsForHotel,
  type ParentGroup,
} from './parent-group-mapping.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI ───────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly includeDrafts: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  return {
    includeDrafts: argv.includes('--include-drafts'),
  };
}

// ─── DB row ────────────────────────────────────────────────────────────────

interface RawHotelRow {
  readonly slug: unknown;
  readonly name: unknown;
  readonly country_code: unknown;
  readonly luxury_tier: unknown;
  readonly official_url: unknown;
  readonly hero_image: unknown;
  readonly gallery_images: unknown;
  readonly is_published: unknown;
}

interface GalleryRow {
  readonly public_id?: unknown;
  readonly category?: unknown;
}

interface AuditRow {
  readonly slug: string;
  readonly name: string;
  readonly country_code: string | null;
  readonly luxury_tier: string | null;
  readonly official_url: string | null;
  readonly is_published: boolean;
  readonly parent_group: ParentGroup | null;
  readonly trusted_domains: readonly string[];
  readonly photos_count: number;
  readonly categories_covered: readonly string[];
  readonly has_hero: boolean;
  readonly suspicious_hotlinks: number;
  readonly urgency: UrgencyTier;
}

type UrgencyTier = 'A' | 'B' | 'C' | 'D' | 'DONE';

const URGENCY_LABELS: Readonly<Record<UrgencyTier, string>> = {
  A: 'A — 0-2 photos w/ parent group (highest ROI)',
  B: 'B — 3-9 photos w/ parent group (backfill to ≥10)',
  C: 'C — ≥10 photos but missing hero (auto-promote)',
  D: 'D — 0-9 photos, independent (manual / official_url only)',
  DONE: 'DONE — ≥10 photos + hero set',
};

// ─── Supabase helpers ──────────────────────────────────────────────────────

function buildSupabaseRestConfig(): SupabaseRestConfig {
  const env = loadPhotoEnv();
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function fetchHotels(
  cfg: SupabaseRestConfig,
  includeDrafts: boolean,
): Promise<readonly RawHotelRow[]> {
  const filters = includeDrafts ? [] : ['is_published=eq.true'];
  return selectHotels<RawHotelRow>(cfg, {
    columns:
      'slug,name,country_code,luxury_tier,official_url,hero_image,gallery_images,is_published',
    filters,
    order: 'slug.asc',
  });
}

// ─── Audit row builder ─────────────────────────────────────────────────────

function computeUrgency(input: {
  readonly photos_count: number;
  readonly has_hero: boolean;
  readonly parent_group: ParentGroup | null;
}): UrgencyTier {
  if (input.photos_count >= 10 && input.has_hero) return 'DONE';
  if (input.photos_count >= 10 && !input.has_hero) return 'C';
  if (input.photos_count <= 2 && input.parent_group !== null) return 'A';
  if (input.photos_count <= 9 && input.parent_group !== null) return 'B';
  return 'D';
}

function toAuditRow(raw: RawHotelRow): AuditRow {
  const slug = typeof raw.slug === 'string' ? raw.slug : '';
  const name = typeof raw.name === 'string' ? raw.name : '';
  const country_code = typeof raw.country_code === 'string' ? raw.country_code.trim() : null;
  const luxury_tier = typeof raw.luxury_tier === 'string' ? raw.luxury_tier : null;
  const official_url = typeof raw.official_url === 'string' ? raw.official_url : null;
  const hero_image = typeof raw.hero_image === 'string' ? raw.hero_image : null;
  const is_published = raw.is_published === true;
  const gallery: readonly GalleryRow[] = Array.isArray(raw.gallery_images)
    ? (raw.gallery_images as readonly GalleryRow[])
    : [];

  const parent_group = inferParentGroup({
    slug,
    officialUrl: official_url,
    luxuryTier: luxury_tier,
    slugOverrides: SLUG_PARENT_GROUP_OVERRIDES,
  });

  const trusted_domains = trustedDomainsForHotel({
    slug,
    officialUrl: official_url,
    luxuryTier: luxury_tier,
  });

  const photos_count = gallery.length;
  const has_hero = hero_image !== null && hero_image.length > 0;
  const suspicious_hotlinks = countSuspiciousGalleryRows(gallery);
  const categories = new Set<string>();
  for (const row of gallery) {
    if (typeof row.category === 'string' && row.category.length > 0) categories.add(row.category);
  }

  const urgency = computeUrgency({ photos_count, has_hero, parent_group });

  return {
    slug,
    name,
    country_code,
    luxury_tier,
    official_url,
    is_published,
    parent_group,
    trusted_domains,
    photos_count,
    categories_covered: [...categories].sort(),
    has_hero,
    suspicious_hotlinks,
    urgency,
  };
}

// ─── Aggregations ──────────────────────────────────────────────────────────

interface UrgencyBucket {
  readonly tier: UrgencyTier;
  readonly count: number;
  readonly examples: readonly string[];
}

interface ParentGroupBucket {
  readonly group: ParentGroup | 'independent';
  readonly count: number;
  readonly urgency_breakdown: Readonly<Record<UrgencyTier, number>>;
  readonly top_examples: readonly string[];
}

interface CountryBucket {
  readonly country_code: string;
  readonly count: number;
  readonly missing_hero: number;
  readonly under_ten_photos: number;
}

interface AggregateReport {
  readonly totals: {
    readonly hotels_audited: number;
    readonly published: number;
    readonly with_hero: number;
    readonly under_ten_photos: number;
    readonly suspicious_hotlinks_total: number;
    readonly suspicious_hotlinks_hotels: number;
  };
  readonly by_urgency: readonly UrgencyBucket[];
  readonly by_parent_group: readonly ParentGroupBucket[];
  readonly by_country_top20: readonly CountryBucket[];
}

function aggregate(rows: readonly AuditRow[]): AggregateReport {
  const totals = {
    hotels_audited: rows.length,
    published: rows.filter((r) => r.is_published).length,
    with_hero: rows.filter((r) => r.has_hero).length,
    under_ten_photos: rows.filter((r) => r.photos_count < 10).length,
    suspicious_hotlinks_total: rows.reduce((acc, r) => acc + r.suspicious_hotlinks, 0),
    suspicious_hotlinks_hotels: rows.filter((r) => r.suspicious_hotlinks > 0).length,
  };

  // By urgency
  const byUrgency = new Map<UrgencyTier, AuditRow[]>();
  for (const r of rows) {
    const arr = byUrgency.get(r.urgency) ?? [];
    arr.push(r);
    byUrgency.set(r.urgency, arr);
  }
  const by_urgency: UrgencyBucket[] = (['A', 'B', 'C', 'D', 'DONE'] as const).map((tier) => {
    const list = byUrgency.get(tier) ?? [];
    return {
      tier,
      count: list.length,
      examples: list.slice(0, 5).map((r) => `${r.slug} (${r.photos_count} photos)`),
    };
  });

  // By parent group
  const byGroup = new Map<ParentGroup | 'independent', AuditRow[]>();
  for (const r of rows) {
    const key: ParentGroup | 'independent' = r.parent_group ?? 'independent';
    const arr = byGroup.get(key) ?? [];
    arr.push(r);
    byGroup.set(key, arr);
  }
  const by_parent_group: ParentGroupBucket[] = [...byGroup.entries()]
    .map(([group, list]) => {
      const breakdown: Record<UrgencyTier, number> = { A: 0, B: 0, C: 0, D: 0, DONE: 0 };
      for (const r of list) breakdown[r.urgency] += 1;
      const top = list
        .filter((r) => r.urgency === 'A' || r.urgency === 'B')
        .slice(0, 3)
        .map((r) => `${r.slug} (${r.photos_count} photos)`);
      return { group, count: list.length, urgency_breakdown: breakdown, top_examples: top };
    })
    .sort((a, b) => b.count - a.count);

  // By country
  const byCountry = new Map<string, AuditRow[]>();
  for (const r of rows) {
    const cc = r.country_code ?? '??';
    const arr = byCountry.get(cc) ?? [];
    arr.push(r);
    byCountry.set(cc, arr);
  }
  const by_country_top20: CountryBucket[] = [...byCountry.entries()]
    .map(([cc, list]) => ({
      country_code: cc,
      count: list.length,
      missing_hero: list.filter((r) => !r.has_hero).length,
      under_ten_photos: list.filter((r) => r.photos_count < 10).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { totals, by_urgency, by_parent_group, by_country_top20 };
}

// ─── Markdown rendering ────────────────────────────────────────────────────

function renderMarkdown(rows: readonly AuditRow[], agg: AggregateReport): string {
  const lines: string[] = [];
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const pct = (n: number, d: number): string =>
    d === 0 ? '0 %' : `${((n / d) * 100).toFixed(1)} %`;

  lines.push(`# Photo readiness audit — ${ts}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- **Hotels audited**: ${agg.totals.hotels_audited}`);
  lines.push(
    `- **With hero image**: ${agg.totals.with_hero} (${pct(agg.totals.with_hero, agg.totals.hotels_audited)})`,
  );
  lines.push(
    `- **Under 10 photos**: ${agg.totals.under_ten_photos} (${pct(agg.totals.under_ten_photos, agg.totals.hotels_audited)})`,
  );
  lines.push(
    `- **Suspicious hotlinks** (Pinterest/TripAdvisor/Booking in gallery_images): ${agg.totals.suspicious_hotlinks_total} rows across ${agg.totals.suspicious_hotlinks_hotels} hotels`,
  );
  lines.push('');

  lines.push('## Urgency breakdown');
  lines.push('');
  lines.push('| Tier | Description | Count | Examples |');
  lines.push('|---|---|---|---|');
  for (const u of agg.by_urgency) {
    lines.push(
      `| **${u.tier}** | ${URGENCY_LABELS[u.tier]} | ${u.count} | ${u.examples.join(', ') || '—'} |`,
    );
  }
  lines.push('');

  lines.push('## By parent group');
  lines.push('');
  lines.push('| Group | Count | A | B | C | D | DONE | Top A/B examples |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const g of agg.by_parent_group) {
    const b = g.urgency_breakdown;
    lines.push(
      `| ${g.group} | ${g.count} | ${b.A} | ${b.B} | ${b.C} | ${b.D} | ${b.DONE} | ${g.top_examples.join(', ') || '—'} |`,
    );
  }
  lines.push('');

  lines.push('## Top 20 countries (by hotel count)');
  lines.push('');
  lines.push('| Country | Hotels | Missing hero | Under 10 photos |');
  lines.push('|---|---|---|---|');
  for (const c of agg.by_country_top20) {
    lines.push(`| ${c.country_code} | ${c.count} | ${c.missing_hero} | ${c.under_ten_photos} |`);
  }
  lines.push('');

  // Recommended batches
  lines.push('## Recommended rollout sequence');
  lines.push('');
  lines.push(
    [
      '1. **Phase C (auto-hero, no API calls)** — promote a representative photo on every Tier C hotel.',
      '2. **Phase B-pilot** — pick the top 50 Tier A hotels with the largest parent groups, validate Vision quality manually.',
      '3. **Phase B-rollout** — run pipeline on every Tier A row by parent_group, chain by chain (start with the largest count).',
      '4. **Phase B-backfill** — run pipeline on every Tier B row by parent_group.',
      '5. **Phase D (independents)** — Tavily on `official_url` only, expect ~50 % success; fall back to Google Places + Wikimedia.',
      '6. **Hotlink cleanup** — purge suspicious_hotlinks rows once the Cloudinary replacements are in place.',
    ].join('\n'),
  );
  lines.push('');

  // Top-50 actionable list for the Phase B pilot
  const tierA = rows
    .filter((r) => r.urgency === 'A')
    .sort((a, b) => {
      const sizeA = a.parent_group !== null ? 1 : 0;
      const sizeB = b.parent_group !== null ? 1 : 0;
      return sizeB - sizeA || a.photos_count - b.photos_count || a.slug.localeCompare(b.slug);
    })
    .slice(0, 50);
  if (tierA.length > 0) {
    lines.push(`## Phase B pilot — first 50 Tier A candidates`);
    lines.push('');
    lines.push('| Slug | Name | Country | Group | Photos | Hero | Trusted domains |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of tierA) {
      lines.push(
        `| ${r.slug} | ${r.name} | ${r.country_code ?? '—'} | ${r.parent_group ?? 'independent'} | ${r.photos_count} | ${r.has_hero ? '✅' : '❌'} | ${r.trusted_domains.join(', ') || '—'} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const cfg = buildSupabaseRestConfig();

  console.log(
    `[audit-photo-readiness] fetching hotels (${args.includeDrafts ? 'incl. drafts' : 'published only'})…`,
  );
  const raw = await fetchHotels(cfg, args.includeDrafts);
  console.log(`[audit-photo-readiness] fetched ${raw.length} hotels`);

  const rows = raw.map(toAuditRow).filter((r) => r.slug.length > 0);
  const agg = aggregate(rows);

  console.log(`\n[audit-photo-readiness] aggregate:`);
  console.log(`  totals      = ${JSON.stringify(agg.totals)}`);
  console.log(`  by_urgency  = ${agg.by_urgency.map((u) => `${u.tier}=${u.count}`).join(', ')}`);
  console.log(
    `  by_group    = ${agg.by_parent_group
      .slice(0, 8)
      .map((g) => `${g.group}=${g.count}`)
      .join(', ')}, …`,
  );

  const runsDir = resolve(__dirname, '..', '..', 'runs');
  mkdirSync(runsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');

  const jsonPath = resolve(runsDir, `photo-readiness-${ts}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        include_drafts: args.includeDrafts,
        aggregate: agg,
        rows,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`\n[audit-photo-readiness] full report → ${jsonPath}`);

  const mdPath = resolve(runsDir, `photo-readiness-${ts}.md`);
  writeFileSync(mdPath, renderMarkdown(rows, agg), 'utf-8');
  console.log(`[audit-photo-readiness] PO summary  → ${mdPath}`);
}

void main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[audit-photo-readiness] fatal: ${msg}`);
  process.exit(1);
});
