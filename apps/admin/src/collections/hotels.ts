import type { CollectionConfig } from 'payload';

/**
 * Hotels — Payload-managed editorial mirror of `public.hotels`.
 *
 * Phase 8 chantier D. ADR: docs/adr/0010-payload-dual-table-mirror.md.
 *
 * - Lives in the **`cms` schema** (`cms.hotels`) — never overlaps the
 *   canonical `public.hotels` table managed by SQL migrations.
 * - Field shape mirrors `public.hotels` 1:1 (including JSONB structures)
 *   so the eventual `afterChange` sync hook (Phase 8.1) is a straight
 *   UPSERT into `public.hotels`.
 * - For now, edits are stored only in `cms.hotels`. The public site
 *   keeps reading `public.hotels`, so editorial changes are NOT yet
 *   visible until the sync hook ships.
 *
 * RBAC:
 *   - read: any authenticated Payload user (admin/editor/seo/operator).
 *   - create/update: admin + editor.
 *   - delete: admin only (palaces are P0 content — no accidental deletes).
 *
 * Skill: backoffice-cms + content-modeling.
 */
const PRIORITY_OPTIONS = [
  { label: 'P0 — Palace flagship', value: 'P0' },
  { label: 'P1 — Premium', value: 'P1' },
  { label: 'P2 — Standard', value: 'P2' },
] as const;

const BOOKING_MODE_OPTIONS = [
  { label: 'Amadeus GDS (online booking)', value: 'amadeus' },
  { label: 'Little Hotelier (online booking)', value: 'little' },
  { label: 'Travelport (online booking — pilote)', value: 'travelport' },
  { label: 'Email request (concierge)', value: 'email' },
  { label: 'Display only (vitrine)', value: 'display_only' },
] as const;

interface PayloadUserRole {
  readonly role?: string;
}

function hasRole(user: unknown, roles: readonly string[]): boolean {
  if (user === null || typeof user !== 'object') return false;
  const role = (user as PayloadUserRole).role;
  return typeof role === 'string' && roles.includes(role);
}

const CONCIERGE_TIP_FOR = ['room', 'dining', 'timing', 'access', 'service', 'wellness'] as const;

type ConciergeTipFor = (typeof CONCIERGE_TIP_FOR)[number];

interface ConciergeAdviceLocale {
  readonly title?: unknown;
  readonly body?: unknown;
  readonly tip_for?: unknown;
}

interface ConciergeAdvicePayload {
  readonly fr?: ConciergeAdviceLocale;
  readonly en?: ConciergeAdviceLocale;
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0).length;
}

function isConciergeTipFor(v: unknown): v is ConciergeTipFor {
  return typeof v === 'string' && (CONCIERGE_TIP_FOR as readonly string[]).includes(v);
}

function validateLocaleAdvice(loc: unknown, label: string): true | string {
  if (loc === undefined || loc === null) return `${label} is required`;
  if (typeof loc !== 'object') return `${label} must be an object`;
  const a = loc as ConciergeAdviceLocale;
  if (typeof a.title !== 'string' || a.title.trim().length === 0) {
    return `${label}.title is required`;
  }
  if (typeof a.body !== 'string' || a.body.trim().length === 0) {
    return `${label}.body is required`;
  }
  const n = countWords(a.body);
  if (n < 50 || n > 110) {
    return `${label}.body must be 50-110 words (got ${String(n)})`;
  }
  if (!isConciergeTipFor(a.tip_for)) {
    return `${label}.tip_for must be one of ${CONCIERGE_TIP_FOR.join(', ')}`;
  }
  return true;
}

/**
 * Optional on the way in (we backfill via humanizer-pass — see ADR-0011
 * Phase 3), but **rejected if partially filled**: any incoming payload
 * must satisfy the 60-90 words contract on `fr` (`en` is optional and
 * follows the same contract when present).
 */
function validateConciergeAdvice(value: unknown): true | string {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object') return 'concierge_advice must be an object';
  const v = value as ConciergeAdvicePayload;
  const fr = validateLocaleAdvice(v.fr, 'concierge_advice.fr');
  if (fr !== true) return fr;
  if (v.en !== undefined && v.en !== null) {
    const en = validateLocaleAdvice(v.en, 'concierge_advice.en');
    if (en !== true) return en;
  }
  return true;
}

export const Hotels: CollectionConfig = {
  slug: 'hotels',
  // Owns `cms.hotels` — NEVER public.hotels (canonical SQL-migrated table).
  // See ADR 0010 for the dual-table sync strategy.
  dbName: 'hotels',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'priority', 'is_published', 'updated_at'],
    description:
      'Editorial mirror of public.hotels. Phase 8 scaffolding — edits do not yet sync to live. See ADR-0010.',
    listSearchableFields: ['name', 'slug', 'city'],
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'seo', 'operator']),
    create: ({ req: { user } }) => hasRole(user, ['admin', 'editor']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'editor']),
    delete: ({ req: { user } }) => hasRole(user, ['admin']),
  },
  fields: [
    // -----------------------------------------------------------------
    // Identity & routing
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Identity & routing',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'slug', type: 'text', required: true, unique: true, admin: { width: '50%' } },
            { name: 'slug_en', type: 'text', unique: true, admin: { width: '50%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'name_en', type: 'text', admin: { width: '50%' } },
          ],
        },
      ],
    },

    // -----------------------------------------------------------------
    // Classification
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Classification',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'stars',
              type: 'number',
              required: true,
              defaultValue: 5,
              min: 5,
              max: 5,
              admin: { width: '33%', description: 'CDC v3.0: 5★ only.' },
            },
            {
              name: 'is_palace',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%', description: 'Atout France distinction.' },
            },
            {
              name: 'priority',
              type: 'select',
              required: true,
              defaultValue: 'P1',
              options: [...PRIORITY_OPTIONS],
              admin: { width: '34%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'booking_mode',
              type: 'select',
              required: true,
              defaultValue: 'email',
              options: [...BOOKING_MODE_OPTIONS],
              admin: { width: '50%' },
            },
            {
              name: 'is_published',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '50%', description: 'Toggles public visibility.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'is_little_catalog',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                width: '50%',
                description:
                  'Eligible to Le Concierge Club benefits (Phase 6 via Little API sync).',
              },
            },
            {
              name: 'atout_france_id',
              type: 'text',
              admin: { width: '50%' },
            },
          ],
        },
      ],
    },

    // -----------------------------------------------------------------
    // Location
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Location',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'region', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'department', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'city', type: 'text', required: true, admin: { width: '50%' } },
            { name: 'district', type: 'text', admin: { width: '50%' } },
          ],
        },
        { name: 'address', type: 'text' },
        {
          type: 'row',
          fields: [
            {
              name: 'postal_code',
              type: 'text',
              admin: {
                width: '50%',
                description:
                  'Postal code only. Format-checked at write time (FR: NNNNN, EU shapes accepted).',
              },
            },
            {
              name: 'phone_e164',
              type: 'text',
              admin: {
                width: '50%',
                description:
                  'Front-desk phone in E.164 (e.g. "+33158122888"). Surfaces in JSON-LD and click-to-call.',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'latitude',
              type: 'number',
              admin: { width: '50%', step: 0.000001 },
              min: -90,
              max: 90,
            },
            {
              name: 'longitude',
              type: 'number',
              admin: { width: '50%', step: 0.000001 },
              min: -180,
              max: 180,
            },
          ],
        },
        {
          name: 'points_of_interest',
          type: 'json',
          admin: {
            description:
              'Array of nearby POIs: { name, type, distance_m, walking_time_min?, latitude?, longitude?, sameAs? }. Sorted by distance ascending.',
          },
        },
        {
          name: 'transports',
          type: 'json',
          admin: {
            description:
              'Array of transport links: { mode: metro|rer|tram|bus|train|airport_shuttle, line?, name, distance_m, walk_min? }.',
          },
        },
      ],
    },

    // -----------------------------------------------------------------
    // Vendor IDs
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Vendor IDs',
      admin: { initCollapsed: true },
      fields: [
        { name: 'amadeus_hotel_id', type: 'text' },
        { name: 'little_hotel_id', type: 'text' },
        { name: 'makcorps_hotel_id', type: 'text' },
        { name: 'google_place_id', type: 'text' },
      ],
    },

    // -----------------------------------------------------------------
    // Editorial content
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Editorial content',
      fields: [
        {
          type: 'tabs',
          tabs: [
            {
              label: 'French',
              fields: [
                {
                  name: 'description_fr',
                  type: 'textarea',
                  admin: { rows: 8 },
                },
                {
                  name: 'meta_title_fr',
                  type: 'text',
                  maxLength: 60,
                  admin: { description: '50–60 chars.' },
                },
                {
                  name: 'meta_desc_fr',
                  type: 'textarea',
                  maxLength: 160,
                  admin: { rows: 3, description: '140–160 chars.' },
                },
              ],
            },
            {
              label: 'English',
              fields: [
                { name: 'description_en', type: 'textarea', admin: { rows: 8 } },
                { name: 'meta_title_en', type: 'text', maxLength: 60 },
                {
                  name: 'meta_desc_en',
                  type: 'textarea',
                  maxLength: 160,
                  admin: { rows: 3 },
                },
              ],
            },
          ],
        },
      ],
    },

    // -----------------------------------------------------------------
    // Media (Cloudinary public_ids)
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Media',
      fields: [
        {
          name: 'hero_image',
          type: 'text',
          admin: {
            description: 'Cloudinary public_id (e.g. cct/hotels/peninsula-paris/exterior-1).',
          },
        },
        {
          name: 'gallery_images',
          type: 'json',
          admin: {
            description:
              'Array of { public_id, alt_fr?, alt_en?, category? }. See packages/db/scripts/seed-peninsula-paris.ts for shape.',
          },
        },
      ],
    },

    // -----------------------------------------------------------------
    // Structured editorial JSONB
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Structured data',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'highlights',
          type: 'json',
          admin: {
            description:
              'Array of { key, label_fr, label_en } or plain strings — short editorial highlights.',
          },
        },
        {
          name: 'amenities',
          type: 'json',
          admin: { description: 'Same shape as highlights — services & equipments.' },
        },
        {
          name: 'faq_content',
          type: 'json',
          admin: {
            description:
              'Array of { question_fr, question_en, answer_fr, answer_en } for the FAQ block.',
          },
        },
        {
          name: 'restaurant_info',
          type: 'json',
          admin: {
            description:
              'Object: { count, michelin_stars, venues: [{ name, type_fr, type_en, michelin_stars?, chef?, ... }] }.',
          },
        },
        {
          name: 'spa_info',
          type: 'json',
          admin: {
            description:
              'Object: { name, surface_sqm?, treatment_rooms?, features_fr[], features_en[] }.',
          },
        },
        {
          name: 'signature_experiences',
          type: 'json',
          admin: {
            description:
              'Array of signature experiences: { title_fr, title_en, body_fr, body_en, icon? }.',
          },
        },
        {
          name: 'concierge_advice',
          type: 'json',
          admin: {
            description:
              'Voice-of-the-Concierge advice block (CDC §2 + ADR-0011). Shape: { fr: {title, body, tip_for}, en: {title, body, tip_for} }. body MUST be 50-110 words FR/EN (envelope relaxed from initial 60-90 after Phase 3 audit). tip_for ∈ {room, dining, timing, access, service, wellness}. Validation enforced by validateConciergeAdvice hook below.',
          },
          validate: validateConciergeAdvice,
        },
        // ---------------------------------------------------------------
        // Golden-template Concierge blocks (migration 0068)
        // ---------------------------------------------------------------
        {
          name: 'concierge_pick',
          type: 'json',
          admin: {
            description:
              'Golden-template Concierge room recommendation. Object: { slug, note: { fr, en } }. Frames the recommended suite at the top of the rooms grid.',
          },
        },
        {
          name: 'concierge_hook',
          type: 'json',
          admin: {
            description:
              'Golden-template hero accroche (Concierge voice, <= 25 words). Object: { fr, en }. Rendered under the H1; the CDC factual summary stays sr-only for the GEO/JSON-LD contracts.',
          },
        },
        {
          name: 'instagram',
          type: 'json',
          admin: {
            description:
              'Golden-template social feed teaser. Object: { handle, profile_url, followers?, posts:[{permalink, image_public_id, caption_fr?, caption_en?, posted_at?}] } (1-3 posts). Imagery must be mirrored to Cloudinary — never hotlink scontent.cdninstagram.',
          },
        },
        // ---------------------------------------------------------------
        // Premium Concierge sections (Le Concierge Club — migration 0057)
        // The 4 LLM-generated jsonb blobs ({ fr: { body }, en: { body },
        // _editorial_review_status, _generated_at, _llm_model }).
        // ---------------------------------------------------------------
        {
          name: 'conseil_enrichi',
          type: 'json',
          admin: {
            description:
              'Premium Concierge — Conseil enrichi (200-300 mots FR/EN, opens with "Mon conseil :" / "My tip:"). Generated by run-hotel-premium-section.ts --section=conseil_enrichi.',
          },
        },
        {
          name: 'quartier_concierge',
          type: 'json',
          admin: {
            description:
              'Premium Concierge — Le quartier vu par le Concierge (200-300 mots FR/EN, 3 adresses concrètes citées).',
          },
        },
        {
          name: 'gastronomie_concierge',
          type: 'json',
          admin: {
            description:
              'Premium Concierge — La table & le quartier gourmand (200-300 mots FR/EN, étoiles Michelin uniquement si sourcées).',
          },
        },
        {
          name: 'timing_acces_concierge',
          type: 'json',
          admin: {
            description:
              'Premium Concierge — Quand venir & comment arriver (150-200 mots FR/EN, 2 paragraphes obligatoires).',
          },
        },
        {
          name: '_conseil_enrichi_review_status',
          type: 'select',
          defaultValue: 'draft',
          options: [
            { label: 'Draft (LLM, not reviewed)', value: 'draft' },
            { label: 'Pending review', value: 'pending' },
            { label: 'Approved (fact-checked)', value: 'approved' },
          ],
          admin: {
            description:
              'Editorial review status for conseil_enrichi. Fact-check before flipping to "approved".',
            width: '25%',
          },
        },
        {
          name: '_quartier_concierge_review_status',
          type: 'select',
          defaultValue: 'draft',
          options: [
            { label: 'Draft (LLM, not reviewed)', value: 'draft' },
            { label: 'Pending review', value: 'pending' },
            { label: 'Approved (fact-checked)', value: 'approved' },
          ],
          admin: { width: '25%' },
        },
        {
          name: '_gastronomie_concierge_review_status',
          type: 'select',
          defaultValue: 'draft',
          options: [
            { label: 'Draft (LLM, not reviewed)', value: 'draft' },
            { label: 'Pending review', value: 'pending' },
            { label: 'Approved (fact-checked)', value: 'approved' },
          ],
          admin: { width: '25%' },
        },
        {
          name: '_timing_acces_concierge_review_status',
          type: 'select',
          defaultValue: 'draft',
          options: [
            { label: 'Draft (LLM, not reviewed)', value: 'draft' },
            { label: 'Pending review', value: 'pending' },
            { label: 'Approved (fact-checked)', value: 'approved' },
          ],
          admin: { width: '25%' },
        },
        {
          name: 'long_description_sections',
          type: 'json',
          admin: {
            description:
              'Array of long-form story sections: { anchor (kebab-case), title_fr?, title_en?, body_fr?, body_en? }. Renders as <h3 id> + paragraphs.',
          },
        },
        {
          name: 'policies',
          type: 'json',
          admin: {
            description:
              'Object: { check_in, check_out, cancellation, pets, children, city_tax, wifi, payment_methods }. HH:MM regex enforced on times.',
          },
        },
        {
          name: 'awards',
          type: 'json',
          admin: {
            description:
              'Array of awards: { name, issuer, year, schema_type? }. Surfaces in HotelDistinctions UI + JSON-LD Hotel.award[].',
          },
        },
        {
          name: 'featured_reviews',
          type: 'json',
          admin: {
            description:
              'Array of editorial pull-quotes: { source, source_url?, author?, quote, rating?, max_rating?, date? }. Capped at 5 in JSON-LD.',
          },
        },
      ],
    },

    // -----------------------------------------------------------------
    // Inventory & history
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Inventory & history',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'number_of_rooms',
              type: 'number',
              min: 1,
              admin: {
                width: '50%',
                step: 1,
                description:
                  'Total bookable units (all categories). Maps to Schema.org numberOfRooms.',
              },
            },
            {
              name: 'number_of_suites',
              type: 'number',
              min: 0,
              admin: {
                width: '50%',
                step: 1,
                description: 'Editorial count of suites (subset of total rooms).',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'opened_at',
              type: 'date',
              admin: {
                width: '50%',
                date: { pickerAppearance: 'dayOnly' },
                description:
                  'Original opening date. Year surfaces as Schema.org foundingDate + HotelFactSheet history line.',
              },
            },
            {
              name: 'last_renovated_at',
              type: 'date',
              admin: {
                width: '50%',
                date: { pickerAppearance: 'dayOnly' },
                description:
                  'Date of the most recent significant renovation. Must be >= opened_at.',
              },
            },
          ],
        },
        {
          name: 'virtual_tour_url',
          type: 'text',
          maxLength: 512,
          admin: {
            description:
              'External immersive 3D / 360° tour URL. Allowed hosts: https://my.matterport.com or https://kuula.co (CSP + DB CHECK enforce this — any other host is rejected at write time).',
            placeholder: 'https://my.matterport.com/show/?m=…',
          },
          validate: (value: unknown): true | string => {
            if (value === null || value === undefined || value === '') return true;
            if (typeof value !== 'string') return 'Must be a string.';
            if (value.length > 512) return 'Maximum 512 characters.';
            try {
              const url = new URL(value);
              if (url.protocol !== 'https:') return 'Must use https://.';
              if (url.hostname !== 'my.matterport.com' && url.hostname !== 'kuula.co') {
                return 'Host must be my.matterport.com or kuula.co.';
              }
            } catch {
              return 'Invalid URL.';
            }
            return true;
          },
        },
      ],
    },

    // -----------------------------------------------------------------
    // MICE & events (Meetings, Incentives, Conferences, Events)
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'MICE & events',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'mice_info',
          type: 'json',
          admin: {
            description:
              'Optional event-spaces offer (B2B). When set, surfaces an "Events & seminars" section on the public page with a mailto CTA. Schema documented in packages/db/migrations/0024_hotel_mice_info.sql and validated at read time in get-hotel-by-slug.ts:readMiceInfo. Example: {"contact_email":"events@hotel.com","total_capacity_seated":350,"spaces":[{"key":"grand-salon","name":"Grand Salon","surface_sqm":280,"max_seated":350}],"event_types":["corporate-meeting","wedding"]}',
          },
        },
      ],
    },

    // -----------------------------------------------------------------
    // Reviews snapshot
    // -----------------------------------------------------------------
    {
      type: 'collapsible',
      label: 'Reviews snapshot',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'google_rating',
              type: 'number',
              min: 0,
              max: 5,
              admin: { width: '33%', step: 0.1 },
            },
            {
              name: 'google_reviews_count',
              type: 'number',
              min: 0,
              admin: { width: '33%', step: 1 },
            },
            {
              name: 'last_reviews_sync',
              type: 'date',
              admin: { width: '34%', date: { pickerAppearance: 'dayAndTime' } },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    /**
     * Voix Concierge publication blocker (ADR-0011 / Phase 7) — refuse
     * to publish a hotel that doesn't ship at least a FR `concierge_advice`
     * with a body inside the 50-110 word envelope.
     *
     * Runs before validate so the editor sees the error inline before
     * Payload tries to persist. We only block when the row is *becoming*
     * `is_published = true`, never when it's already published (so a
     * fix-by-batch script can still pass through).
     */
    beforeValidate: [
      ({ data, originalDoc }) => {
        const next = (data ?? {}) as Record<string, unknown>;
        const becomingPublished =
          next['is_published'] === true &&
          (originalDoc as { is_published?: boolean } | null | undefined)?.is_published !== true;
        if (!becomingPublished) return data;
        const advice = next['concierge_advice'];
        if (advice === null || advice === undefined) {
          throw new Error(
            'Publication bloquée (ADR-0011) : `concierge_advice` est requis avant publication. Renseigne FR.body (50-110 mots) au minimum.',
          );
        }
        if (typeof advice !== 'object') {
          throw new Error(
            'Publication bloquée (ADR-0011) : `concierge_advice` doit être un objet.',
          );
        }
        const adv = advice as { fr?: { body?: unknown } };
        const body = typeof adv.fr?.body === 'string' ? adv.fr.body.trim() : '';
        const words = body.split(/\s+/u).filter(Boolean).length;
        if (words < 50 || words > 110) {
          throw new Error(
            `Publication bloquée (ADR-0011) : concierge_advice.fr.body fait ${words} mots, attendu 50-110.`,
          );
        }
        return data;
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        // Phase 8.1 TODO: sync `cms.hotels` row into `public.hotels`
        // (UPSERT by slug), then call the apps/web revalidate endpoint
        // with `tag = "hotel-${slug}"`. For now we log only so the
        // editorial team can experiment without touching live data.
        if (process.env['NODE_ENV'] !== 'production') {
          // eslint-disable-next-line no-console
          console.info(
            `[cms.hotels:${operation}] ${(doc as { slug?: string }).slug ?? '?'} — sync to public.hotels is Phase 8.1.`,
          );
        }
        return doc;
      },
    ],
  },
  timestamps: true,
};
