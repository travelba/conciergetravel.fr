/**
 * probe-room-extract.ts — READ-ONLY feasibility probe (no DB writes).
 *
 * Proves whether the official-site → Tavily → llmExtract path can yield
 * REAL, non-fabricated room-type data (name, size, bed, occupancy) for a
 * hotel. Used to de-risk the Wave 4 rooms seed before building the full
 * pipeline. Anti-fabrication: unknown fields come back null (see
 * `llm-extract.ts` ANTI_HALLUCINATION_RULES).
 *
 *   npx tsx src/photos/probe-room-extract.ts
 *
 * Skills: content-enrichment-pipeline, llm-output-robustness.
 */

import { z } from 'zod';

import { tavilySearchAndExtract } from '../enrichment/tavily-client.js';
import { llmExtract } from '../enrichment/llm-extract.js';

interface Probe {
  readonly slug: string;
  readonly name: string;
  readonly domain: string;
}

const PROBES: readonly Probe[] = [
  {
    slug: 'southern-ocean-lodge',
    name: 'Southern Ocean Lodge',
    domain: 'southernoceanlodge.com.au',
  },
  { slug: 'mykonos-lolita', name: 'Mykonos Lolita', domain: 'grecotel.com' },
];

const RoomTypeSchema = z.object({
  name: z.string().min(2),
  size_sqm: z.number().int().positive().nullable(),
  bed_type: z.string().nullable(),
  max_occupancy: z.number().int().positive().nullable(),
  short_description: z.string().nullable(),
  evidence_quote: z.string().nullable(),
});
const RoomsExtractSchema = z.object({ rooms: z.array(RoomTypeSchema) });

const SCHEMA_DESC = `{
  "rooms": [
    {
      "name": string — exact room/suite type name as written on the site,
      "size_sqm": integer | null — room surface in m² ONLY if explicitly stated (convert sq ft → m² only if the site gives sq ft, else null),
      "bed_type": string | null — e.g. "King", "Two Queen", only if stated,
      "max_occupancy": integer | null — max guests only if stated,
      "short_description": string | null — one factual sentence drawn verbatim-ish from the site,
      "evidence_quote": string | null — the literal source phrase proving the room exists
    }
  ]
}`;

async function main(): Promise<void> {
  for (const probe of PROBES) {
    console.log(`\n=== ${probe.slug} (${probe.name}) — domain ${probe.domain} ===`);
    try {
      const res = await tavilySearchAndExtract({
        query: `${probe.name} rooms suites accommodations`,
        extractQuery: 'room types suites size m2 bed occupancy',
        includeDomains: [probe.domain],
        maxSearchResults: 8,
        maxExtractUrls: 3,
        chunksPerSource: 5,
      });
      console.log(`  extracted ${res.extracted.length} source(s), ${res.failed.length} failed`);
      const content = res.extracted.map((e) => `# ${e.title}\n${e.content}`).join('\n\n');
      if (content.trim().length < 50) {
        console.log('  [SKIP] no usable content extracted');
        continue;
      }
      const out = await llmExtract({
        content,
        context: `${probe.name} — extract room/suite types`,
        schemaDescription: SCHEMA_DESC,
        schema: RoomsExtractSchema,
        maxOutputTokens: 3000,
      });
      if (out === null) {
        console.log('  [RESULT] extraction returned null (no reliable rooms found)');
        continue;
      }
      console.log(`  [RESULT] ${out.data.rooms.length} room type(s) (model ${out.model}):`);
      for (const r of out.data.rooms) {
        console.log(
          `    • ${r.name} | ${r.size_sqm ?? '?'}m² | ${r.bed_type ?? '?'} | occ ${r.max_occupancy ?? '?'}`,
        );
        if (r.evidence_quote) console.log(`        ↳ "${r.evidence_quote.slice(0, 90)}"`);
      }
    } catch (e) {
      console.log(`  [FAIL] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

void main().catch((e: unknown) => {
  console.error('[probe-room-extract] fatal:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
