import { z } from 'zod';

/**
 * Zod input shapes for the MCP tools (Lot 4, ADR-0029).
 *
 * These are the *executable* contract advertised to MCP clients (the
 * `inputSchema` of each tool). The JSON-ish `inputSchema` in
 * `DEFAULT_AGENT_SKILLS` (`@mch/seo`) stays the human/declarative doc;
 * here we normalise the historical drift `checkin`/`checkout`
 * (manifest) → `checkIn`/`checkOut` (route + booking domain contract).
 *
 * Each export is a Zod *raw shape* (a plain object of Zod types) so it
 * can be passed straight to `server.registerTool({ inputSchema })`.
 */

const locale = z.enum(['fr', 'en']).default('fr').describe('Locale — "fr" (default) or "en".');
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'expected YYYY-MM-DD')
  .describe('ISO date YYYY-MM-DD.');

export const emptyShape = {} as const;

export const searchShape = {
  destination: z.string().min(1).max(120).describe('City, region or normalised slug.'),
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  adults: z.number().int().min(1).max(6).optional(),
  children: z.number().int().min(0).max(4).optional(),
  locale,
  limit: z.number().int().min(1).max(10).default(5),
} as const;

export const hotelShape = {
  slug: z.string().min(1).max(120).describe('Kebab-case hotel slug.'),
  locale,
  body: z.enum(['short', 'long']).default('short'),
} as const;

export const hotelRoomShape = {
  hotelSlug: z.string().min(1).max(120),
  roomSlug: z.string().min(1).max(120),
  locale,
} as const;

export const rankingsListShape = {
  axe: z.enum(['type', 'lieu', 'theme', 'occasion', 'saison']).optional(),
  valeur: z.string().min(1).max(120).optional(),
  locale,
} as const;

export const rankingShape = {
  slug: z.string().min(1).max(120),
  locale,
} as const;

export const comparePricesShape = {
  hotelSlug: z.string().min(1).max(120),
  checkIn: dateString,
  checkOut: dateString,
  adults: z.number().int().min(1).max(6).default(2),
  locale,
} as const;

export const requestQuoteShape = {
  hotelSlug: z.string().min(1).max(120),
  checkIn: dateString,
  checkOut: dateString,
  adults: z.number().int().min(1).max(6).optional(),
  message: z.string().trim().max(1000).optional(),
  email: z.string().email().optional(),
  locale,
} as const;

export const bookingShape = {
  hotelSlug: z.string().min(1).max(120).optional(),
  locale,
} as const;

export const filterShape = {
  type: z.string().min(1).max(80).optional(),
  amenity: z.string().min(1).max(80).optional(),
  country: z.string().min(1).max(80).optional(),
  region: z.string().min(1).max(80).optional(),
  city: z.string().min(1).max(80).optional(),
} as const;

export const joinClubShape = {
  email: z.string().email().max(254),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  consentMarketing: z.boolean().optional(),
  locale,
} as const;

export const joinPrestigeShape = {
  locale,
} as const;

export const contactShape = {
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(4000),
  phone: z.string().min(5).max(40).optional(),
  locale,
} as const;

export const newsletterShape = {
  email: z.string().email().max(254),
  topics: z
    .array(z.enum(['palaces', 'guides', 'rankings', 'concierge-tips']))
    .max(4)
    .optional(),
  consent: z.literal(true),
  locale,
} as const;

export const countryGuideShape = {
  slug: z.string().min(1).max(80),
  locale,
} as const;

export const conciergeTipShape = {
  slug: z.string().min(1).max(120),
  locale,
} as const;

export const hotelSourcesShape = {
  slug: z.string().min(1).max(120),
  locale,
} as const;

export const itineraryShape = {
  slug: z.string().min(1).max(120),
  locale,
} as const;

export const itinerariesListShape = {
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/u)
    .optional(),
  destination_region: z.string().min(1).max(120).optional(),
  destination_city: z.string().min(1).max(120).optional(),
  theme: z.string().min(1).max(120).optional(),
  travel_style: z
    .enum([
      'luxe',
      'famille',
      'couple',
      'solo',
      'aventure',
      'bien-etre',
      'gastronomie',
      'culture',
      'affaires',
    ])
    .optional(),
  duration_min_days: z.number().int().min(1).max(60).optional(),
  duration_max_days: z.number().int().min(1).max(60).optional(),
  locale,
} as const;

export const directoryCountryShape = {
  pays: z.string().min(1).max(120),
  locale,
} as const;

export const directoryCityShape = {
  pays: z.string().min(1).max(120),
  ville: z.string().min(1).max(120),
  locale,
} as const;
