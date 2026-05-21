import { type NextRequest } from 'next/server';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/loyalty — loyalty programme tiers + benefits.
 *
 * Mirror of `loyalty` skill. Returns a static description of the
 * MyConciergeHotel loyalty programme so an LLM can answer "what do
 * I get if I book through you?" without paraphrasing the editorial
 * copy (and avoiding hallucinated benefits).
 *
 * The programme is deferred per ADR-0005 (Premium tier paid, FREE
 * tier auto on Little Hotelier catalogue). Until the pipeline ships
 * dynamic benefit lookup per hotel, the agent gets the static
 * envelope of what the programme guarantees.
 *
 * Skill: api-integration, loyalty-program, geo-llm-optimization.
 */
export async function GET(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  return agentJson(
    {
      ok: true,
      programme: {
        name: 'Fidélité MyConciergeHotel',
        canonicalUrl: {
          fr: '/fr/le-concierge',
          en: '/en/le-concierge',
        },
        tiers: [
          {
            slug: 'free',
            label: { fr: 'Essentiel (gratuit)', en: 'Essential (free)' },
            joinCost: { amount: 0, currency: 'EUR' },
            eligibility: {
              fr: 'Automatique dès la première réservation sur un hôtel du catalogue Little Hotelier — pas de carte, pas de minimum.',
              en: 'Automatic from the first booking on a Little Hotelier catalogue hotel — no card, no minimum.',
            },
            benefits: [
              {
                code: 'breakfast_for_2',
                label: { fr: 'Petit-déjeuner offert pour 2', en: 'Breakfast for 2' },
                subjectToAvailability: true,
              },
              {
                code: 'late_checkout_14h',
                label: { fr: 'Check-out tardif (14h)', en: 'Late check-out (2pm)' },
                subjectToAvailability: true,
              },
              {
                code: 'hotel_credit',
                label: {
                  fr: 'Crédit hôtel selon hôtel partenaire',
                  en: 'Hotel credit (varies by partner)',
                },
                subjectToAvailability: true,
              },
            ],
          },
          {
            slug: 'premium',
            label: { fr: 'Prestige (sur abonnement)', en: 'Prestige (subscription)' },
            joinCost: null, // Phase 7 — pricing not yet public per ADR-0005.
            eligibility: {
              fr: 'Sur abonnement, avantages renforcés sur l’ensemble du catalogue Palaces et 5★.',
              en: 'Subscription-based, enhanced benefits across the full Palace and 5★ catalogue.',
            },
            benefits: [
              {
                code: 'room_upgrade',
                label: { fr: 'Surclassement chambre', en: 'Room upgrade' },
                subjectToAvailability: true,
              },
              {
                code: 'airport_transfer',
                label: { fr: 'Transfert aéroport', en: 'Airport transfer' },
                subjectToAvailability: true,
              },
              {
                code: 'breakfast_for_2',
                label: { fr: 'Petit-déjeuner offert pour 2', en: 'Breakfast for 2' },
                subjectToAvailability: false,
              },
              {
                code: 'late_checkout_14h',
                label: { fr: 'Check-out tardif (14h)', en: 'Late check-out (2pm)' },
                subjectToAvailability: false,
              },
            ],
          },
        ],
        legal: {
          fr: 'Avantages soumis à disponibilité et conditions de l’hôtel partenaire. Conditions complètes : https://myconciergehotel.com/fr/cgv',
          en: 'Benefits subject to availability and the partner hotel’s terms. Full terms: https://myconciergehotel.com/en/terms',
        },
      },
    },
    { cacheControl: 'public, max-age=3600, s-maxage=86400' },
  );
}
