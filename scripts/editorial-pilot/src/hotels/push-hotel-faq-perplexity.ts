/**
 * Push validated Perplexity FAQ research to Supabase.
 *
 * Writes:
 *   - `faq_content_kit` — full 40–60 factual kit (DOM + GEO)
 *   - `faq_content` — 10–15 promote subset (JSON-LD + publish gates)
 *   - `concierge_questions` — 20–30 concierge-voice Q&A
 *
 * CLI
 * ---
 *   --slug=<slug>
 *   --input=<path>
 *   --hotel-name=<name>
 *   --dry-run
 *
 * Examples
 * --------
 *   pnpm faq:perplexity:push -- --slug=les-airelles-gordes --input=DA/_generated/airelles-faq-data.json --hotel-name="Airelles Gordes, La Bastide"
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadPhotoEnv } from '../photos/env-photos.js';
import { patchHotelById, selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { evaluateFaqKitCoverage, parsePerplexityHotelFaqResearch } from './faq-perplexity-gates.js';
import { transformPerplexityHotelFaq } from './faq-perplexity-transform.js';

interface CliArgs {
  readonly slug: string;
  readonly input: string;
  readonly hotelName: string;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slug: string | null = null;
  let input: string | null = null;
  let hotelName = '';
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--input=')) input = arg.slice('--input='.length);
    else if (arg.startsWith('--hotel-name=')) hotelName = arg.slice('--hotel-name='.length);
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: tsx src/hotels/push-hotel-faq-perplexity.ts --slug=<slug> --input=<path> [--hotel-name=…] [--dry-run]',
      );
      process.exit(0);
    }
  }
  if (slug === null || slug.trim().length === 0) throw new Error('--slug=<slug> is required');
  if (input === null || input.trim().length === 0) throw new Error('--input=<path> is required');
  return { slug, input, hotelName, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const absPath = resolve(args.input);
  const raw: unknown = JSON.parse(readFileSync(absPath, 'utf8'));

  const parsed = parsePerplexityHotelFaqResearch(raw);
  if (!parsed.ok) {
    console.error('Schema validation failed — run faq:perplexity:validate first');
    process.exit(1);
  }

  const hotelName = args.hotelName.length > 0 ? args.hotelName : args.slug;
  const transformed = transformPerplexityHotelFaq(parsed.data, { hotelName });
  const gate = evaluateFaqKitCoverage(
    transformed.kit,
    transformed.conciergeQuestions,
    hotelName,
    transformed.promote,
  );
  if (!gate.ok) {
    console.error('Kit coverage gates failed:');
    for (const issue of gate.issues.filter((i) => i.severity === 'blocker')) {
      console.error(`  ${issue.message}`);
    }
    process.exit(1);
  }

  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const rows = await selectHotels<{ readonly id: string; readonly name: string }>(cfg, {
    columns: 'id,name',
    filters: [`slug=eq.${args.slug}`],
    limit: 1,
  });
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Hotel not found: ${args.slug}`);
  }

  const payload = {
    faq_content_kit: transformed.kit,
    faq_content: transformed.promote,
    concierge_questions: transformed.conciergeQuestions,
    updated_at: new Date().toISOString(),
  };

  console.log(`Hotel: ${args.slug} (${row.name})`);
  console.log(
    `Patching kit=${transformed.kit.length}, promote=${transformed.promote.length}, concierge=${transformed.conciergeQuestions.length}`,
  );

  if (args.dryRun) {
    console.log('[dry-run] Skipping Supabase PATCH');
    return;
  }

  await patchHotelById(cfg, row.id, payload);
  console.log('Push OK');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
