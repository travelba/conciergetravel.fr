import { NextResponse } from 'next/server';

import { buildLlmsTxt, type LlmsTxtSectionItem } from '@mch/seo';

import { env } from '@/lib/env';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';
import { EDITORIAL_CATEGORIES } from '@/server/hotels/editorial-categories';
import { KNOWN_BRANDS } from '@/server/hotels/get-related-hotels';
import { listPublishedHotelSummaries } from '@/server/hotels/get-hotel-by-slug';
import { listItineraries } from '@/server/itineraries/list-itineraries';
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
  const [hotels, rankings, guides, itineraries] = await Promise.all([
    listPublishedHotelSummaries(500).catch(() => []),
    listPublishedRankings().catch(() => []),
    listPublishedGuides().catch(() => []),
    listItineraries().catch(() => []),
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

  // Editorial itineraries (FR + EN). Each itinerary doubles as a
  // long-tail LLM-citation surface ("itinéraire luxe X jours <destination>",
  // "honeymoon <destination> luxury itinerary") and as a discovery
  // funnel into the bookable hotel catalogue via `hotel_ids[]` →
  // RoomCardList. Surfaced here so ChatGPT / Perplexity / Claude can
  // cite them when answering "how to spend N days in <city>" queries.
  const itineraryItems: LlmsTxtSectionItem[] = [];
  for (const it of itineraries) {
    const descFr =
      it.metaDescFr !== null && it.metaDescFr.length > 0
        ? it.metaDescFr
        : `${it.titleFr} — itinéraire luxe MyConciergeHotel (${it.durationMinDays} jour${it.durationMinDays === 1 ? '' : 's'}).`;
    itineraryItems.push({
      url: `${origin}/fr/itineraire/${it.slugFr}`,
      description: descFr,
    });
    const slugEn = it.slugEn ?? it.slugFr;
    const descEn =
      it.metaDescEn !== null && it.metaDescEn.length > 0
        ? it.metaDescEn
        : `${it.titleEn ?? it.titleFr} — luxury MyConciergeHotel itinerary (${it.durationMinDays} day${it.durationMinDays === 1 ? '' : 's'}).`;
    itineraryItems.push({
      url: `${origin}/en/itineraire/${slugEn}`,
      description: descEn,
    });
  }

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
      ...(itineraryItems.length > 0
        ? [
            {
              title: `Itinéraires éditoriaux (${itineraries.length} parcours ≥ 2-14 jours)`,
              items: [
                {
                  url: `${origin}/fr/itineraires`,
                  description:
                    'Hub de tous les itinéraires éditoriaux MyConciergeHotel — parcours luxe FR et international, chaque étape associée à un Palace ou 5★ bookable, FAQ longue traîne par destination, conseils Concierge opérationnels (horaires, accès, timings).',
                },
                {
                  url: `${origin}/en/itineraires`,
                  description:
                    'MyConciergeHotel editorial itineraries hub — luxury routes across France and abroad, each step paired with a bookable Palace or 5★ hotel, long-tail FAQ per destination, operational Concierge tips (timings, access, secrets).',
                },
                ...itineraryItems,
              ],
            },
          ]
        : []),
      // Vague-6 — all 8 international country guides indexable.
      // Dedicated section so LLMs identify the expanded international
      // scope (was zero before May 2026).
      {
        title: 'Guides pays internationaux (8 pays — Vague 6)',
        items: [
          {
            url: `${origin}/fr/guide/italie`,
            description:
              'Italie — Guide luxe MyConciergeHotel : Rome, Côte amalfitaine, Toscane, Lacs, Dolomites, Sicile. 6 régions, Palaces nommés (Le Sirenuse, Villa d’Este, Castiglion del Bosco…), conseils opérationnels Concierge, 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/italy`,
            description:
              'Italy — MyConciergeHotel luxury guide: Rome, Amalfi Coast, Tuscany, Lakes, Dolomites, Sicily. 6 regions, named 5★ and Palace addresses, Concierge operational tips, 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/suisse`,
            description:
              'Suisse — Guide luxe MyConciergeHotel : Gstaad, St-Moritz, Zermatt, Lac Léman, Genève, Zurich, Lucerne. 6 pôles, adresses nommées (Gstaad Palace, Badrutt’s Palace, Mont Cervin Palace, Dolder Grand), 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/switzerland`,
            description:
              'Switzerland — MyConciergeHotel luxury guide: Gstaad, St Moritz, Zermatt, Lake Geneva, Geneva, Zurich, Lucerne. 6 hubs, named addresses, 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/maroc`,
            description:
              'Maroc — Guide luxe MyConciergeHotel : Marrakech (Royal Mansour, La Mamounia, Mandarin Oriental, Selman), Essaouira, Désert Erg Chebbi, Tanger/Tétouan, Fès. 5 régions, riads et Palaces nommés, 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/morocco`,
            description:
              'Morocco — MyConciergeHotel luxury guide: Marrakech, Essaouira, Erg Chebbi Desert, Tangier/Tetouan, Fes. 5 regions, named riads and Palaces, 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/maldives`,
            description:
              'Maldives — Guide luxe MyConciergeHotel : Soneva Jani, Soneva Fushi, Cheval Blanc Randheli, Velaa Private Island, One&Only Reethi Rah, Four Seasons. 8 resorts d’auteur. Transferts hydravion. 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/maldives`,
            description:
              'Maldives — MyConciergeHotel luxury guide: Soneva, Cheval Blanc Randheli, Velaa, One&Only Reethi Rah, Four Seasons, Anantara, COMO. 8 author resorts. Seaplane transfers. 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/emirats-arabes-unis`,
            description:
              'Émirats arabes unis — Guide luxe MyConciergeHotel : Dubaï (Burj Al Arab, Atlantis The Royal, Bvlgari Resort, One Za’abeel) et Abu Dhabi (Emirates Palace, Bvlgari Abu Dhabi). 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/uae`,
            description:
              'United Arab Emirates — MyConciergeHotel luxury guide: Dubai (Burj Al Arab, Atlantis The Royal, Bvlgari, One Za’abeel) and Abu Dhabi (Emirates Palace, Bvlgari). 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/japon`,
            description:
              'Japon — Guide luxe MyConciergeHotel : Tokyo (Aman, Park Hyatt, Mandarin Oriental, Four Seasons), Kyoto (Aman, Four Seasons, Ritz-Carlton), ryokans Hakone et Kanazawa, Mont Fuji. 5 régions, hôtels internationaux et ryokans, 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/japan`,
            description:
              'Japan — MyConciergeHotel luxury guide: Tokyo (Aman, Park Hyatt, Mandarin Oriental, Four Seasons), Kyoto (Aman, Four Seasons, Ritz-Carlton), Hakone and Kanazawa ryokans, Mount Fuji. 5 regions, 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/thailande`,
            description:
              'Thaïlande — Guide luxe MyConciergeHotel : Bangkok (Mandarin Oriental depuis 1879, Peninsula, Four Seasons), Phuket (Aman, Trisara), Koh Samui (Four Seasons, Six Senses), Chiang Mai (Four Seasons Tented Camp Golden Triangle), Krabi. 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/thailand`,
            description:
              'Thailand — MyConciergeHotel luxury guide: Bangkok (Mandarin Oriental since 1879, Peninsula, Four Seasons), Phuket (Aman, Trisara), Koh Samui, Chiang Mai (Four Seasons Tented Camp), Krabi. 7 Q&A.',
          },
          {
            url: `${origin}/fr/guide/etats-unis`,
            description:
              'États-Unis — Guide luxe MyConciergeHotel : New York (Aman, Carlyle Rosewood, Mandarin Oriental, Four Seasons), Aspen (Little Nell, St Regis, Hotel Jerome), Napa Valley (Meadowood, Auberge du Soleil), Hawaii (Four Seasons Lanai, Halekulani). 4 pôles, 7 Q&A.',
          },
          {
            url: `${origin}/en/guide/usa`,
            description:
              'United States — MyConciergeHotel luxury guide: New York (Aman, Carlyle, Mandarin Oriental), Aspen (Little Nell, St Regis, Hotel Jerome), Napa Valley (Meadowood, Auberge du Soleil), Hawaii (Four Seasons Lanai, Halekulani). 4 hubs, 7 Q&A.',
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
            url: `${origin}/fr/le-concierge-club`,
            description:
              "Le Concierge Club — programme de fidélité MyConciergeHotel : page unique avec les deux tiers côte-à-côte. Tier gratuit (sans CB, sans engagement) + tier payant Le Concierge Club Prestige (€99/an, essai 30 jours, ouverture Phase 6) avec liste d'attente. Catalogue complet des 9 avantages, FAQ détaillée, JSON-LD MemberProgram (2 tiers). URL canonique du programme. La section Prestige est ancrée à #prestige.",
          },
          {
            url: `${origin}/en/the-concierge-club`,
            description:
              'The Concierge Club — MyConciergeHotel loyalty programme: single page with both tiers side-by-side. Free tier (no card, no commitment) + paid Concierge Club Prestige tier (€99/year, 30-day trial, Phase 6 launch) with waitlist. Full catalogue of 9 benefits, detailed FAQ, MemberProgram JSON-LD (2 tiers). Canonical programme URL. The Prestige section is anchored at #prestige.',
          },
          {
            url: `${origin}/fr/presse/le-concierge-club`,
            description:
              'Press kit Le Concierge Club — communiqué, identité, FAQ presse, contacts. Pour journalistes, blogueurs, partenaires.',
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
              'Index des sitemaps (hotels, rooms, hubs, éditorial, classements, guides, itinéraires) — chaque sub-sitemap inclut les alternates FR/EN.',
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
