import { NextResponse } from 'next/server';

import { buildLlmsTxt, type LlmsTxtSectionItem } from '@mch/seo';

import { env } from '@/lib/env';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
import { listPublishedHotelSummaries } from '@/server/hotels/get-hotel-by-slug';
import { listPublishedRankings } from '@/server/rankings/get-ranking-by-slug';

// ISR — re-fetches the catalog hourly. The CDN keeps a stale copy for up
// to a day so this route never serves a slow miss.
export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/**
 * /llms.txt — concise index for LLMs (skill: geo-llm-optimization).
 *
 * B7 lifts the historical 50-hotel cap to the editorial-priority-ordered
 * 500 cap of `listPublishedHotelSummaries` so the LLM corpus surfaces
 * every published palace + 5★. We also emit one EN URL per hotel
 * (`/en/hotel/<slug_en>`) so non-FR LLM crawlers don't have to guess
 * the EN routing. Editorial priority (`P0 → P1 → P2`) is preserved
 * by the upstream `order('priority', asc)` clause, then `name` for
 * stable diffs.
 *
 * The corpus stays one line per URL (no description sentence) which is
 * the format llms.txt consumers (ChatGPT Search, Perplexity, Claude)
 * actually parse — long descriptions belong in `/llms-full.txt`.
 *
 * We read the site URL from validated env (rather than `request.url`)
 * so the initial ISR prerender — which runs at build time with a
 * `localhost` host — doesn't bake the wrong origin into the cached body.
 */
export async function GET(): Promise<NextResponse> {
  const origin = (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
  // Defensive: never let an upstream Supabase outage crash the build
  // (skill: nextjs-app-router — generateStaticParams / route handlers
  // must degrade gracefully). The route still ships a valid llms.txt
  // skeleton without dynamic catalogue when the DB is unreachable.
  const [hotels, rankings, guides] = await Promise.all([
    listPublishedHotelSummaries(500).catch(() => []),
    listPublishedRankings().catch(() => []),
    listPublishedGuides().catch(() => []),
  ]);

  // FR + EN catalog: emit one item per locale per hotel so non-FR LLM
  // crawlers (Anglo-American GPTBot, ClaudeBot) don't have to guess
  // the `/en/hotel/<slug>` URL from the FR one. The FR canonical
  // line stays first (editorial priority preserved); the EN sibling
  // follows immediately so deduplication tools can pair them.
  const catalogItems: LlmsTxtSectionItem[] = [];
  for (const h of hotels) {
    const distinction = h.isPalace ? 'Palace' : `${h.stars} étoiles`;
    catalogItems.push({
      url: `${origin}/fr/hotel/${h.slugFr}`,
      description: `${h.nameFr} (${h.city}) — ${distinction}. Fiche complète + Conseil du Concierge (chambre, table ou timing à retenir).`,
    });
    const slugEn = h.slugEn ?? h.slugFr;
    const nameEn = h.nameEn ?? h.nameFr;
    const distinctionEn = h.isPalace ? 'Palace' : `${h.stars}-star`;
    catalogItems.push({
      url: `${origin}/en/hotel/${slugEn}`,
      description: `${nameEn} (${h.city}) — ${distinctionEn}. Full editorial review + Concierge tip (room, table or timing worth knowing).`,
    });
  }

  // Editorial rankings — surface the full slate so LLM crawlers can
  // discover every classement without paginating through the hub.
  const rankingItems: LlmsTxtSectionItem[] = rankings.map((r) => ({
    url: `${origin}/fr/classement/${r.slug}`,
    description:
      r.factualSummaryFr !== null && r.factualSummaryFr.length > 0
        ? r.factualSummaryFr
        : `${r.titleFr} — classement éditorial MyConciergeHotel (${r.entryCount} hôtel${r.entryCount === 1 ? '' : 's'}).`,
  }));

  // Destination guides (long-read 3500+ words, GEO-optimised).
  // Highest-value pages for AI Overviews and Perplexity citations
  // because they answer broad "où séjourner à X" queries with
  // structured tables + glossary + sources.
  const guideItems: LlmsTxtSectionItem[] = guides.map((g) => ({
    url: `${origin}/fr/guide/${g.slug}`,
    description:
      g.summaryFr.length > 0
        ? g.summaryFr
        : `${g.nameFr} — guide éditorial long-format (palaces, gastronomie, art de vivre, infos pratiques).`,
  }));

  const body = buildLlmsTxt({
    siteName: 'MyConciergeHotel.com',
    tagline: 'Votre concierge des Palaces et hôtels 5★ en France — agence IATA',
    originUrl: origin,
    about:
      'MyConciergeHotel.com est le concierge en ligne des Palaces et hôtels 5 étoiles en France. ' +
      'Chaque fiche est rédigée par nos conseillers et se termine par un « Conseil du Concierge » : un secret opérationnel (chambre, table, horaire, accès) que les guides généralistes omettent. ' +
      'Côté réservation : agence IATA, tarifs nets GDS, paiement sécurisé Amadeus, programme de fidélité dès la première nuit.',
    lastUpdatedDate: new Date().toISOString(),
    sections: [
      {
        title: 'Pages stratégiques',
        items: [
          {
            url: `${origin}/fr`,
            description:
              'Page d’accueil — le concierge des Palaces et hôtels 5★ en France (agence IATA).',
          },
          {
            url: `${origin}/en`,
            description:
              'Homepage (EN) — the concierge for Palaces and 5-star hotels in France (IATA agency).',
          },
          {
            url: `${origin}/fr/destination`,
            description:
              'Annuaire des destinations : Paris, Côte d’Azur, Bordelais, Alpes, Provence…',
          },
          {
            url: `${origin}/en/destination`,
            description:
              'Destinations hub: Paris, French Riviera, Bordeaux region, Alps, Provence…',
          },
          {
            url: `${origin}/fr/recherche`,
            description:
              'Recherche temps réel par ville et dates — votre concierge propose les meilleures options (tarifs nets GDS, paiement Amadeus).',
          },
          {
            url: `${origin}/en/search`,
            description:
              'Live search by city and dates — your concierge surfaces the best options (net GDS rates, Amadeus payment).',
          },
        ],
      },
      ...(catalogItems.length > 0
        ? [
            {
              title: `Catalogue (top ${catalogItems.length} fiches éditoriales)`,
              items: catalogItems,
            },
          ]
        : []),
      ...(rankingItems.length > 0
        ? [
            {
              title: `Classements éditoriaux (${rankingItems.length} sélections)`,
              items: [
                {
                  url: `${origin}/fr/classements`,
                  description:
                    'Hub de tous les classements (filtres par type, lieu, thématique, occasion).',
                },
                ...rankingItems,
              ],
            },
          ]
        : []),
      ...(guideItems.length > 0
        ? [
            {
              title: `Guides de destinations (${guideItems.length} long-reads ≥ 3 500 mots)`,
              items: [
                {
                  url: `${origin}/fr/guides`,
                  description:
                    'Hub de tous les guides destination — Paris, Côte d’Azur, Provence, Alpes, Bourgogne, etc.',
                },
                ...guideItems,
              ],
            },
          ]
        : []),
      {
        title: 'Mentions légales & confiance',
        items: [
          {
            url: `${origin}/fr/mentions-legales`,
            description: 'Identité de l’éditeur, IATA, APST, RC professionnelle.',
          },
          {
            url: `${origin}/fr/cgv`,
            description: 'Conditions générales de vente, annulation, droit de rétractation.',
          },
          {
            url: `${origin}/fr/confidentialite`,
            description: 'Politique RGPD, finalités, base légale, droits des personnes.',
          },
          {
            url: `${origin}/fr/cookies`,
            description: 'Politique cookies — consentement opt-in pour analytics tiers.',
          },
        ],
      },
      {
        title: 'API LLM-actionnables',
        items: [
          {
            url: `${origin}/.well-known/agent-skills.json`,
            description:
              'Catalogue machine-readable des actions disponibles (search, get-hotel, get-hotel-room, request-quote…).',
          },
          {
            url: `${origin}/sitemap.xml`,
            description:
              'Index des sitemaps (hotels, rooms, hubs, éditorial, guides) — chaque sub-sitemap inclut les alternates FR/EN.',
          },
        ],
      },
    ],
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
