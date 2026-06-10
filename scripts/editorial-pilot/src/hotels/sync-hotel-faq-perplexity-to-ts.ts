/**
 * Generate a TypeScript golden module from validated Perplexity FAQ JSON.
 *
 * Used by kit fiches that ship constants in @mch/domain (e.g. Airelles).
 *
 * CLI: tsx src/hotels/sync-hotel-faq-perplexity-to-ts.ts \
 *        --input=DA/_generated/airelles-faq-data.json \
 *        --out=packages/domain/src/editorial/airelles-faq-perplexity.generated.ts \
 *        --prefix=AIRELLES
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parsePerplexityHotelFaqResearch, evaluateFaqKitCoverage } from './faq-perplexity-gates.js';
import { transformPerplexityHotelFaq } from './faq-perplexity-transform.js';

interface CliArgs {
  readonly input: string;
  readonly out: string;
  readonly prefix: string;
  readonly hotelName: string;
  readonly sourceLabel: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let input: string | null = null;
  let out: string | null = null;
  let prefix = 'HOTEL';
  let hotelName = '';
  let sourceLabel = 'Perplexity research';
  for (const arg of argv) {
    if (arg.startsWith('--input=')) input = arg.slice('--input='.length);
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
    else if (arg.startsWith('--prefix=')) prefix = arg.slice('--prefix='.length);
    else if (arg.startsWith('--hotel-name=')) hotelName = arg.slice('--hotel-name='.length);
    else if (arg.startsWith('--source=')) sourceLabel = arg.slice('--source='.length);
  }
  if (input === null || out === null) {
    throw new Error('--input and --out are required');
  }
  return { input, out, prefix, hotelName, sourceLabel };
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const raw: unknown = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
  const parsed = parsePerplexityHotelFaqResearch(raw);
  if (!parsed.ok) throw new Error('Invalid Perplexity JSON — run validate first');

  const transformed = transformPerplexityHotelFaq(parsed.data, { hotelName: args.hotelName });
  const gate = evaluateFaqKitCoverage(
    transformed.kit,
    transformed.conciergeQuestions,
    args.hotelName,
    transformed.promote,
  );
  if (!gate.ok) throw new Error('Kit gates failed');

  const faqLines = transformed.kit
    .map(
      (item) => `  {
    category: '${item.category}',
    group_fr: '${esc(item.group_fr)}',
    group_en: '${esc(item.group_en)}',
    question_fr: '${esc(item.question_fr)}',
    answer_fr: '${esc(item.answer_fr)}',
  }`,
    )
    .join(',\n');

  const promoteLines = transformed.promote
    .map(
      (item) => `  {
    category: '${item.category}',
    group_fr: '${esc(item.group_fr)}',
    group_en: '${esc(item.group_en)}',
    question_fr: '${esc(item.question_fr)}',
    answer_fr: '${esc(item.answer_fr)}',
  }`,
    )
    .join(',\n');

  const conciergeLines = transformed.conciergeQuestions
    .map(
      (item) => `  {
    category_fr: '${esc(item.category_fr)}',
    category_en: '${esc(item.category_en)}',
    question_fr: '${esc(item.question_fr)}',
    reply_fr: '${esc(item.reply_fr)}',
  }`,
    )
    .join(',\n');

  const output = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: ${args.sourceLabel}
 * Regenerate: pnpm --filter @mch/editorial-pilot faq:perplexity:sync-ts -- --input=${args.input} --out=${args.out} --prefix=${args.prefix}
 */

/** ${transformed.kit.length} factual FAQ items for kit render + DOM. */
export const ${args.prefix}_FAQ_CONTENT_KIT = [
${faqLines},
] as const;

/** CDC §2.11 promote subset (${transformed.promote.length} items). */
export const ${args.prefix}_FAQ_CONTENT_PROMOTE = [
${promoteLines},
] as const;

/** ${transformed.conciergeQuestions.length} concierge-voice Q&A. */
export const ${args.prefix}_CONCIERGE_QUESTIONS_KIT = [
${conciergeLines},
] as const;

export type ${args.prefix.charAt(0)}${args.prefix.slice(1).toLowerCase()}ConciergeQuestionKit = (typeof ${args.prefix}_CONCIERGE_QUESTIONS_KIT)[number];
`;

  writeFileSync(resolve(args.out), output, 'utf8');
  console.log(`Wrote ${args.out}`);
  console.log(
    `FAQ kit=${transformed.kit.length}, promote=${transformed.promote.length}, concierge=${transformed.conciergeQuestions.length}`,
  );
}

main();
