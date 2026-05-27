/**
 * Extract `chaines_hotelières_luxe_monde.xlsx` → canonical JSON.
 *
 * Reads the Wave A/B/D source Excel, normalises chain + country
 * labels through `country-mapping.ts` + `chain-mapping.ts`, and
 * writes the result to
 * `scripts/editorial-pilot/global-sources/luxury-chains-hotels.json`.
 *
 * The output is the only thing checked into the repo (xlsx stays in
 * Downloads). Re-running this script after the source spreadsheet
 * changes will diff cleanly via git.
 *
 * Usage:
 *   pnpm tsx scripts/editorial-pilot/src/global-sources/extract-luxury-chains.ts
 *
 * Skill: editorial-pilot, content-modeling.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readXlsxSheet } from './xlsx-reader.js';
import { resolveChain, type ChainMeta } from './chain-mapping.js';
import { resolveCountry } from './country-mapping.js';

interface CanonicalHotel {
  readonly name: string;
  readonly city: string;
  readonly country_code: string | null;
  readonly country_label_fr: string | null;
  readonly country_label_en: string | null;
  readonly chain_facet_slug: string;
  readonly chain_display_name: string;
  readonly luxury_tier: string;
  readonly wave: string;
  readonly priority: string;
  readonly source_row: number;
  /** Set when both `country_code` and chain mapping resolved cleanly. */
  readonly resolved: boolean;
  /** Free-form note for QA — accumulated mapping/normalisation issues. */
  readonly notes: readonly string[];
}

interface ExtractReport {
  readonly source_file: string;
  readonly extracted_at: string;
  readonly total_rows: number;
  readonly resolved_rows: number;
  readonly unresolved_rows: number;
  readonly chains_seen: readonly string[];
  readonly chains_by_count: Readonly<Record<string, number>>;
  readonly countries_unresolved: readonly string[];
  readonly chains_unresolved: readonly string[];
  readonly hotels: readonly CanonicalHotel[];
}

const SOURCE_XLSX = 'C:\\Users\\benja\\Downloads\\chaines_hotelières_luxe_monde.xlsx';
// __dirname equivalent in ESM. Output goes to a sibling `global-sources/`
// folder at the editorial-pilot root (same convention as
// `extract-relais-chateaux.ts` → `scripts/editorial-pilot/global-sources/`).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// __dirname = scripts/editorial-pilot/src/global-sources → up two = scripts/editorial-pilot.
const OUTPUT_PATH = resolve(__dirname, '..', '..', 'global-sources', 'luxury-chains-hotels.json');

function isHeaderBanner(row: Readonly<Record<string, string>>): boolean {
  // Banner rows look like "▶ Aman Resorts • Aman Group • … (36 hôtels)"
  // and only the `#` cell is filled. Detect by `Chaîne` being empty.
  const numCell = row['#'] ?? '';
  if (numCell.startsWith('▶') || numCell.includes('•')) return true;
  const chainCell = row['Chaîne'] ?? '';
  return numCell.length > 0 && chainCell.length === 0 && /^[A-Z\u25B6\u2022]/.test(numCell);
}

function main(): void {
  // Sheet 2 = "Base Complète" (full hotel list, 741+ rows).
  // Header at row 4. Sheet 1 is "Vue d'ensemble" (chain summary,
  // irrelevant). Sheets 3+ are per-chain sheets — covered by the
  // base complète so we skip them.
  const sheet = readXlsxSheet(SOURCE_XLSX, 2, 4);

  const hotels: CanonicalHotel[] = [];
  const chainsSeen = new Map<string, number>();
  const countriesUnresolved = new Set<string>();
  const chainsUnresolved = new Set<string>();

  for (const row of sheet.data) {
    if (isHeaderBanner(row)) continue;
    const name = (row["Nom de l'Hôtel"] ?? '').trim();
    if (!name) continue;
    const chainLabel = (row['Chaîne'] ?? '').trim();
    const cityLabel = (row['Ville'] ?? '').trim();
    const countryLabel = (row['Pays'] ?? '').trim();
    const sourceRow = Number(row['#'] ?? '0');

    // Skip the Anantara Vacation Club aggregator row — it's not a
    // real hotel (multi-property timeshare placeholder, no canonical
    // city/country).
    if (cityLabel.toLowerCase() === 'multiple' || /vacation club/i.test(name)) {
      continue;
    }

    const chain: ChainMeta | null = resolveChain(chainLabel);
    if (!chain) {
      chainsUnresolved.add(chainLabel);
      continue; // skip — caller can re-run after extending chain-mapping
    }
    chainsSeen.set(chain.displayName, (chainsSeen.get(chain.displayName) ?? 0) + 1);

    const country = resolveCountry(countryLabel, cityLabel);
    const notes: string[] = [];
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
      chain_facet_slug: chain.facetSlug,
      chain_display_name: chain.displayName,
      luxury_tier: chain.tier,
      wave: chain.wave,
      priority: chain.priority,
      source_row: Number.isFinite(sourceRow) ? sourceRow : 0,
      resolved: country !== null,
      notes,
    });
  }

  const report: ExtractReport = {
    source_file: SOURCE_XLSX,
    extracted_at: new Date().toISOString(),
    total_rows: hotels.length,
    resolved_rows: hotels.filter((h) => h.resolved).length,
    unresolved_rows: hotels.filter((h) => !h.resolved).length,
    chains_seen: Array.from(chainsSeen.keys()).sort(),
    chains_by_count: Object.fromEntries(
      Array.from(chainsSeen.entries()).sort((a, b) => b[1] - a[1]),
    ),
    countries_unresolved: Array.from(countriesUnresolved).sort(),
    chains_unresolved: Array.from(chainsUnresolved).sort(),
    hotels,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8');

  // Concise summary
  console.log(
    `✓ Extracted ${report.total_rows} hotels (${report.resolved_rows} resolved, ${report.unresolved_rows} need country override).`,
  );
  console.log(`  Chains seen: ${report.chains_seen.length}`);
  for (const [name, n] of Object.entries(report.chains_by_count)) {
    console.log(`    - ${name}: ${n}`);
  }
  if (report.chains_unresolved.length > 0) {
    console.log(`✗ Unresolved chains (extend chain-mapping.ts):`);
    for (const c of report.chains_unresolved) console.log(`    - ${c}`);
  }
  if (report.countries_unresolved.length > 0) {
    console.log(`! Country overrides needed (extend country-mapping.ts):`);
    for (const c of report.countries_unresolved.slice(0, 20)) console.log(`    - ${c}`);
    if (report.countries_unresolved.length > 20) {
      console.log(`    … and ${report.countries_unresolved.length - 20} more`);
    }
  }
  console.log(`\n→ Wrote ${OUTPUT_PATH}`);
}

main();
