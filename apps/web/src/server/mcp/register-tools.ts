import 'server-only';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';

import { DEFAULT_AGENT_SKILLS } from '@mch/seo';

import {
  buildConciergeTipResult,
  buildHotelResult,
  buildHotelRoomResult,
  buildHotelSourcesResult,
  buildSearchResult,
} from './builders/hotels';
import {
  buildCountryGuideResult,
  buildItinerariesListResult,
  buildItineraryResult,
  buildRankingResult,
  buildRankingsListResult,
} from './builders/editorial';
import {
  buildBrandsResult,
  buildCategoriesResult,
  buildCitiesResult,
  buildLoyaltyResult,
  buildOccasionsResult,
  buildThemesResult,
} from './builders/taxonomy';
import { buildDirectoryCityResult, buildDirectoryCountryResult } from './builders/directory';
import {
  buildContactResult,
  buildJoinClubResult,
  buildJoinPrestigeResult,
  buildNewsletterResult,
} from './builders/funnel';
import { rawResponse, type BuilderResponse } from './builders/types';
import {
  buildFrozenBookingResult,
  buildFrozenComparePricesResult,
  buildFrozenQuoteResult,
} from './phase6';
import * as schemas from './schemas';
import { gateMcpTool } from './gate';
import { rateLimitedResult, toMcpResult } from './to-mcp-result';

/**
 * Registers every MyConciergeHotel agent skill as an MCP tool (Lot 4,
 * ADR-0029).
 *
 * Names + descriptions are pulled verbatim from `DEFAULT_AGENT_SKILLS`
 * (`@mch/seo`) — the single source of truth shared with
 * `/.well-known/agent-skills.json`. Each tool delegates to the SAME
 * shared result-builder the HTTP route uses, so the MCP and HTTP
 * surfaces stay in lock-step. Pricing/booking tools short-circuit
 * through the Phase 6 freeze guard (`phase6.ts`) — zero vendor calls.
 */

const SKILL_BY_NAME = new Map(DEFAULT_AGENT_SKILLS.skills.map((s) => [s.name, s]));

function describe(name: string): string {
  return SKILL_BY_NAME.get(name)?.description ?? name;
}

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
const MUTATING: ToolAnnotations = { readOnlyHint: false, openWorldHint: true };

/**
 * Stable list of every tool name we register — exported so the
 * coverage test can assert parity with the manifest's endpoint skills.
 */
export const REGISTERED_TOOL_NAMES = [
  'search',
  'list-cities',
  'get-hotel',
  'get-hotel-room',
  'list-rankings',
  'get-ranking',
  'compare-prices',
  'request-quote',
  'booking',
  'filter',
  'loyalty',
  'join-concierge-club',
  'join-concierge-club-prestige-waitlist',
  'contact',
  'newsletter',
  'list-categories',
  'list-themes',
  'list-occasions',
  'list-brands',
  'get-country-guide',
  'get-concierge-tip',
  'get-hotel-sources',
  'get-itinerary',
  'list-itineraries',
  'list-directory-country',
  'list-directory-city',
] as const;

export function registerMchTools(server: McpServer): void {
  // Wraps a builder-returning handler with the shared IP gate + the
  // BuilderResponse → CallToolResult mapping.
  const tool = <S extends ZodRawShape>(
    name: string,
    inputSchema: S,
    annotations: ToolAnnotations,
    run: (args: Record<string, unknown>) => Promise<BuilderResponse> | BuilderResponse,
  ): void => {
    // The SDK's `ToolCallback<S>` arg type cannot be expressed through a
    // generic passthrough without erasing `S`; we type the callback
    // explicitly (args are already validated against `inputSchema` by
    // the SDK) and bridge it with a single localized cast.
    const callback = async (
      args: Record<string, unknown>,
      extra: { requestInfo?: { headers?: Record<string, string | string[] | undefined> } },
    ): Promise<CallToolResult> => {
      const gate = await gateMcpTool(extra.requestInfo?.headers);
      if (!gate.ok) return rateLimitedResult(gate.retryAfterSec);
      return toMcpResult(await run(args));
    };
    server.registerTool(
      name,
      { description: describe(name), inputSchema, annotations },
      callback as never,
    );
  };

  // ── Reads ────────────────────────────────────────────────────────
  tool('search', schemas.searchShape, READ_ONLY, (a) =>
    buildSearchResult(
      {
        destination: a['destination'] as string,
        locale: a['locale'] as 'fr' | 'en',
        limit: a['limit'] as number,
        ...(a['checkIn'] !== undefined ? { checkIn: a['checkIn'] as string } : {}),
        ...(a['checkOut'] !== undefined ? { checkOut: a['checkOut'] as string } : {}),
        ...(a['adults'] !== undefined ? { adults: a['adults'] as number } : {}),
        ...(a['children'] !== undefined ? { children: a['children'] as number } : {}),
      },
      { freezeOffers: true },
    ),
  );

  tool('list-cities', schemas.emptyShape, READ_ONLY, () => buildCitiesResult());

  tool('get-hotel', schemas.hotelShape, READ_ONLY, (a) =>
    buildHotelResult({
      slug: a['slug'] as string,
      locale: a['locale'] as 'fr' | 'en',
      bodyMode: a['body'] as 'short' | 'long',
    }),
  );

  tool('get-hotel-room', schemas.hotelRoomShape, READ_ONLY, (a) =>
    buildHotelRoomResult({
      hotelSlug: a['hotelSlug'] as string,
      roomSlug: a['roomSlug'] as string,
      locale: a['locale'] as 'fr' | 'en',
    }),
  );

  tool('list-rankings', schemas.rankingsListShape, READ_ONLY, (a) =>
    buildRankingsListResult({
      locale: a['locale'] as 'fr' | 'en',
      ...(a['axe'] !== undefined
        ? { axe: a['axe'] as 'type' | 'lieu' | 'theme' | 'occasion' | 'saison' }
        : {}),
      ...(a['valeur'] !== undefined ? { valeur: a['valeur'] as string } : {}),
    }),
  );

  tool('get-ranking', schemas.rankingShape, READ_ONLY, (a) =>
    buildRankingResult({ slug: a['slug'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  // ── Pricing / booking — Phase 6 frozen (no vendor calls) ──────────
  tool('compare-prices', schemas.comparePricesShape, READ_ONLY, (a) =>
    buildFrozenComparePricesResult({
      hotelSlug: a['hotelSlug'] as string,
      checkIn: a['checkIn'] as string,
      checkOut: a['checkOut'] as string,
      adults: a['adults'] as number,
      locale: a['locale'] as 'fr' | 'en',
    }),
  );

  tool('request-quote', schemas.requestQuoteShape, READ_ONLY, (a) =>
    buildFrozenQuoteResult({
      hotelSlug: a['hotelSlug'] as string,
      locale: a['locale'] as 'fr' | 'en',
    }),
  );

  tool('booking', schemas.bookingShape, READ_ONLY, () => buildFrozenBookingResult());

  // `filter` has no executable endpoint — it's a hint that refines a
  // `search` / `list-rankings` call. We expose it so the agent can
  // discover the refinement vocabulary; the handler returns guidance.
  tool('filter', schemas.filterShape, READ_ONLY, (a) =>
    rawResponse(200, 'no-store', {
      ok: true,
      hint: 'refine',
      message:
        'Use these facets to refine a `search` (destination) or `list-rankings` (axe/valeur) call. `filter` is not an executable endpoint on its own.',
      applied: {
        type: a['type'] ?? null,
        amenity: a['amenity'] ?? null,
        country: a['country'] ?? null,
        region: a['region'] ?? null,
        city: a['city'] ?? null,
      },
      seeAlso: ['search', 'list-rankings', 'list-directory-country', 'list-directory-city'],
    }),
  );

  tool('loyalty', schemas.emptyShape, READ_ONLY, () => buildLoyaltyResult());

  // ── Funnel (mutating intents, dry-run shells) ─────────────────────
  tool('join-concierge-club', schemas.joinClubShape, MUTATING, (a) =>
    buildJoinClubResult({
      email: a['email'] as string,
      locale: a['locale'] as 'fr' | 'en',
      via: 'mcp-tool',
      ...(a['firstName'] !== undefined ? { firstName: a['firstName'] as string } : {}),
      ...(a['lastName'] !== undefined ? { lastName: a['lastName'] as string } : {}),
    }),
  );

  tool('join-concierge-club-prestige-waitlist', schemas.joinPrestigeShape, MUTATING, (a) =>
    buildJoinPrestigeResult({ locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('contact', schemas.contactShape, MUTATING, (a) =>
    buildContactResult({
      name: a['name'] as string,
      email: a['email'] as string,
      subject: a['subject'] as string,
      message: a['message'] as string,
      locale: a['locale'] as 'fr' | 'en',
      ...(a['phone'] !== undefined ? { phone: a['phone'] as string } : {}),
    }),
  );

  tool('newsletter', schemas.newsletterShape, MUTATING, (a) =>
    buildNewsletterResult({
      email: a['email'] as string,
      locale: a['locale'] as 'fr' | 'en',
      ...(a['topics'] !== undefined
        ? { topics: a['topics'] as ('palaces' | 'guides' | 'rankings' | 'concierge-tips')[] }
        : {}),
    }),
  );

  // ── Taxonomy / navigation ─────────────────────────────────────────
  tool('list-categories', schemas.emptyShape, READ_ONLY, () => buildCategoriesResult());
  tool('list-themes', schemas.emptyShape, READ_ONLY, () => buildThemesResult());
  tool('list-occasions', schemas.emptyShape, READ_ONLY, () => buildOccasionsResult());
  tool('list-brands', schemas.emptyShape, READ_ONLY, () => buildBrandsResult());

  tool('get-country-guide', schemas.countryGuideShape, READ_ONLY, (a) =>
    buildCountryGuideResult({ slug: a['slug'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('get-concierge-tip', schemas.conciergeTipShape, READ_ONLY, (a) =>
    buildConciergeTipResult({ slug: a['slug'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('get-hotel-sources', schemas.hotelSourcesShape, READ_ONLY, (a) =>
    buildHotelSourcesResult({ slug: a['slug'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('get-itinerary', schemas.itineraryShape, READ_ONLY, (a) =>
    buildItineraryResult({ slug: a['slug'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('list-itineraries', schemas.itinerariesListShape, READ_ONLY, (a) =>
    buildItinerariesListResult({
      locale: a['locale'] as 'fr' | 'en',
      ...(a['country_code'] !== undefined ? { country_code: a['country_code'] as string } : {}),
      ...(a['destination_region'] !== undefined
        ? { destination_region: a['destination_region'] as string }
        : {}),
      ...(a['destination_city'] !== undefined
        ? { destination_city: a['destination_city'] as string }
        : {}),
      ...(a['theme'] !== undefined ? { theme: a['theme'] as string } : {}),
      ...(a['travel_style'] !== undefined ? { travel_style: a['travel_style'] as string } : {}),
      ...(a['duration_min_days'] !== undefined
        ? { duration_min_days: a['duration_min_days'] as number }
        : {}),
      ...(a['duration_max_days'] !== undefined
        ? { duration_max_days: a['duration_max_days'] as number }
        : {}),
    }),
  );

  tool('list-directory-country', schemas.directoryCountryShape, READ_ONLY, (a) =>
    buildDirectoryCountryResult({ pays: a['pays'] as string, locale: a['locale'] as 'fr' | 'en' }),
  );

  tool('list-directory-city', schemas.directoryCityShape, READ_ONLY, (a) =>
    buildDirectoryCityResult({
      pays: a['pays'] as string,
      ville: a['ville'] as string,
      locale: a['locale'] as 'fr' | 'en',
    }),
  );
}
