/**
 * v2 CLI runner — generates long-read editorial destination guides
 * (≥ 3500 words, 6 tables, glossary, callouts, sources) and
 * persists them to `editorial_guides` (v2 columns from migration 0027).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/guides/run-guides-v2.ts --slug=paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/guides/run-guides-v2.ts --slug=paris,courchevel,cote-d-azur
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/guides/run-guides-v2.ts --all
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/guides/run-guides-v2.ts --all --draft
 *
 * DataForSEO grounding (hard rule PO 2026-06-25) is ON by default. Flags:
 *   --no-grounding   generate LLM-only (degrade-safe path / Vercel build)
 *   --dry-run        generate + print the injected DFS block + PAA coverage,
 *                    DO NOT write to the DB (preserves the EN parity on the
 *                    99 published guides — full regen is a separate decision)
 *
 * The v1 entrypoint (run-guides.ts) is preserved for rollback.
 */

import { renderGroundingForPrompt } from '../grounding/keyword-grounding.js';
import {
  DESTINATIONS,
  findDestinationBySlug,
  type DestinationGuideSeed,
} from './destinations-catalog.js';
import {
  generateGuideV2,
  resolveGuideGrounding,
  type GenerateGuideV2Options,
} from './generate-guide-v2.js';
import { pushGuideV2 } from './push-guide-v2.js';

interface CliArgs {
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly publish: boolean;
  readonly grounded: boolean;
  readonly dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let slugs: readonly string[] = [];
  let all = false;
  let publish = true;
  let grounded = true;
  let dryRun = false;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--draft') publish = false;
    else if (a === '--no-grounding') grounded = false;
    else if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--slug=')) {
      const v = a.slice('--slug='.length).trim();
      slugs = v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return { slugs, all, publish, grounded, dryRun };
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((w) => w.length > 0).length;
}

async function runOne(
  dest: DestinationGuideSeed,
  opts: { publish: boolean; grounded: boolean; dryRun: boolean },
): Promise<void> {
  const tag = `[${dest.slug}]`;
  console.log(`${tag} generating v2${opts.dryRun ? ' (dry-run)' : ''}…`);

  // In dry-run we resolve the grounding up-front so we can PRINT the exact
  // `### Ancrage SEO/GEO (DataForSEO)` block that gets injected into Call M,
  // every Call S and Call FAQ — then pass it back to the generator so we
  // don't pay a second round-trip. Live runs let the generator self-ground.
  let genOptions: GenerateGuideV2Options = opts.grounded ? {} : { disableGrounding: true };
  if (opts.dryRun) {
    const grounding = await resolveGuideGrounding(dest, genOptions);
    if (grounding?.grounded) {
      console.log(`${tag} grounding=on (PAA=${grounding.peopleAlsoAsk.length})`);
      const block = renderGroundingForPrompt(grounding);
      if (block.length > 0) {
        console.log(`${tag} --- ### Ancrage SEO/GEO (DataForSEO) — injecté Call M + S + FAQ ---`);
        console.log(block);
        console.log(`${tag} --- fin du bloc DFS ---`);
      }
      genOptions = { grounding };
    } else {
      console.log(`${tag} grounding=off`);
    }
  }

  const t0 = Date.now();
  const guide = await generateGuideV2(dest, genOptions);
  const dt = Date.now() - t0;

  const wordsBody = guide.sections.reduce((acc, s) => acc + countWords(s.body_fr), 0);
  const wordsHighlights = guide.highlights.reduce(
    (acc, h) => acc + countWords(h.description_fr),
    0,
  );
  const wordsFaq = guide.faq.reduce((acc, f) => acc + countWords(f.answer_fr), 0);
  const wordsTotal = wordsBody + wordsHighlights + wordsFaq;

  console.log(
    `${tag} ✓ generated in ${dt} ms — sections=${guide.sections.length}, tables=${guide.tables.length}, glossary=${guide.glossary.length}, callouts=${guide.editorial_callouts.length}, sources=${guide.external_sources.length}, highlights=${guide.highlights.length}, faq=${guide.faq.length}, words_fr≈${wordsTotal} (body=${wordsBody}, highlights=${wordsHighlights}, faq=${wordsFaq})`,
  );

  if (wordsTotal < 3500) {
    console.warn(`${tag} ⚠ total words ${wordsTotal} < 3500 target — consider re-running.`);
  }

  if (opts.dryRun) {
    console.log(`${tag} ✓ dry-run — NOT persisted`);
    return;
  }

  await pushGuideV2(dest, guide, { publish: opts.publish });
  console.log(`${tag} ✓ persisted to editorial_guides v2 (published=${opts.publish})`);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const targets: DestinationGuideSeed[] = [];
  if (args.slugs.length > 0) {
    for (const slug of args.slugs) {
      const d = findDestinationBySlug(slug);
      if (d === null) {
        console.error(
          `No destination with slug "${slug}". Known slugs: ${DESTINATIONS.map((x) => x.slug).join(', ')}`,
        );
        process.exit(1);
      }
      targets.push(d);
    }
  } else if (args.all) {
    targets.push(...DESTINATIONS);
  } else {
    console.error(
      'Usage: tsx src/guides/run-guides-v2.ts --slug=<slug>[,<slug>...] | --all [--draft] [--no-grounding] [--dry-run]',
    );
    process.exit(1);
  }

  console.log(
    `Generating v2 — ${targets.length} guide(s) — grounding=${args.grounded ? 'on' : 'off'} dryRun=${args.dryRun}…`,
  );
  let ok = 0;
  let fail = 0;
  for (const d of targets) {
    try {
      await runOne(d, { publish: args.publish, grounded: args.grounded, dryRun: args.dryRun });
      ok += 1;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      fail += 1;
      console.error(`[${d.slug}] ✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nDone — ${ok} OK / ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
