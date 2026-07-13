import { z } from 'zod';

import { getRanking, getHotel, requestQuote, searchHotels } from '@/server/agent/handlers';

const localeSchema = z.enum(['fr', 'en']).default('fr');

export const SearchHotelsInputSchema = z.object({
  destination: z.string().min(1).max(120),
  check_in: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  check_out: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
    .optional(),
  adults: z.number().int().min(1).max(6).optional(),
  children: z.number().int().min(0).max(4).optional(),
  locale: localeSchema,
  limit: z.number().int().min(1).max(10).default(5),
});

export const GetHotelInputSchema = z.object({
  slug: z.string().min(1).max(120),
  locale: localeSchema,
});

export const GetRankingInputSchema = z.object({
  slug: z.string().min(1).max(160),
  locale: localeSchema,
});

export const QuoteInputSchema = z.object({
  hotelSlug: z.string().min(1).max(120),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD'),
  adults: z.number().int().min(1).max(6).default(2),
  message: z.string().trim().max(1000).optional(),
  email: z.string().email(),
  locale: localeSchema,
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: readonly string[];
  };
};

/** MCP tool catalogue — mirrors ADR-0017 HTTP endpoints on v2. */
export const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: 'search_hotels',
    description:
      'Search the MyConciergeHotel v2 catalogue by destination (city, country or hotel name). Returns up to 10 editorial hotel cards with canonical URLs. Live GDS pricing is frozen until Phase 6 — omit dates for catalogue-only results.',
    inputSchema: {
      type: 'object',
      properties: {
        destination: { type: 'string', description: 'City, country or hotel name (e.g. "paris").' },
        check_in: { type: 'string', description: 'Arrival YYYY-MM-DD (optional, Phase 6).' },
        check_out: { type: 'string', description: 'Departure YYYY-MM-DD (optional, Phase 6).' },
        adults: { type: 'integer', minimum: 1, maximum: 6 },
        children: { type: 'integer', minimum: 0, maximum: 4 },
        locale: { type: 'string', description: '"fr" (default) or "en".' },
        limit: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['destination'],
    },
  },
  {
    name: 'get_hotel',
    description:
      'Fetch a hotel fiche by slug: identity, factual summary, Concierge advice, rooms and photos. Always includes canonicalUrl for citation.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Kebab-case slug (e.g. "le-meurice").' },
        locale: { type: 'string', description: '"fr" or "en".' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_ranking',
    description:
      'Fetch an editorial ranking by slug: title, intro, ordered hotel entries with teasers and canonical hotel URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Ranking slug (e.g. "meilleur-hotel-luxe-paris").' },
        locale: { type: 'string', description: '"fr" or "en".' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'request_quote',
    description:
      'Submit a concierge quote request for a non-GDS hotel. Returns a request reference and 24h ETA. Phase 6 wires Brevo + booking_requests_email.',
    inputSchema: {
      type: 'object',
      properties: {
        hotelSlug: { type: 'string' },
        checkIn: { type: 'string', format: 'date' },
        checkOut: { type: 'string', format: 'date' },
        adults: { type: 'integer', minimum: 1, maximum: 6 },
        message: { type: 'string' },
        email: { type: 'string', format: 'email' },
        locale: { type: 'string' },
      },
      required: ['hotelSlug', 'checkIn', 'checkOut', 'email'],
    },
  },
];

export type McpToolCallResult =
  | { ok: true; content: ReadonlyArray<{ type: 'text'; text: string }> }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };

function toTextContent(payload: unknown): McpToolCallResult {
  return {
    ok: true,
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function toolError(code: string, message: string, retryable = false): McpToolCallResult {
  return { ok: false, error: { code, message, retryable } };
}

/** Execute a named MCP tool — shared by `/api/mcp` and unit tests. */
export async function callMcpTool(name: string, args: unknown): Promise<McpToolCallResult> {
  switch (name) {
    case 'search_hotels': {
      const parsed = SearchHotelsInputSchema.safeParse(args);
      if (!parsed.success) {
        return toolError('validation', parsed.error.issues[0]?.message ?? 'invalid input');
      }
      const body = parsed.data;
      return toTextContent(
        await searchHotels({
          destination: body.destination,
          checkIn: body.check_in,
          checkOut: body.check_out,
          adults: body.adults,
          children: body.children,
          locale: body.locale,
          limit: body.limit,
        }),
      );
    }
    case 'get_hotel': {
      const parsed = GetHotelInputSchema.safeParse(args);
      if (!parsed.success) {
        return toolError('validation', parsed.error.issues[0]?.message ?? 'invalid input');
      }
      const result = await getHotel({ slug: parsed.data.slug, locale: parsed.data.locale });
      if (!result.ok) return toolError('not_found', `Hotel "${parsed.data.slug}" not found`);
      return toTextContent(result);
    }
    case 'get_ranking': {
      const parsed = GetRankingInputSchema.safeParse(args);
      if (!parsed.success) {
        return toolError('validation', parsed.error.issues[0]?.message ?? 'invalid input');
      }
      const result = await getRanking({ slug: parsed.data.slug, locale: parsed.data.locale });
      if (!result.ok) return toolError('not_found', `Ranking "${parsed.data.slug}" not found`);
      return toTextContent(result);
    }
    case 'request_quote': {
      const parsed = QuoteInputSchema.safeParse(args);
      if (!parsed.success) {
        return toolError('validation', parsed.error.issues[0]?.message ?? 'invalid input');
      }
      const result = await requestQuote(parsed.data);
      if (!result.ok) return toolError('not_found', `Hotel "${parsed.data.hotelSlug}" not found`);
      return toTextContent(result);
    }
    default:
      return toolError('unknown_tool', `Unknown tool: ${name}`);
  }
}
