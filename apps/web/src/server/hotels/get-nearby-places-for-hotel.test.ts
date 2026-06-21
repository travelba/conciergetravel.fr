import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit coverage for the hotel → "lieux à proximité" reader. The pure
 * logic under test (haversine distance, closest-first sort, limit,
 * published-only + dedup filtering, links-before-geo precedence) is
 * private and coupled to the Supabase client, so we drive it through
 * the public `getNearbyPlacesForHotel` with a minimal in-memory client
 * that returns canned PostgREST-shaped rows per table — no network.
 */

interface SupaResult {
  readonly data: unknown;
  readonly error: unknown;
}

/** Chainable thenable mimicking the subset of the query builder used here. */
class QueryBuilder implements PromiseLike<SupaResult> {
  constructor(private readonly result: SupaResult) {}
  select(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  order(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  then<TResult1 = SupaResult, TResult2 = never>(
    onfulfilled?: ((value: SupaResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

interface ClientLike {
  from(table: string): QueryBuilder;
}

const holder = vi.hoisted<{ byTable: Map<string, SupaResult>; throwOnFrom: boolean }>(() => ({
  byTable: new Map<string, SupaResult>(),
  throwOnFrom: false,
}));

vi.mock('@/lib/supabase/admin', () => {
  const client: ClientLike = {
    from(table: string): QueryBuilder {
      if (holder.throwOnFrom) throw new Error('supabase unavailable');
      return new QueryBuilder(holder.byTable.get(table) ?? { data: [], error: null });
    },
  };
  return { getSupabaseAdminClient: () => client };
});

import { getNearbyPlacesForHotel } from './get-nearby-places-for-hotel';

function setTable(table: string, result: SupaResult): void {
  holder.byTable.set(table, result);
}

function linkRow(
  slug: string,
  distanceMeters: number,
  opts: { walkMinutes?: number; isPublished?: boolean } = {},
): unknown {
  return {
    distance_meters: distanceMeters,
    walk_minutes: opts.walkMinutes ?? null,
    places: {
      slug,
      slug_en: `${slug}-en`,
      city_key: 'paris',
      bucket: 'visit',
      kind: 'museum',
      name: slug,
      name_en: `${slug} EN`,
      factual_summary_fr: 'fr',
      factual_summary_en: 'en',
      hero_image: null,
      is_published: opts.isPublished ?? true,
    },
  };
}

function geoRow(slug: string, latitude: number, longitude: number): unknown {
  return {
    slug,
    slug_en: null,
    city_key: 'paris',
    bucket: 'visit',
    kind: 'museum',
    name: slug,
    name_en: null,
    factual_summary_fr: null,
    factual_summary_en: null,
    hero_image: null,
    latitude,
    longitude,
  };
}

describe('getNearbyPlacesForHotel', () => {
  beforeEach(() => {
    holder.byTable.clear();
    holder.throwOnFrom = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers curated place_hotel_links and reports source=links', async () => {
    setTable('place_hotel_links', {
      data: [linkRow('musee-1', 120, { walkMinutes: 2 }), linkRow('musee-2', 400)],
      error: null,
    });

    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: 'paris',
      latitude: 48.85,
      longitude: 2.35,
    });

    expect(res.source).toBe('links');
    expect(res.items.map((i) => i.slug)).toEqual(['musee-1', 'musee-2']);
    expect(res.items[0]?.distanceMeters).toBe(120);
    expect(res.items[0]?.walkMinutes).toBe(2);
    expect(res.items[0]?.slugEn).toBe('musee-1-en');
  });

  it('skips unpublished and de-duplicates linked places', async () => {
    setTable('place_hotel_links', {
      data: [
        linkRow('musee-1', 100),
        linkRow('musee-1', 150), // duplicate slug, farther
        linkRow('secret', 200, { isPublished: false }), // unpublished
      ],
      error: null,
    });

    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: 'paris',
      latitude: 48.85,
      longitude: 2.35,
    });

    expect(res.items.map((i) => i.slug)).toEqual(['musee-1']);
  });

  it('falls back to geo distance, sorts closest-first and respects the limit', async () => {
    setTable('place_hotel_links', { data: [], error: null });
    setTable('places', {
      data: [
        geoRow('far', 48.88, 2.39), // ~3 km
        geoRow('near', 48.857, 2.353), // ~50 m
        geoRow('mid', 48.866, 2.34), // ~1.4 km
      ],
      error: null,
    });

    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: 'paris',
      latitude: 48.8566,
      longitude: 2.3522,
      limit: 2,
    });

    expect(res.source).toBe('geo');
    expect(res.items).toHaveLength(2);
    expect(res.items.map((i) => i.slug)).toEqual(['near', 'mid']);
    // Closest is within a few hundred metres; farthest of the two beyond a km.
    const near = res.items[0]?.distanceMeters ?? Number.POSITIVE_INFINITY;
    expect(near).toBeLessThan(300);
    expect(res.items[0]?.walkMinutes).toBeNull();
  });

  it('drops geo rows missing coordinates', async () => {
    setTable('place_hotel_links', { data: [], error: null });
    setTable('places', {
      data: [geoRow('with-coords', 48.857, 2.353), geoRow('no-coords', 48.857, 2.353)],
      error: null,
    });
    // Null out the second row's coordinates.
    const places = holder.byTable.get('places');
    const rows = Array.isArray(places?.data) ? places.data : [];
    const second = rows[1];
    if (second !== null && typeof second === 'object') {
      Object.assign(second, { latitude: null, longitude: null });
    }

    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: 'paris',
      latitude: 48.8566,
      longitude: 2.3522,
    });

    expect(res.items.map((i) => i.slug)).toEqual(['with-coords']);
  });

  it('returns an empty result when no links and geo fallback is not possible', async () => {
    setTable('place_hotel_links', { data: [], error: null });

    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: null,
      latitude: null,
      longitude: null,
    });

    expect(res).toEqual({ items: [], source: 'none' });
  });

  it('degrades to an empty result when the client throws', async () => {
    holder.throwOnFrom = true;
    const res = await getNearbyPlacesForHotel({
      hotelId: 'h1',
      citySlug: 'paris',
      latitude: 48.85,
      longitude: 2.35,
    });
    expect(res).toEqual({ items: [], source: 'none' });
  });
});
