/**
 * Validate Perplexity hotel FAQ research JSON (schema + kit coverage gates).
 *
 * CLI
 * ---
 *   --input=<path>           path to Perplexity JSON output
 *   --hotel-name=<name>      hotel display name (canonical FAQ matching)
 *   --print-promote          print promote subset JSON to stdout
 *
 * Examples
 * --------
 *   pnpm faq:perplexity:validate -- --input=out/faq-perplexity/le-bristol-paris.json --hotel-name="Le Bristol Paris"
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { evaluateFaqKitCoverage, parsePerplexityHotelFaqResearch } from './faq-perplexity-gates.js';
import { transformPerplexityHotelFaq } from './faq-perplexity-transform.js';

interface CliArgs {
  readonly input: string;
  readonly hotelName: string;
  readonly printPromote: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let input: string | null = null;
  let hotelName = '';
  let printPromote = false;
  for (const arg of argv) {
    if (arg.startsWith('--input=')) input = arg.slice('--input='.length);
    else if (arg.startsWith('--hotel-name=')) hotelName = arg.slice('--hotel-name='.length);
    else if (arg === '--print-promote') printPromote = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: tsx src/hotels/run-hotel-faq-perplexity.ts --input=<path> [--hotel-name=…] [--print-promote]',
      );
      process.exit(0);
    }
  }
  if (input === null || input.trim().length === 0) {
    throw new Error('--input=<path> is required');
  }
  return { input, hotelName, printPromote };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const absPath = resolve(args.input);
  const raw: unknown = JSON.parse(readFileSync(absPath, 'utf8'));

  const parsed = parsePerplexityHotelFaqResearch(raw);
  if (!parsed.ok) {
    console.error('Schema validation failed:');
    for (const issue of parsed.issues) {
      console.error(`  [${issue.severity}] ${issue.message}`);
    }
    process.exit(1);
  }

  const transformed = transformPerplexityHotelFaq(parsed.data, {
    hotelName: args.hotelName,
  });
  const gate = evaluateFaqKitCoverage(
    transformed.kit,
    transformed.conciergeQuestions,
    args.hotelName,
    transformed.promote,
  );

  console.log(`Input: ${absPath}`);
  console.log(`Kit FAQ: ${transformed.kit.length}`);
  console.log(`Promote (faq_content): ${transformed.promote.length}`);
  console.log(`Concierge questions: ${transformed.conciergeQuestions.length}`);

  for (const issue of gate.issues) {
    const prefix = issue.severity === 'blocker' ? 'FAIL' : 'WARN';
    console.log(`  [${prefix}] ${issue.message}`);
  }

  if (args.printPromote) {
    console.log(JSON.stringify({ promote: transformed.promote }, null, 2));
  }

  if (!gate.ok) {
    process.exit(1);
  }
  console.log('Validation OK');
}

main();
