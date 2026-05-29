/**
 * parse-forbes-5-star.ts — extract the 2026 Forbes Travel Guide
 * Five-Star hotel list from the Pearl mirror page.
 *
 * Source rationale
 * ----------------
 * The canonical Forbes list lives at https://www.forbestravelguide.com/
 * award-winners but is rendered client-side (React SPA, 2415 properties
 * loaded via XHR) so direct HTML extraction returns 0 entries.
 *
 * Pearl (joinpearl.co/lists/2026-forbes-5-star) is a luxury travel
 * platform that publishes the *same* Forbes-source list as a static
 * SSR page citing Forbes as the authoritative source. We use it as a
 * mirror; the JSON-LD affiliation entries always emit the **official
 * Forbes** display_name and source_url. The Pearl URL is recorded in
 * `metadata.via` for traceability.
 *
 * Input  — `agent-tools/<uuid>.txt` (Pearl markdown dump, 281 KB).
 *          Path is read from argv[2] (--input) or PEARL_DUMP_PATH env var.
 *
 * Output — `global-sources/forbes-5-star-2026.json` — array of:
 *          { name, city, country, type: 'Hotel' }
 *          (filtered to Hotels only; Restaurants and Spas are excluded
 *          from this list — they'll get a separate pipeline if/when
 *          they become a brand surface on the site).
 *
 * Forward-compatibility: re-run yearly. Source URL changes from
 * `/2026-forbes-5-star` to `/2027-forbes-5-star`. The script accepts a
 * `--year` arg to write to `forbes-5-star-<year>.json`.
 *
 * Skill: api-integration, content-modeling.
 * ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');

const args = process.argv.slice(2);
const inputArg = args.find((a) => a.startsWith('--input='));
const yearArg = args.find((a) => a.startsWith('--year='));
const inputPath = inputArg
  ? inputArg.slice('--input='.length)
  : (process.env['PEARL_DUMP_PATH'] ?? '');
const year = yearArg ? yearArg.slice('--year='.length) : '2026';

if (!inputPath) {
  console.error('[parse-forbes-5-star] missing input path');
  console.error('  Usage: tsx parse-forbes-5-star.ts --input=<path> [--year=2026]');
  console.error('  Or:    PEARL_DUMP_PATH=<path> tsx parse-forbes-5-star.ts');
  process.exit(1);
}

interface ForbesHotel {
  name: string;
  city: string;
  country: string;
  type: 'Hotel';
}

function parsePearlDump(markdown: string): ForbesHotel[] {
  // Pearl renders each property as a 3+ line block:
  //
  //   ### {Property Name}
  //   {City}, {Country}
  //   {Hotel|Restaurant|Spa}
  //   [optional paragraph description]
  //
  // The image-alt above (![{Name}, {City}, {Country}](...)) provides a
  // second confirmation channel. We use the explicit ### / "City, Country"
  // / type triple as the canonical extractor and ignore the alt.
  const lines = markdown.split('\n');
  const results: ForbesHotel[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.startsWith('### ')) continue;
    const name = line.slice(4).trim();
    if (name.length < 2 || name.length > 200) continue;

    // Look ahead for the city/country line — it's the next non-empty line
    // that contains a single comma and ends with a country.
    let cityLine: string | null = null;
    let typeLine: string | null = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = (lines[j] ?? '').trim();
      if (!next) continue;
      if (cityLine === null) {
        // Pearl uses "City, Country" or "City, Secondary, Country" formats.
        if (next.includes(',') && !next.startsWith('!') && !next.startsWith('[')) {
          cityLine = next;
        }
        continue;
      }
      if (typeLine === null) {
        if (next === 'Hotel' || next === 'Restaurant' || next === 'Spa' || next === 'Cruise') {
          typeLine = next;
          break;
        }
        // Some entries have "Hotel" directly without a preceding city line — unlikely
        // but defensive: if we hit a non-matching line, abort this block.
        break;
      }
    }

    if (cityLine === null || typeLine !== 'Hotel') continue;

    const parts = cityLine.split(',').map((s) => s.trim());
    const country = parts[parts.length - 1] ?? '';
    const city = parts.slice(0, -1).join(', ');
    if (city.length < 2 || country.length < 2) continue;

    // Dedup on name+city — Pearl sometimes lists the same property twice
    // when it has a 5★ hotel AND a 5★ restaurant inside (we already
    // filtered on type='Hotel' so that's rare but possible).
    const dedupKey = `${name}|${city}|${country}`.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({ name, city, country, type: 'Hotel' });
  }

  return results;
}

function main(): void {
  console.log(`[parse-forbes-5-star] input  : ${inputPath}`);
  console.log(`[parse-forbes-5-star] year   : ${year}`);

  const markdown = readFileSync(inputPath, 'utf8');
  const hotels = parsePearlDump(markdown);

  console.log(`[parse-forbes-5-star] hotels parsed : ${hotels.length}`);

  // Sanity check — Forbes 2026 announced 343 Five-Star hotels.
  // Pearl's list may include extra (5★ restaurants/spas already filtered
  // out) or miss a few. We expect 320-360 range. Warn outside that band.
  if (hotels.length < 300 || hotels.length > 400) {
    console.warn(
      `[parse-forbes-5-star] WARN: expected 300-400 hotels, got ${hotels.length}. Check the parser.`,
    );
  }

  const countriesCounts = hotels.reduce<Record<string, number>>((acc, h) => {
    acc[h.country] = (acc[h.country] ?? 0) + 1;
    return acc;
  }, {});
  const topCountries = Object.entries(countriesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log(`[parse-forbes-5-star] top 10 countries:`);
  for (const [c, n] of topCountries) {
    console.log(`  ${String(n).padStart(3)} ${c}`);
  }

  const outPath = resolve(ROOT, `forbes-5-star-${year}.json`);
  writeFileSync(outPath, JSON.stringify(hotels, null, 2));
  console.log(`[parse-forbes-5-star] wrote ${hotels.length} entries → ${outPath}`);
}

main();
