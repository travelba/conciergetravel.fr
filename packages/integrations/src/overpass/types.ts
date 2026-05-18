/**
 * Overpass API types (skill: api-integration).
 *
 * Overpass is a read-only HTTP API that lets us query the OpenStreetMap
 * database. Free, no key, no auth.
 *
 * Endpoint: https://overpass-api.de/api/interpreter
 * Docs:     https://wiki.openstreetmap.org/wiki/Overpass_API
 * Tags ref: https://wiki.openstreetmap.org/wiki/Map_features
 *
 * We use Overpass for ONE thing: locate "daily-life" amenities around
 * a hotel that DATAtourisme does NOT cover well — pharmacies,
 * bakeries, supermarkets, ATMs, post offices, taxis, clinics, etc.
 *
 * DATAtourisme is the official French tourism dataset (EDT vocabulary);
 * its strength is patrimony, culture and gastronomy. It barely
 * references daily commerce — that's OSM territory.
 */

import { z } from 'zod';

/**
 * The seven amenity tags we surface in the "Commerces utiles" bucket
 * on the hotel detail page. Each maps to a Schema.org `additionalType`
 * for JSON-LD emission (see `packages/seo/jsonld/place-amenity.ts`).
 *
 * We deliberately keep this list short — long lists dilute the
 * editorial value and overwhelm tourists. Hotel concierges report
 * these 7 categories as the most-asked-about ones.
 */
export const UTILITY_AMENITY_TAGS = [
  'pharmacy',
  'bakery',
  'supermarket',
  'atm',
  'post_office',
  'taxi',
  'clinic',
] as const;

export type UtilityAmenityTag = (typeof UTILITY_AMENITY_TAGS)[number];

/**
 * Overpass returns elements with either lat/lon (node) or center
 * (way/relation centroid when using `out center`). We normalise both.
 */
const OverpassElementSchema = z
  .object({
    type: z.enum(['node', 'way', 'relation']),
    id: z.number(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
    tags: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const OverpassResponseSchema = z
  .object({
    version: z.number().optional(),
    generator: z.string().optional(),
    elements: z.array(OverpassElementSchema),
  })
  .passthrough();

export type OverpassElement = z.infer<typeof OverpassElementSchema>;
export type OverpassResponse = z.infer<typeof OverpassResponseSchema>;

/**
 * The normalised shape consumed by the orchestrator. Everything beyond
 * `tag` + `name` + `lat` + `lon` is optional because OSM contributors
 * tag inconsistently — a rural pharmacie may only have `name` +
 * `amenity=pharmacy`, while a Parisian one might have a dozen tags.
 *
 * `distanceMeters` is filled by the client (Overpass returns absolute
 * coords, we compute the haversine distance to the hotel).
 */
export const NormalisedOsmAmenitySchema = z.object({
  osmType: z.enum(['node', 'way', 'relation']),
  osmId: z.number(),
  tag: z.enum(UTILITY_AMENITY_TAGS),
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number().int().nonnegative(),
  /** Street + house number when both present, otherwise just the street. */
  streetAddress: z.string().min(1).optional(),
  /** OSM `opening_hours` tag — raw string, e.g. `Mo-Sa 09:00-19:30`. */
  openingHours: z.string().min(1).optional(),
  /** International format (E.164) when available, otherwise raw. */
  phone: z.string().min(1).optional(),
  website: z.string().url().optional(),
  /** Branded chain name (e.g. `Monoprix`, `Carrefour Express`). */
  brand: z.string().min(1).optional(),
});

export type NormalisedOsmAmenity = z.infer<typeof NormalisedOsmAmenitySchema>;
