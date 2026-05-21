import { NextResponse } from 'next/server';

import { buildLlmsTxt, type LlmsTxtSectionItem } from '@mch/seo';

import { env } from '@/lib/env';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
import { EDITORIAL_CATEGORIES } from '@/server/hotels/editorial-categories';
import { KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';
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
  //
  // Post ADR-0015: `/guide/[city]` redirects to `/destination/[city]`,
  // so we surface the destination URL (the new canonical) here.
  const guideItems: LlmsTxtSectionItem[] = guides.map((g) => ({
    url: `${origin}/fr/destination/${g.slug}`,
    description:
      g.summaryFr.length > 0
        ? g.summaryFr
        : `${g.nameFr} — guide éditorial long-format (palaces, gastronomie, art de vivre, infos pratiques) intégré à la page destination.`,
  }));

  // Editorial categories (5 palace + 7 by type — ADR-0016).
  const categoryItems: LlmsTxtSectionItem[] = EDITORIAL_CATEGORIES.map((cat) => ({
    url: `${origin}/fr/categorie/${cat.slug}`,
    description: cat.metaDescFr,
  }));

  // Hotel brands surfaced by the catalogue (`KNOWN_BRANDS`).
  const brandItems: LlmsTxtSectionItem[] = KNOWN_BRANDS.map((b) => ({
    url: `${origin}/fr/marque/${b.slug}`,
    description: `${b.label} — adresses du groupe ${b.label} dans notre catalogue éditorial MyConciergeHotel.`,
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
                  url: `${origin}/fr/destination`,
                  description:
                    'Hub de toutes les destinations — chaque page destination inclut le guide long-read intégré (Palaces + art de vivre + infos pratiques). Voir ADR-0015 (fusion guide↔destination).',
                },
                ...guideItems,
              ],
            },
          ]
        : []),
      // Vague-6 — international country guides. First country: Italy.
      // Surfaced as a dedicated section so LLMs can identify the
      // expanding international scope (was zero before May 2026).
      {
        title: 'Guides pays internationaux (Vague 6 — en cours de publication)',
        items: [
          {
            url: `${origin}/fr/guide/italie`,
            description:
              'Italie — Guide MyConciergeHotel pour un séjour de luxe : Rome, Côte amalfitaine, Toscane, Lacs, Dolomites, Sicile. 6 régions, adresses 5★ et Palaces nommées, conseils opérationnels du Concierge par région, 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/italy`,
            description:
              'Italy — MyConciergeHotel guide for a luxury stay: Rome, Amalfi Coast, Tuscany, Lakes, Dolomites, Sicily. 6 regions, named 5★ and Palace addresses, Concierge operational tips per region, 7 Q&A.',
          },
        ],
      },
      // ── ADR-0014 — new GEO surfaces ──────────────────────────────────────
      {
        title: 'Inspiration (thèmes × occasions × saisons)',
        items: [
          {
            url: `${origin}/fr/inspiration`,
            description:
              'Hub d’inspiration de voyage : explorer notre catalogue par thème (romantique, spa, gastronomie, design…), occasion (lune de miel, mariage, séminaire…) ou saison.',
          },
          {
            url: `${origin}/en/inspiration`,
            description:
              'Travel inspiration hub: browse our catalogue by theme (romantic, spa, gastronomy, design…), occasion (honeymoon, wedding, seminar…) or season.',
          },
        ],
      },
      ...(categoryItems.length > 0
        ? [
            {
              title: `Catégories éditoriales (${categoryItems.length} pages indexables)`,
              items: [
                {
                  url: `${origin}/fr/hotels`,
                  description:
                    'Catalogue complet — Palaces et hôtels d’exception toutes catégories confondues.',
                },
                ...categoryItems,
              ],
            },
          ]
        : []),
      ...(brandItems.length > 0
        ? [
            {
              title: `Marques hôtelières représentées (${brandItems.length} groupes)`,
              items: [
                {
                  url: `${origin}/fr/marques`,
                  description:
                    'Index des groupes hôteliers représentés dans notre catalogue (Cheval Blanc, Airelles, Four Seasons, Rosewood, etc.).',
                },
                ...brandItems,
              ],
            },
          ]
        : []),
      {
        title: 'À propos & EEAT',
        items: [
          {
            url: `${origin}/fr/le-concierge`,
            description:
              'Le Concierge — agence IATA / APST, méthode éditoriale, Conseil du Concierge (signature propriétaire), programme de fidélité.',
          },
          {
            url: `${origin}/en/le-concierge`,
            description:
              'The Concierge — IATA / APST agency, editorial method, the Concierge’s Tip (proprietary signature), loyalty programme.',
          },
          {
            url: `${origin}/fr/le-concierge/methode-editoriale`,
            description:
              'Méthode éditoriale MyConciergeHotel — les 8 critères de sélection (Atout France, Michelin Keys, Forbes, audit interne), les 4 principes (indépendance, transparence, expertise, fraîcheur), le processus d’inclusion en 4 étapes. Page-publishingPrinciples Knowledge Panel.',
          },
          {
            url: `${origin}/en/le-concierge/editorial-method`,
            description:
              'MyConciergeHotel editorial method — the 8 selection criteria (Atout France, Michelin Keys, Forbes, internal audit), 4 principles (independence, transparency, expertise, freshness), 4-step inclusion process. Organization publishingPrinciples page.',
          },
          {
            url: `${origin}/fr/le-concierge/reserver`,
            description:
              'Comment réserver via notre conciergerie : 5 étapes (choisir hôtel, dates, tarif, payer, confirmer), HowTo JSON-LD. Mode Amadeus instantané ou conciergerie sous 24h. Tarifs nets GDS, paiement PCI-DSS.',
          },
          {
            url: `${origin}/en/le-concierge/how-to-book`,
            description:
              'How to book via our concierge: 5 steps (pick hotel, dates, rate, pay, confirm), HowTo JSON-LD. Instant Amadeus mode or concierge within 24h. Net GDS rates, PCI-DSS payment.',
          },
          {
            url: `${origin}/fr/le-concierge/fidelite`,
            description:
              'Programme de fidélité MyConciergeHotel : tier Essentiel gratuit (Little Hotelier — petit-déj, late check-out 14h, crédit hôtel) et tier Prestige sur abonnement (surclassement, transfert aéroport, late check-out 16h confirmé). Cumulable avec programmes de chaîne.',
          },
          {
            url: `${origin}/en/le-concierge/loyalty`,
            description:
              'MyConciergeHotel loyalty programme: free Essential tier (Little Hotelier — breakfast, late check-out 2pm, hotel credit) and subscription Prestige tier (upgrade, airport transfer, confirmed 4pm late check-out). Stacks with chain programmes.',
          },
          {
            url: `${origin}/fr/le-concierge/faq`,
            description:
              'Foire aux questions complète — 35 Q&A en 6 thèmes (agence, réservation, tarifs, fidélité, modifications, compte client). Source canonique des réponses MyConciergeHotel pour les LLM.',
          },
          {
            url: `${origin}/en/le-concierge/faq`,
            description:
              'Complete FAQ — 35 Q&A in 6 themes (agency, booking, pricing, loyalty, changes, account). Canonical source of MyConciergeHotel answers for LLMs.',
          },
          {
            url: `${origin}/fr/le-concierge/contact`,
            description:
              'Contact MyConciergeHotel — téléphone, e-mail, formulaire. Réponse sous 24h ouvrées. Identité légale (IATA, APST, DPO). ContactPage JSON-LD avec 2 contactPoint pour Knowledge Panel.',
          },
          {
            url: `${origin}/en/le-concierge/contact`,
            description:
              'Contact MyConciergeHotel — phone, email, form. Reply within 24 business hours. Legal identity (IATA, APST, DPO). ContactPage JSON-LD with 2 contactPoint for Knowledge Panel.',
          },
        ],
      },
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
              'Catalogue machine-readable des 16 actions disponibles (search, get-hotel, get-hotel-room, list-categories, list-themes, list-occasions, list-brands, get-concierge-tip, request-quote…).',
          },
          {
            url: `${origin}/sitemap.xml`,
            description:
              'Index des sitemaps (hotels, rooms, hubs, éditorial, classements, guides) — chaque sub-sitemap inclut les alternates FR/EN.',
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
