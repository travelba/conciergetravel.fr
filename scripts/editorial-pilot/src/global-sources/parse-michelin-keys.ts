/**
 * parse-michelin-keys.ts — validate the static MICHELIN Keys seed list
 * and emit summary statistics for the operator.
 *
 * Source rationale
 * ----------------
 * The canonical MICHELIN Key list lives at https://guide.michelin.com/
 * but is rendered client-side and gated by Bot Manager. The 2025 global
 * announcement (October 8 2025) was relayed by The MICHELIN Guide's own
 * per-country editorial pages (`/article/travel/all-the-key-hotels-<country>-michelin-guide`)
 * and by third-party reporters (Reporter Gourmet, Italia a Tavola,
 * Boutique Hotelier, Head for Points). We cross-referenced these to build
 * a curated JSON snapshot of every Three-Key hotel known to be reachable
 * from our catalogue's published rows.
 *
 * Coverage in this MVP (2025 selection — 143 Three-Keys announced):
 *   - France (24), UK + Ireland (14), Italy (13), Germany (6),
 *     Spain (5), Switzerland (9), Croatia (1), Netherlands (1), Monaco (1)
 *   - United States (15), Canada (2), Mexico (3), St Barts (1)
 *   - Brazil (2), Chile (2), Costa Rica (1), Peru (1)
 *   - Kenya (1), Morocco (2), Namibia (1), South Africa (2)
 *   - UAE (1)
 *   - Japan (7), Thailand (6), India (1), Indonesia (1), Sri Lanka (1),
 *     Singapore (1)
 *   - French Polynesia (1)
 *
 * Out of scope for this MVP (documented as TODO):
 *   - 1-Key + 2-Key levels (1,742 + 572 hotels). Sourcing requires a
 *     country-by-country crawl of `guide.michelin.com` which is JS-only
 *     and not consistently reachable through Tavily Extract. Defer to a
 *     follow-up sprint with a dedicated Tavily Search → 3rd-party
 *     republisher pipeline (Robb Report, Travel + Leisure, etc).
 *   - Asia + Oceania country gaps: Mainland China (42 Keys), Hong Kong
 *     (9), Maldives (12), Vietnam (13), Cambodia (10), Australia (35),
 *     New Zealand (19). No public English-language list aggregates the
 *     specific Three-Key picks across these markets.
 *
 * Input  — `global-sources/michelin-keys-2025.json` (curated by hand).
 * Output — stdout summary + `global-sources/michelin-keys-2025.normalized.json`
 *          (sorted, trimmed, dedup'd version ready for the fetch step).
 *
 * Forward-compatibility: re-run yearly when MICHELIN releases its next
 * Global Keys ceremony (expected October 2026). The script accepts a
 * `--year` arg to read/write `michelin-keys-<year>.json`.
 *
 * Skill: api-integration, content-modeling, content-enrichment-pipeline.
 * ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

const args = process.argv.slice(2);
const yearArg = args.find((a) => a.startsWith('--year='));
const year = yearArg ? yearArg.slice('--year='.length) : '2025';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const MichelinHotelSchema = z.object({
  name: z.string().min(2).max(200),
  city: z.string().min(1).max(120),
  country: z.string().min(2).max(80),
  /** 1, 2 or 3 — the three MICHELIN Key distinction levels. */
  keys_count: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Direct URL to the hotel's MICHELIN fiche, if known. Optional in MVP. */
  michelin_url: z.string().url().optional(),
});

export type MichelinHotel = z.infer<typeof MichelinHotelSchema>;

const MichelinFileSchema = z.array(MichelinHotelSchema);

function main(): void {
  const inputPath = resolve(ROOT, `michelin-keys-${year}.json`);
  console.log(`[parse-michelin-keys] year   : ${year}`);
  console.log(`[parse-michelin-keys] input  : ${inputPath}`);

  const raw = JSON.parse(readFileSync(inputPath, 'utf8')) as unknown;
  const parsed = MichelinFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[parse-michelin-keys] schema validation failed:');
    console.error(parsed.error.format());
    process.exit(1);
  }
  const hotels = parsed.data;

  // ─── Dedup on (name, city, country) ──────────────────────────────────────
  const seen = new Map<string, MichelinHotel>();
  for (const h of hotels) {
    const key = `${h.name.toLowerCase().trim()}|${h.city.toLowerCase().trim()}|${h.country.toLowerCase().trim()}`;
    if (seen.has(key)) {
      console.warn(`[parse-michelin-keys] WARN dup ignored: ${h.name} (${h.city}, ${h.country})`);
      continue;
    }
    seen.set(key, h);
  }
  const unique = Array.from(seen.values());

  // ─── Stats ───────────────────────────────────────────────────────────────
  const byLevel = unique.reduce<Record<number, number>>((acc, h) => {
    acc[h.keys_count] = (acc[h.keys_count] ?? 0) + 1;
    return acc;
  }, {});

  const byCountry = unique.reduce<Record<string, Record<number, number>>>((acc, h) => {
    const slot = acc[h.country] ?? {};
    slot[h.keys_count] = (slot[h.keys_count] ?? 0) + 1;
    acc[h.country] = slot;
    return acc;
  }, {});

  console.log(`[parse-michelin-keys] total unique hotels : ${unique.length}`);
  console.log(`[parse-michelin-keys] by level :`);
  console.log(`  3 keys: ${byLevel[3] ?? 0}`);
  console.log(`  2 keys: ${byLevel[2] ?? 0}`);
  console.log(`  1 key : ${byLevel[1] ?? 0}`);

  // Sanity check — MVP targets the 143 3-Keys + optional 2/1.
  const three = byLevel[3] ?? 0;
  if (three < 80 || three > 200) {
    console.warn(
      `[parse-michelin-keys] WARN: expected 80-200 Three-Keys, got ${three}. Check input file.`,
    );
  }

  console.log(`[parse-michelin-keys] by country (top 15) :`);
  const top = Object.entries(byCountry)
    .map(([country, levels]) => ({
      country,
      total: (levels[1] ?? 0) + (levels[2] ?? 0) + (levels[3] ?? 0),
      levels,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);
  for (const row of top) {
    console.log(
      `  ${String(row.total).padStart(3)} ${row.country.padEnd(24)} ` +
        `(3k=${row.levels[3] ?? 0}, 2k=${row.levels[2] ?? 0}, 1k=${row.levels[1] ?? 0})`,
    );
  }

  // ─── Sort + write normalised file for the fetch step ─────────────────────
  // Sort: country asc, keys_count desc (3 first), city asc.
  const sorted = unique.slice().sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country, 'en');
    if (a.keys_count !== b.keys_count) return b.keys_count - a.keys_count;
    if (a.city !== b.city) return a.city.localeCompare(b.city, 'en');
    return a.name.localeCompare(b.name, 'en');
  });

  const outPath = resolve(ROOT, `michelin-keys-${year}.normalized.json`);
  writeFileSync(outPath, JSON.stringify(sorted, null, 2));
  console.log(`[parse-michelin-keys] wrote ${sorted.length} entries → ${outPath}`);
}

main();
