#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const envText = readFileSync('apps/web/.env.local', 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;

// Canonical slugs persisted by run-chain-ranking.ts (Phase 4.B 2026-05-28).
// Some seeds carry the `-hotels-monde` suffix, others use a brand-specific
// suffix (`-palaces-monde`, `-wellness-monde`, `cheval-blanc-toutes-les-maisons`).
// Keep this list in lockstep with CHAIN_SPECS in run-chain-ranking.ts.
const slugs = [
  'top-aman-hotels-monde',
  'top-four-seasons-palaces-monde',
  'top-mandarin-oriental-hotels-monde',
  'top-six-senses-wellness-monde',
  'cheval-blanc-toutes-les-maisons',
  'top-belmond-hotels-monde',
  'top-rosewood-hotels-monde',
  'top-park-hyatt-hotels-monde',
];

const filter = `slug=in.(${slugs.join(',')})`;
const target = `${url}/rest/v1/editorial_rankings?${filter}&select=slug,title_fr,title_en,is_published,updated_at`;

// Fuzzy search runs only when `--fuzzy` is passed — useful to track down
// legacy/contaminated slugs that should have been unpublished.
const fuzzy = process.argv.includes('--fuzzy');
if (fuzzy) {
  const fuzzyTargets = [
    ['aman', `${url}/rest/v1/editorial_rankings?slug=ilike.*aman*&select=slug,title_fr,is_published`],
    ['four-seasons', `${url}/rest/v1/editorial_rankings?slug=ilike.*four-seasons*&select=slug,title_fr,is_published`],
    ['mandarin', `${url}/rest/v1/editorial_rankings?slug=ilike.*mandarin*&select=slug,title_fr,is_published`],
    ['six-senses', `${url}/rest/v1/editorial_rankings?slug=ilike.*six-senses*&select=slug,title_fr,is_published`],
    ['cheval-blanc', `${url}/rest/v1/editorial_rankings?slug=ilike.*cheval-blanc*&select=slug,title_fr,is_published`],
    ['belmond', `${url}/rest/v1/editorial_rankings?slug=ilike.*belmond*&select=slug,title_fr,is_published`],
    ['rosewood', `${url}/rest/v1/editorial_rankings?slug=ilike.*rosewood*&select=slug,title_fr,is_published`],
    ['park-hyatt', `${url}/rest/v1/editorial_rankings?slug=ilike.*park-hyatt*&select=slug,title_fr,is_published`],
  ];
  console.log('\n--- Fuzzy search by brand (--fuzzy) ---');
  for (const [name, u] of fuzzyTargets) {
    const fr = await fetch(u, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    const fj = await fr.json();
    console.log(`${name}: ${JSON.stringify(fj)}`);
  }
  console.log('--- end fuzzy ---\n');
}

const r = await fetch(target, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const rows = await r.json();
if (!Array.isArray(rows)) {
  console.error('PostgREST error:', JSON.stringify(rows, null, 2));
  process.exit(1);
}
console.log(`Found ${rows.length} of ${slugs.length} requested chain rankings`);
for (const row of rows) {
  console.log(`  ${row.is_published ? '✓' : '✗'} ${row.slug.padEnd(40)} → "${(row.title_fr ?? '').slice(0, 60)}" (updated ${row.updated_at})`);
}
const missing = slugs.filter((s) => !rows.find((r) => r.slug === s));
if (missing.length) {
  console.log(`\nMISSING: ${missing.join(', ')}`);
}
