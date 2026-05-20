import { NextResponse } from 'next/server';

import { buildLlmsFullHotelPages, buildLlmsFullTxt, type LlmsFullTxtPage } from '@mch/seo';

import { listIndexableHotelsForLlms } from '@/server/hotels/list-indexable-for-llms';

/**
 * /llms-full.txt — verbose LLM ingestion file (skill: geo-llm-optimization).
 *
 * Dynamic since B6: pulls every indexable hotel from Supabase via
 * `listIndexableHotelsForLlms` and emits one FR + one EN markdown
 * section per hotel (canonical URL, factual summary, key facts). The
 * editorial preamble (`L'agence`, `Programme de fidélité`) stays in
 * code so the corpus reads coherently even when the DB is empty.
 *
 * Caching: `force-static` + `revalidate = 3600`. Cold start hits
 * Supabase once per hour; warm revalidations are served from the
 * Vercel data cache. The Supabase reader caps the result at 500 rows
 * (~2.5 MB max output, well under Vercel route-handler limits).
 */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET(request: Request): Promise<NextResponse> {
  const origin = new URL(request.url).origin;

  // Editorial preamble — keeps the LLM corpus coherent even when
  // Supabase is unreachable. Same shape as the legacy `pages` list.
  const editorialPages: LlmsFullTxtPage[] = [
    {
      url: `${origin}/agence/`,
      title: "L'agence",
      summary:
        'MyConciergeHotel.com est une agence française accréditée IATA et membre ASPST. ' +
        'Garantie financière APST. Conseillers francophones, paiement sécurisé Amadeus.',
      keyFacts: [
        'Accréditation IATA',
        'Membre ASPST',
        'Garantie financière APST',
        'Paiement sécurisé Amadeus',
      ],
    },
    {
      url: `${origin}/programme-fidelite/`,
      title: 'Programme de fidélité',
      summary:
        'Programme de fidélité MyConciergeHotel avec deux tiers : Essentiel (gratuit, dès la première nuit, ' +
        'avantages variables selon hôtel partenaire) et Prestige (payant, avantages renforcés).',
      keyFacts: [
        'Tier Essentiel automatique',
        'Tier Prestige sur abonnement',
        'Bénéfices : petit-déjeuner offert, late check-out, crédit hôtel selon hôtels Little Hotelier',
      ],
    },
  ];

  // Dynamic hotel pages from Supabase (FR + EN per hotel — capped at
  // 500 rows × 2 locales = max 1000 sections, ~5 MB upper-bound).
  const hotels = await listIndexableHotelsForLlms();
  const hotelPages: LlmsFullTxtPage[] = [];
  for (const hotel of hotels) {
    for (const page of buildLlmsFullHotelPages(hotel, origin)) {
      hotelPages.push(page);
    }
  }

  const body = buildLlmsFullTxt({
    siteName: 'MyConciergeHotel.com',
    tagline: 'Agence IATA Hôtels 5★ & Palaces France',
    originUrl: origin,
    about:
      "MyConciergeHotel.com est l'agence de voyage IATA spécialisée dans les hôtels 5 étoiles et Palaces en France. " +
      'Tarifs nets GDS, paiement sécurisé Amadeus, programme de fidélité dès la première nuit.',
    lastUpdatedDate: new Date().toISOString(),
    pages: [...editorialPages, ...hotelPages],
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
