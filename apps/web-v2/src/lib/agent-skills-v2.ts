import type { AgentSkillsDocument } from '@mch/seo';

/**
 * v2 agent-skills catalogue — subset aligned with public MCP tools.
 * Full v1 catalogue remains in `packages/seo/src/agent-skills.ts`.
 */
export const V2_AGENT_SKILLS: AgentSkillsDocument = {
  schemaVersion: '0.1',
  site: 'MyConciergeHotel.com (v2)',
  skills: [
    {
      name: 'search',
      description:
        'Search extraordinary hotels by destination on the v2 Booking-like catalogue. Returns editorial cards with canonical URLs. Live GDS pricing frozen until Phase 6.',
      inputSchema: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'City, country or hotel name.' },
          checkin: { type: 'string', format: 'date' },
          checkout: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 6 },
          children: { type: 'integer', minimum: 0, maximum: 4 },
          locale: { type: 'string', description: '"fr" or "en".' },
        },
        required: ['destination'],
      },
      endpoint: { method: 'POST', path: '/api/agent/search' },
      phase6Frozen: true,
    },
    {
      name: 'get-hotel',
      description:
        'Fetch a hotel fiche by slug — identity, Concierge advice, rooms, photos. Canonical URL included.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          locale: { type: 'string' },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/hotel/{slug}' },
    },
    {
      name: 'get-ranking',
      description: 'Fetch an editorial ranking with ordered hotel entries and teasers.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          locale: { type: 'string' },
        },
        required: ['slug'],
      },
      endpoint: { method: 'GET', path: '/api/agent/ranking/{slug}' },
    },
    {
      name: 'request-quote',
      description: 'Submit a personalised concierge quote request (24h ETA).',
      inputSchema: {
        type: 'object',
        properties: {
          hotelSlug: { type: 'string' },
          checkIn: { type: 'string', format: 'date' },
          checkOut: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 6 },
          message: { type: 'string' },
          email: { type: 'string', format: 'email' },
          locale: { type: 'string' },
        },
        required: ['hotelSlug', 'checkIn', 'checkOut', 'email'],
      },
      endpoint: { method: 'POST', path: '/api/agent/quote' },
    },
  ],
};
