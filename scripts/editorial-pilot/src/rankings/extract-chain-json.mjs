// Reads an MCP execute_sql response file (txt), extracts the JSON array
// between <untrusted-data> tags, and writes it to a target path.
// Usage: node extract-chain-json.mjs <inputTxt> <outputJson>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node extract-chain-json.mjs <inputTxt> <outputJson>');
  process.exit(1);
}

const raw = await readFile(inputPath, 'utf8');
// The MCP response is a JSON envelope: {"result": "Below is...\n\n<untrusted-data-XXX>\n[...JSON...]\n</untrusted-data-XXX>\n..."}.
// First parse outer JSON to get the string, then extract bracketed array.
let envelope;
try {
  envelope = JSON.parse(raw);
} catch (e) {
  console.error('outer JSON parse failed', e.message);
  process.exit(1);
}
const inner = typeof envelope?.result === 'string' ? envelope.result : raw;
const m = inner.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);
if (!m) {
  console.error('No JSON array found in untrusted-data block');
  process.exit(1);
}
const arr = JSON.parse(m[1]);

// Normalize: ensure required HotelCatalogRow fields are present.
const normalized = arr.map((h) => ({
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
}));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(normalized, null, 2), 'utf8');
console.log(`Wrote ${normalized.length} hotels to ${outputPath}`);
