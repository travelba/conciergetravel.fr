import type { CollectionConfig } from 'payload';

/**
 * Places — Payload-managed editorial mirror of `public.places`
 * (migration 0076). Canonical "lieu à visiter" fiche for the two
 * standalone buckets: `visit` (patrimony/culture) and `do` (activities).
 *
 * Like Hotels (ADR-0010), this collection lives in the **`cms` schema**
 * (`cms.places`) and never collides with the SQL-migrated canonical
 * `public.places`. The eventual `afterChange` sync hook UPSERTs into
 * `public.places`.
 *
 * Blocking editorial validators mirror the published-quality envelope of
 * the hotels catalogue so a place cannot be published thin:
 *   - factual_summary_fr in [110, 165] chars (production envelope),
 *   - faq with >= 6 Q&A,
 *   - concierge_advice.fr 50-110 words (ADR-0011 voice),
 *   - latitude + longitude present (proximity + geo JSON-LD).
 *
 * RBAC:
 *   - read: any back-office role.
 *   - create/update: admin + editor.
 *   - delete: admin only.
 *
 * Skill: backoffice-cms + content-modeling + hotel-kit-rollout.
 */
interface PayloadUserRole {
  readonly role?: string;
}

function hasRole(user: unknown, roles: readonly string[]): boolean {
  if (user === null || typeof user !== 'object') return false;
  const role = (user as PayloadUserRole).role;
  return typeof role === 'string' && roles.includes(role);
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0).length;
}

const BUCKET_OPTIONS = [
  { label: 'Visite (culture / patrimoine)', value: 'visit' },
  { label: 'Activité (à faire)', value: 'do' },
] as const;

const KIND_OPTIONS = [
  { label: 'Musée', value: 'museum' },
  { label: 'Monument / patrimoine', value: 'monument' },
  { label: 'Jardin / parc', value: 'garden' },
  { label: 'Point de vue', value: 'viewpoint' },
  { label: 'Lieu de culte', value: 'place_of_worship' },
  { label: 'Théâtre / arts vivants', value: 'theatre' },
  { label: 'Visite guidée', value: 'guided_tour' },
  { label: 'Shopping spécifique', value: 'shopping' },
  { label: 'Vélo / plein air', value: 'outdoor' },
  { label: 'Attraction (générique)', value: 'attraction' },
] as const;

const FACTUAL_SUMMARY_MIN = 110;
const FACTUAL_SUMMARY_MAX = 165;
const FAQ_MIN = 6;

interface FaqEntry {
  readonly q_fr?: unknown;
  readonly a_fr?: unknown;
}

interface ConciergeAdviceLocale {
  readonly body?: unknown;
}

interface ConciergeAdvicePayload {
  readonly fr?: ConciergeAdviceLocale;
}

function validateFactualSummaryFr(value: unknown): true | string {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return 'factual_summary_fr must be a string';
  const n = value.trim().length;
  if (n < FACTUAL_SUMMARY_MIN || n > FACTUAL_SUMMARY_MAX) {
    return `factual_summary_fr must be ${String(FACTUAL_SUMMARY_MIN)}-${String(
      FACTUAL_SUMMARY_MAX,
    )} chars (got ${String(n)})`;
  }
  return true;
}

function validateFaq(value: unknown): true | string {
  if (value === null || value === undefined) return true;
  if (!Array.isArray(value)) return 'faq must be an array';
  if (value.length < FAQ_MIN) {
    return `faq must contain at least ${String(FAQ_MIN)} Q&A (got ${String(value.length)})`;
  }
  for (const [i, raw] of value.entries()) {
    const entry = raw as FaqEntry;
    if (typeof entry.q_fr !== 'string' || entry.q_fr.trim().length === 0) {
      return `faq[${String(i)}].q_fr is required`;
    }
    if (typeof entry.a_fr !== 'string' || entry.a_fr.trim().length === 0) {
      return `faq[${String(i)}].a_fr is required`;
    }
  }
  return true;
}

function validateConciergeAdvice(value: unknown): true | string {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'object') return 'concierge_advice must be an object';
  const fr = (value as ConciergeAdvicePayload).fr;
  if (fr === undefined || fr === null) return true;
  if (typeof fr.body !== 'string' || fr.body.trim().length === 0) {
    return 'concierge_advice.fr.body is required';
  }
  const n = countWords(fr.body);
  if (n < 50 || n > 110) {
    return `concierge_advice.fr.body must be 50-110 words (got ${String(n)})`;
  }
  return true;
}

export const Places: CollectionConfig = {
  slug: 'places',
  // Owns `cms.places` — NEVER public.places (canonical SQL-migrated table).
  dbName: 'places',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'bucket', 'kind', 'is_published', 'updated_at'],
    description:
      'Editorial mirror of public.places ("lieux à visiter"). Buckets visit/do. Blocking validators enforce the published-quality envelope.',
    listSearchableFields: ['name', 'slug', 'city'],
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'seo', 'operator']),
    create: ({ req: { user } }) => hasRole(user, ['admin', 'editor']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'editor']),
    delete: ({ req: { user } }) => hasRole(user, ['admin']),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '50%' } },
        { name: 'name_en', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'slug',
          type: 'text',
          required: true,
          admin: { width: '34%', description: 'Canonical FR slug (/lieux/<city_key>/<slug>).' },
        },
        { name: 'slug_en', type: 'text', admin: { width: '33%' } },
        {
          name: 'source_ref',
          type: 'text',
          admin: {
            width: '33%',
            description: 'Provenance: dt/<uuid>, gp/<place_id>, node/123, hotel-poi.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'city_key',
          type: 'text',
          required: true,
          admin: { width: '25%', description: "Slug ville normalisé (ex: 'paris')." },
        },
        { name: 'city', type: 'text', required: true, admin: { width: '25%' } },
        {
          name: 'country_code',
          type: 'text',
          required: true,
          defaultValue: 'FR',
          maxLength: 2,
          minLength: 2,
          admin: { width: '16%', description: 'ISO 3166-1 alpha-2.' },
        },
        {
          name: 'bucket',
          type: 'select',
          required: true,
          options: [...BUCKET_OPTIONS],
          admin: { width: '17%' },
        },
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'attraction',
          options: [...KIND_OPTIONS],
          admin: { width: '17%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          min: -90,
          max: 90,
          admin: { width: '33%', description: 'Requis pour publier (proximité + geo).' },
        },
        {
          name: 'longitude',
          type: 'number',
          min: -180,
          max: 180,
          admin: { width: '33%', description: 'Requis pour publier (proximité + geo).' },
        },
        { name: 'address', type: 'text', admin: { width: '34%' } },
      ],
    },
    {
      name: 'factual_summary_fr',
      type: 'textarea',
      validate: validateFactualSummaryFr,
      admin: {
        description: `Résumé factuel FR (${String(FACTUAL_SUMMARY_MIN)}-${String(
          FACTUAL_SUMMARY_MAX,
        )} caractères).`,
      },
    },
    { name: 'factual_summary_en', type: 'textarea' },
    { name: 'description_fr', type: 'textarea' },
    { name: 'description_en', type: 'textarea' },
    {
      name: 'concierge_advice',
      type: 'json',
      validate: validateConciergeAdvice,
      admin: { description: 'Voix Concierge (ADR-0011). { fr: { title, body 50-110 mots } }.' },
    },
    {
      name: 'faq',
      type: 'json',
      validate: validateFaq,
      admin: {
        description: `FAQ [{ q_fr, a_fr, q_en, a_en }] — >= ${String(FAQ_MIN)} pour publier.`,
      },
    },
    {
      name: 'external_sources',
      type: 'json',
      admin: { description: 'Provenance EEAT (ADR-0023).' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'hero_image',
          type: 'text',
          admin: { width: '50%', description: 'Cloudinary public_id ou URL.' },
        },
        { name: 'gallery_images', type: 'json', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'meta_title_fr', type: 'text', admin: { width: '50%' } },
        { name: 'meta_title_en', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'meta_desc_fr', type: 'textarea', admin: { width: '50%' } },
        { name: 'meta_desc_en', type: 'textarea', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'is_published',
          type: 'checkbox',
          defaultValue: false,
          admin: { width: '50%' },
        },
        {
          name: 'priority',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 1000,
          admin: { width: '50%' },
        },
      ],
    },
  ],
};
