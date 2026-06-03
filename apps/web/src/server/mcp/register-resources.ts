import 'server-only';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

import { GET as hotelsJsonlGET } from '@/app/.well-known/hotels.jsonl/route';
import { GET as llmsFullGET } from '@/app/llms-full.txt/route';
import { GET as llmsTxtGET } from '@/app/llms.txt/route';

import { REGISTERED_TOOL_NAMES } from './register-tools';

/**
 * Registers the read-only MCP resources (Lot 4, ADR-0029).
 *
 * The machine feeds (hotels.jsonl, llms.txt, llms-full.txt) are produced
 * by invoking the EXACT same route handlers that serve the public
 * `/.well-known/*` and `/llms*.txt` URLs — zero duplication, guaranteed
 * parity with the HTTP surface. A synthetic `phase6` resource documents
 * the data-driven freeze so an agent can read why pricing/booking tools
 * return `frozen` without trial-and-error.
 */

const BASE = 'mcp://myconciergehotel';

export function registerMchResources(server: McpServer): void {
  server.registerResource(
    'hotels-catalog',
    `${BASE}/hotels.jsonl`,
    {
      title: 'Published hotels catalogue (NDJSON)',
      description:
        'Complete machine-readable catalogue of every published hotel, one JSON object per line (NDJSON). Identity, ISO-3166-1 country, WGS84 coordinates, Palace distinction, external IDs (Wikidata/Wikipedia/TripAdvisor/Booking/official) and a factual summary.',
      mimeType: 'application/x-ndjson',
    },
    async (uri): Promise<ReadResourceResult> => {
      const res = await hotelsJsonlGET();
      const text = await res.text();
      return {
        contents: [{ uri: uri.href, mimeType: 'application/x-ndjson', text }],
      };
    },
  );

  server.registerResource(
    'llms-index',
    `${BASE}/llms.txt`,
    {
      title: 'llms.txt — concise LLM index',
      description:
        'Concise, link-first index for LLM crawlers: strategic pages, prioritised catalogue extract, rankings, guides, itineraries, country guides and the LLM-actionable API surface.',
      mimeType: 'text/plain',
    },
    async (uri): Promise<ReadResourceResult> => {
      const res = await llmsTxtGET();
      const text = await res.text();
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text }] };
    },
  );

  server.registerResource(
    'llms-full',
    `${BASE}/llms-full.txt`,
    {
      title: 'llms-full.txt — verbose LLM corpus',
      description:
        'Verbose LLM corpus: EEAT editorial preamble (IATA/APST agency) then one FR and one EN section per indexable hotel (factual summary, key facts, freshness). Editorial complement to hotels.jsonl.',
      mimeType: 'text/plain',
    },
    async (uri): Promise<ReadResourceResult> => {
      const res = await llmsFullGET();
      const text = await res.text();
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text }] };
    },
  );

  server.registerResource(
    'phase6-freeze',
    `${BASE}/phase6`,
    {
      title: 'Phase 6 freeze manifest',
      description:
        'Human + machine readable manifest of the data-driven Phase 6 freeze: which capabilities are frozen, why, and when they activate. Booking/pricing MCP tools never call live vendors during the observation phase.',
      mimeType: 'application/json',
    },
    (uri): ReadResourceResult => {
      const manifest = {
        phase: 6,
        freeze: 'data-driven',
        explanation:
          'Booking and pricing capabilities are gated on each hotel\'s `booking_mode` (and `makcorps_hotel_id` for the comparator). During the editorial/observation phase every published hotel is `display_only`, so the MCP tools `compare-prices`, `request-quote` and `booking` return `status: "frozen"` and never reach Makcorps / Amadeus / Brevo. They auto-activate per hotel — no code flag — the day a row flips to a bookable mode.',
        frozenCapabilities: ['compare-prices', 'request-quote', 'booking'],
        partiallyFrozen: [
          {
            tool: 'search',
            note: 'Returns the editorial catalogue; live `offers[]` are frozen (empty + `offersFrozen` marker).',
          },
        ],
        availableAt: 'phase_6',
        toolCount: REGISTERED_TOOL_NAMES.length,
        tools: REGISTERED_TOOL_NAMES,
      };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(manifest, null, 2),
          },
        ],
      };
    },
  );
}
