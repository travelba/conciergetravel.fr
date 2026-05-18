/**
 * Smoke test — fetch real Wikimedia Commons photos for a hotel.
 *
 * Usage:
 *   pnpm tsx scripts/photos/smoke-commons.ts "Hôtel Le Bristol Paris"
 *   pnpm tsx scripts/photos/smoke-commons.ts "Plaza Athénée" 5
 */
import { defaultCommonsConfig, fetchCategoryPhotos } from '@mch/integrations/wikimedia-commons';

async function main(): Promise<void> {
  const category = process.argv[2] ?? 'Hôtel Le Bristol Paris';
  const max = Number.parseInt(process.argv[3] ?? '10', 10);

  console.log(`Fetching up to ${max} photos for Commons category: "${category}"`);
  const cfg = defaultCommonsConfig('https://myconciergehotel.com');
  const res = await fetchCategoryPhotos(cfg, category, max);
  if (!res.ok) {
    console.error('FAIL:', res.error);
    process.exit(1);
  }
  console.log(`\n${res.value.length} photo(s) found:\n`);
  for (const [i, p] of res.value.entries()) {
    console.log(`#${i + 1} — ${p.title}`);
    console.log(`  ${p.width}x${p.height} ${p.mime}`);
    console.log(`  license: ${p.license}`);
    if (p.attribution !== undefined) console.log(`  artist: ${p.attribution.slice(0, 80)}`);
    console.log(`  url: ${p.downloadUrl}`);
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
