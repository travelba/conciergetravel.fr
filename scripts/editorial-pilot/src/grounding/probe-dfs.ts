/**
 * probe-dfs.ts — one-shot live validation of the DataForSEO integration.
 *
 *   npx tsx src/grounding/probe-dfs.ts "hôtel Gordes"
 *
 * Validates credentials, the v3 envelope contract and the normalisers
 * against real data, and prints what the grounding layer will feed the
 * editorial prompts. Temporary diagnostic — safe to delete.
 */
import {
  fetchRelatedKeywords,
  fetchSerpQuestions,
  fetchSearchIntent,
} from '@mch/integrations/dataforseo';

import { loadDfsConfig } from './env-dfs.js';
import { groundKeywords, renderGroundingForPrompt } from './keyword-grounding.js';

async function main(): Promise<void> {
  const seed = process.argv[2] ?? 'hôtel Gordes';
  const FR = { locationName: 'France', languageCode: 'fr' } as const;

  const cfg = loadDfsConfig();
  if (cfg === null) {
    console.error('[probe] DFS disabled/unconfigured — check DATAFORSEO_* in .env.local');
    process.exit(1);
  }
  console.log(`[probe] cfg ok base=${cfg.baseUrl} user=${cfg.username.slice(0, 3)}***`);

  console.log(`\n[probe] related_keywords("${seed}") …`);
  const related = await fetchRelatedKeywords(cfg, seed, FR, { limit: 15 });
  if (related.ok) {
    console.log(`  -> ${String(related.value.length)} keywords`);
    for (const k of related.value.slice(0, 10)) {
      console.log(`     ${k.keyword}  vol=${String(k.searchVolume)} cpc=${String(k.cpc)}`);
    }
  } else {
    console.error('  ERROR', related.error);
  }

  console.log(`\n[probe] serp PAA("${seed}") …`);
  const serp = await fetchSerpQuestions(cfg, seed, FR);
  if (serp.ok) {
    console.log(
      `  -> PAA=${String(serp.value.peopleAlsoAsk.length)} related=${String(serp.value.relatedSearches.length)}`,
    );
    for (const q of serp.value.peopleAlsoAsk.slice(0, 8)) console.log(`     PAA: ${q}`);
    for (const r of serp.value.relatedSearches.slice(0, 8)) console.log(`     rel: ${r}`);
  } else {
    console.error('  ERROR', serp.error);
  }

  if (related.ok && related.value.length > 0) {
    const kws = related.value.slice(0, 8).map((k) => k.keyword);
    console.log(`\n[probe] search_intent(${String(kws.length)} kws) …`);
    const intent = await fetchSearchIntent(cfg, kws, 'fr');
    if (intent.ok) {
      for (const i of intent.value) console.log(`     ${i.keyword} -> ${String(i.intent)}`);
    } else {
      console.error('  ERROR', intent.error);
    }
  }

  console.log(`\n[probe] groundKeywords cluster (cached) …`);
  const g = await groundKeywords(cfg, [seed, `${seed} avis`], FR, { refresh: true });
  console.log(
    `  grounded=${String(g.grounded)} PAA=${String(g.peopleAlsoAsk.length)} kw=${String(g.topKeywords.length)}`,
  );
  console.log('\n--- prompt block preview ---');
  console.log(renderGroundingForPrompt(g).slice(0, 1200));
}

main().catch((e: unknown) => {
  console.error('[probe] fatal:', e instanceof Error ? e.message : e);
  process.exit(1);
});
