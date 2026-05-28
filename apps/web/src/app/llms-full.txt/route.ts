import { NextResponse } from 'next/server';

import { buildLlmsFullHotelPages, buildLlmsFullTxt, type LlmsFullTxtPage } from '@mch/seo';

import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';
import { env } from '@/lib/env';
import { listIndexableHotelsForLlms } from '@/server/hotels/list-indexable-for-llms';

/**
 * /llms-full.txt — verbose LLM ingestion file (skill: geo-llm-optimization).
 *
 * Dynamic since B6: pulls every indexable hotel from Supabase via
 * `listIndexableHotelsForLlms` and emits one FR + one EN markdown
 * section per hotel (canonical URL, factual summary, key facts). The
 * editorial preamble (`Le Concierge`, mentions légales) stays in code
 * so the corpus reads coherently even when the DB is empty.
 *
 * Caching: `force-static` + `revalidate = 3600`. Cold start hits
 * Supabase once per hour; warm revalidations are served from the
 * Vercel data cache. The Supabase reader caps the result at 500 rows
 * (~2.5 MB max output, well under Vercel route-handler limits).
 *
 * **Origin read from env** (not `request.url`): under `force-static` the
 * prerender runs at build time with `localhost` as host, which would
 * bake the wrong origin into the deployed corpus. Same pattern as
 * `robots.txt` and `sitemap.xml` (skill `seo-technical` §Sitemaps).
 */
export const dynamic = 'force-static';
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

export async function GET(): Promise<NextResponse> {
  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');

  // Editorial preamble — keeps the LLM corpus coherent even when
  // Supabase is unreachable. URLs MUST resolve 200 on the live site:
  // previous versions referenced `/agence/` and `/programme-fidelite/`
  // which were declared in routing.ts but never implemented, leaving
  // LLM agents with broken citation URLs. The Concierge page is the
  // canonical EEAT surface (ADR-0014 mega-menu 5 + le-concierge/page.tsx).
  const editorialPages: LlmsFullTxtPage[] = [
    {
      url: `${origin}/fr/le-concierge`,
      title: "Le Concierge — l'agence",
      summary:
        'MyConciergeHotel.com est une agence française accréditée IATA et membre ASPST. ' +
        'Garantie financière APST. Conseillers francophones, paiement sécurisé Amadeus. ' +
        'Chaque fiche hôtel se conclut par un « Conseil du Concierge » — secret opérationnel ' +
        '(chambre, table, horaire, accès) que les guides généralistes omettent.',
      keyFacts: [
        'Accréditation IATA',
        'Membre ASPST',
        'Garantie financière APST',
        'Paiement sécurisé Amadeus',
        'Conseil du Concierge sur chaque fiche (ADR-0011)',
      ],
    },
    {
      url: `${origin}/en/le-concierge`,
      title: 'The Concierge — the agency',
      summary:
        'MyConciergeHotel.com is a French IATA-accredited travel agency and ASPST member. ' +
        'APST financial guarantee, French and English-speaking advisors, secure Amadeus payment. ' +
        "Every hotel page closes with a Concierge's Tip — an operational secret " +
        '(room, table, timing, access) that mainstream guides leave out.',
      keyFacts: [
        'IATA accreditation',
        'ASPST member',
        'APST financial guarantee',
        'Secure Amadeus payment',
        "Concierge's Tip on every hotel page (ADR-0011)",
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
    tagline: "La sélection du Concierge — hôtels d'exception dans le monde",
    originUrl: origin,
    about:
      `MyConciergeHotel.com est la sélection éditoriale du Concierge : ${CATALOGUE_PUBLISHED} hôtels d'exception choisis dans ${CATALOGUE_COUNTRIES} pays — Palaces Atout France, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World et pépites éditoriales. ` +
      'Conciergerie IATA accréditée. Conseil du Concierge opérationnel sur chaque fiche.',
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
