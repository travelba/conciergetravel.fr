// Reads an MCP execute_sql txt dump (multi-chain query with chain_key
// column), splits per chain_key, normalises rows to HotelCatalogRow
// shape, and writes one JSON file per chain to out/chain-hotels/.
//
// Usage:
//   node scripts/editorial-pilot/src/rankings/split-chain-dump.mjs <inputTxt>

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node split-chain-dump.mjs <inputTxt>');
  process.exit(1);
}

const raw = await readFile(inputPath, 'utf8');
let envelope;
try {
  envelope = JSON.parse(raw);
} catch {
  envelope = { result: raw };
}
const inner = typeof envelope.result === 'string' ? envelope.result : raw;
const m = inner.match(/<untrusted-data-[^>]+>\s*(\[[^]*?\])\s*<\/untrusted-data-[^>]+>/);
if (!m) {
  console.error('No JSON array found in untrusted-data block');
  process.exit(1);
}
const arr = JSON.parse(m[1]);

const buckets = {};
for (const h of arr) {
  const k = h.chain_key;
  if (!buckets[k]) buckets[k] = [];
  buckets[k].push({
    id: h.id,
    slug: h.slug,
    slug_en: h.slug_en ?? null,
    name: h.name,
    name_en: h.name_en ?? null,
    stars: typeof h.stars === 'number' ? h.stars : Number(h.stars) || 5,
    is_palace: Boolean(h.is_palace),
    city: h.city ?? '',
    region: h.region ?? '',
    country_code: h.country_code ?? null,
    description_fr: h.description_fr ?? null,
    address: h.address ?? null,
    postal_code: h.postal_code ?? null,
    latitude: h.latitude ?? null,
    longitude: h.longitude ?? null,
  });
}

const outDir = 'scripts/editorial-pilot/out/chain-hotels';
await mkdir(outDir, { recursive: true });
for (const [k, rows] of Object.entries(buckets)) {
  const fp = `${outDir}/${k}.json`;
  await writeFile(fp, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`${k}: ${rows.length} hotels → ${fp}`);
}
