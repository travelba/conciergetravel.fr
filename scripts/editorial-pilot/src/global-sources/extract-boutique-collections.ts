/**
 * Extract `boutique_hotels_monde.xlsx` → 3 canonical JSONs.
 *
 *  - `boutique-slh-hotels.json`   (sheet2 = SLH, ~468 properties)
 *  - `boutique-rc-hotels.json`    (sheet3 = Relais & Châteaux, ~580)
 *  - `boutique-chains-hotels.json`(sheet4 = Wave D ultra-luxe, ~66)
 *
 * Country labels in this file ship in French ("Afrique du Sud") and
 * are normalised through the same `country-mapping.ts` module as the
 * luxury-chains extract.
 *
 * Banner rows look like `  Afrique du Sud  (3) ` and only fill the `#`
 * cell — they're skipped by `isBannerRow`.
 *
 * Usage:
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/extract-boutique-collections.ts
 *
 * Skill: editorial-pilot, content-modeling.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readXlsxSheet, type SheetTable } from './xlsx-reader.js';
import { resolveChain, type ChainMeta } from './chain-mapping.js';
import { resolveCountry } from './country-mapping.js';

interface CanonicalEntry {
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly chain_facet_slug: string | null;
  readonly chain_display_name: string | null;
  readonly luxury_tier: string | null;
  readonly wave: string | null;
  readonly priority: string | null;
  readonly source_row: number;
  readonly resolved: boolean;
  readonly notes: readonly string[];
}

interface CollectionReport {
  readonly source_file: string;
  readonly sheet_name: string;
  readonly extracted_at: string;
  readonly total_rows: number;
  readonly resolved_rows: number;
  readonly hotels: readonly CanonicalEntry[];
  readonly countries_unresolved: readonly string[];
}

const SOURCE_XLSX = 'C:\\Users\\benja\\Downloads\\boutique_hotels_monde.xlsx';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, '..', '..', 'global-sources');

/**
 * Look up a row value by header name, ignoring case/accents/extra
 * whitespace. The boutique Excel uses ASCII-only headers in some
 * sheets ("Nom de l'Hotel") and accented headers in others ("Nom de
 * l'Hôtel"), so a strict equality lookup misses one or the other.
 */
function getCell(row: Readonly<Record<string, string>>, ...candidates: readonly string[]): string {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const candidatesNorm = candidates.map(norm);
  for (const [key, val] of Object.entries(row)) {
    if (candidatesNorm.includes(norm(key))) return val ?? '';
  }
  return '';
}

function isBannerRow(row: Readonly<Record<string, string>>): boolean {
  // Header-banner rows fill only one cell with the country name +
  // count, e.g. "  Afrique du Sud  (3)". Real hotel rows always have
  // a `Pays` and a hotel name.
  const name = getCell(
    row,
    "Nom de l'Hotel",
    "Nom de l'Hôtel",
    "Nom de l'Etablissement",
    "Nom de l'Établissement",
  ).trim();
  return name.length === 0;
}

function extractSheet(
  sheet: SheetTable,
  options: {
    readonly sheetName: string;
    /** Default chain name when the sheet doesn't have a `Chaîne` column. */
    readonly defaultChainLabel?: string;
    /** Slug + tier used when the chain isn't resolvable via mapping. */
    readonly fallback?: {
      readonly facetSlug: string;
      readonly displayName: string;
      readonly luxuryTier: string;
      readonly wave: string;
      readonly priority: string;
    };
  },
): CollectionReport {
  const hotels: CanonicalEntry[] = [];
  const countriesUnresolved = new Set<string>();

  for (const row of sheet.data) {
    if (isBannerRow(row)) continue;
    const name = getCell(
      row,
      "Nom de l'Hotel",
      "Nom de l'Hôtel",
      "Nom de l'Etablissement",
      "Nom de l'Établissement",
    ).trim();
    if (!name) continue;
    const cityLabel = getCell(row, 'Ville / Region', 'Ville / Région', 'Ville', 'Région').trim();
    const countryLabel = getCell(row, 'Pays').trim();
    const sourceRowRaw = getCell(row, '#');
    const sourceRow = Number(sourceRowRaw || '0');

    const chainLabel = (getCell(row, 'Chaine', 'Chaîne') || options.defaultChainLabel || '').trim();
    let chain: ChainMeta | null = chainLabel ? resolveChain(chainLabel) : null;
    let chainNotes: string[] = [];
    if (!chain && options.fallback) {
      // Use the fallback (e.g. SLH or Relais & Châteaux — these are
      // collections, not chains in our `LuxuryTier` enum).
      chain = {
        tier: options.fallback.luxuryTier as ChainMeta['tier'],
        wave: options.fallback.wave as ChainMeta['wave'],
        priority: options.fallback.priority as ChainMeta['priority'],
        displayName: options.fallback.displayName,
        facetSlug: options.fallback.facetSlug,
      };
    } else if (!chain && chainLabel) {
      chainNotes.push(`chain_unresolved:${chainLabel}`);
    }

    const country = resolveCountry(countryLabel, cityLabel);
    const notes = [...chainNotes];
    if (!country) {
      countriesUnresolved.add(`${countryLabel} | ${cityLabel}`);
      notes.push(`country_unresolved:${countryLabel}`);
    }

    hotels.push({
      name,
      city: cityLabel,
      country_code: country?.cc ?? null,
      country_label_fr: country?.fr ?? null,
      country_label_en: country?.en ?? null,
      chain_facet_slug: chain?.facetSlug ?? null,
      chain_display_name: chain?.displayName ?? null,
      luxury_tier: chain?.tier ?? null,
      wave: chain?.wave ?? null,
      priority: chain?.priority ?? null,
      source_row: Number.isFinite(sourceRow) ? sourceRow : 0,
      resolved: country !== null && chain !== null,
      notes,
    });
  }

  return {
    source_file: SOURCE_XLSX,
    sheet_name: options.sheetName,
    extracted_at: new Date().toISOString(),
    total_rows: hotels.length,
    resolved_rows: hotels.filter((h) => h.resolved).length,
    hotels,
    countries_unresolved: Array.from(countriesUnresolved).sort(),
  };
}

function writeReport(filename: string, report: CollectionReport): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = resolve(OUTPUT_DIR, filename);
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf-8');
  console.log(
    `→ ${filename}: ${report.total_rows} rows (${report.resolved_rows} resolved)${
      report.countries_unresolved.length > 0
        ? ` — country gaps: ${report.countries_unresolved.length}`
        : ''
    }`,
  );
}

function main(): void {
  // Sheet 2 = SLH, sheet 3 = R&C, sheet 4 = Wave D boutique chains.
  // Header row is row 5 in all three (the file uses a banner row 2 +
  // a stat row 3 above the header). Headers: `# | Nom de l'Hôtel |
  // Ville / Région | Pays` (sheets 2,3) or `# | Chaîne | Nom de
  // l'Hôtel | Ville / Région | Pays` (sheet 4).

  const slh = readXlsxSheet(SOURCE_XLSX, 2, 5);
  writeReport(
    'boutique-slh-hotels.json',
    extractSheet(slh, {
      sheetName: 'SLH',
      defaultChainLabel: 'Small Luxury Hotels of the World',
      fallback: {
        facetSlug: 'small-luxury-hotels',
        displayName: 'Small Luxury Hotels of the World',
        luxuryTier: 'small_luxury_hotels',
        wave: 'C',
        // DB constraint `hotels_priority_ck` only accepts P0/P1/P2.
        // SLH is editorial-only V1 (no booking), so P2 is appropriate.
        priority: 'P2',
      },
    }),
  );

  const rc = readXlsxSheet(SOURCE_XLSX, 3, 5);
  writeReport(
    'boutique-rc-hotels.json',
    extractSheet(rc, {
      sheetName: 'Relais & Châteaux',
      defaultChainLabel: 'Relais & Châteaux',
      fallback: {
        facetSlug: 'relais-chateaux',
        displayName: 'Relais & Châteaux',
        luxuryTier: 'relais_chateaux',
        wave: 'C',
        priority: 'P2',
      },
    }),
  );

  const chains = readXlsxSheet(SOURCE_XLSX, 4, 5);
  writeReport(
    'boutique-chains-hotels.json',
    extractSheet(chains, { sheetName: 'Chaines Boutique' }),
  );
}

main();
