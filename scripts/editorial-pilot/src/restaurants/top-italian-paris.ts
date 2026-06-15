/**
 * top-italian-paris.ts — one-off query: top Italian restaurants in Paris.
 *
 * Uses Google Places (New) Text Search to gather Italian restaurants in
 * Paris, then ranks them by price level (most expensive first) and
 * review quality (rating × log(reviewCount)). Prints the top N.
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx src/restaurants/top-italian-paris.ts
 *   ... --top=10 --json
 */
import { loadPhotoEnv } from '../photos/env-photos.js';

const API_BASE = 'https://places.googleapis.com/v1';

const PRICE_LEVEL_RANK: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const PRICE_LEVEL_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Gratuit',
  PRICE_LEVEL_INEXPENSIVE: '€',
  PRICE_LEVEL_MODERATE: '€€',
  PRICE_LEVEL_EXPENSIVE: '€€€',
  PRICE_LEVEL_VERY_EXPENSIVE: '€€€€',
};

interface PlaceRow {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  priceRange?: {
    startPrice?: { units?: string; currencyCode?: string };
    endPrice?: { units?: string; currencyCode?: string };
  };
  googleMapsUri?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
}

interface TextSearchResponse {
  places?: PlaceRow[];
  nextPageToken?: string;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.priceRange',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.primaryTypeDisplayName',
  'places.editorialSummary',
  'nextPageToken',
].join(',');

async function searchPage(
  apiKey: string,
  textQuery: string,
  pageToken: string | undefined,
): Promise<TextSearchResponse> {
  const body: Record<string, unknown> = {
    textQuery,
    languageCode: 'fr',
    regionCode: 'FR',
    includedType: 'italian_restaurant',
    // Bias toward the most expensive segment but keep some headroom.
    priceLevels: ['PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE', 'PRICE_LEVEL_MODERATE'],
    pageSize: 20,
  };
  if (pageToken !== undefined) body.pageToken = pageToken;

  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places searchText ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as TextSearchResponse;
}

function reviewScore(row: PlaceRow): number {
  const rating = row.rating ?? 0;
  const count = row.userRatingCount ?? 0;
  // Bayesian-ish: rating weighted by confidence (log of review volume).
  return rating * Math.log10(count + 1);
}

function priceRangeLabel(row: PlaceRow): string | null {
  const r = row.priceRange;
  if (r === undefined) return null;
  const s = r.startPrice?.units;
  const e = r.endPrice?.units;
  const cur = r.startPrice?.currencyCode ?? r.endPrice?.currencyCode ?? 'EUR';
  if (s !== undefined && e !== undefined) return `${s}–${e} ${cur}`;
  if (s !== undefined) return `≥ ${s} ${cur}`;
  if (e !== undefined) return `≤ ${e} ${cur}`;
  return null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const top = Number(argv.find((a) => a.startsWith('--top='))?.slice('--top='.length) ?? '10');
  const asJson = argv.includes('--json');

  const env = loadPhotoEnv();
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (apiKey === undefined) {
    throw new Error('GOOGLE_PLACES_API_KEY missing — add it to .env.local at the monorepo root.');
  }

  // Several queries to widen the pool (the API caps a single query at ~60
  // results across 3 pages and skews toward central arrondissements).
  const queries = [
    'restaurant italien gastronomique Paris',
    'meilleur restaurant italien Paris',
    'restaurant italien haut de gamme Paris',
  ];

  const byId = new Map<string, PlaceRow>();
  for (const q of queries) {
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page += 1) {
      // eslint-disable-next-line no-await-in-loop -- pagination is inherently sequential
      const resp = await searchPage(apiKey, q, pageToken);
      for (const p of resp.places ?? []) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
      if (resp.nextPageToken === undefined) break;
      pageToken = resp.nextPageToken;
      // Google needs a brief moment before a page token becomes valid.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const all = [...byId.values()];

  // Keep places with at least some reviews and a known (expensive) price.
  const ranked = all
    .filter((r) => (r.userRatingCount ?? 0) >= 50)
    .sort((a, b) => {
      const pa = PRICE_LEVEL_RANK[a.priceLevel ?? ''] ?? -1;
      const pb = PRICE_LEVEL_RANK[b.priceLevel ?? ''] ?? -1;
      if (pb !== pa) return pb - pa; // most expensive first
      return reviewScore(b) - reviewScore(a); // then best reviews
    });

  const result = ranked.slice(0, top).map((r, i) => ({
    rank: i + 1,
    name: r.displayName?.text ?? '(sans nom)',
    priceLevel: PRICE_LEVEL_LABEL[r.priceLevel ?? ''] ?? '—',
    priceRange: priceRangeLabel(r),
    rating: r.rating ?? null,
    reviews: r.userRatingCount ?? 0,
    address: r.formattedAddress ?? null,
    type: r.primaryTypeDisplayName?.text ?? null,
    summary: r.editorialSummary?.text ?? null,
    website: r.websiteUri ?? null,
    maps: r.googleMapsUri ?? null,
    placeId: r.id,
  }));

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\nPool collecté: ${all.length} restaurants italiens (Paris)`);
  console.log(`Top ${result.length} — classés par prix décroissant puis qualité des avis\n`);
  for (const r of result) {
    console.log(
      `${String(r.rank).padStart(2)}. ${r.name}  ${r.priceLevel}` +
        `${r.priceRange ? ` (${r.priceRange})` : ''}`,
    );
    console.log(
      `    ⭐ ${r.rating ?? '—'}/5 sur ${r.reviews.toLocaleString('fr-FR')} avis` +
        `${r.type ? ` · ${r.type}` : ''}`,
    );
    if (r.address) console.log(`    📍 ${r.address}`);
    if (r.summary) console.log(`    “${r.summary}”`);
    if (r.maps) console.log(`    🔗 ${r.maps}`);
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
