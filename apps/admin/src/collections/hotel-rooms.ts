import type { CollectionConfig } from 'payload';

/**
 * HotelRooms — Payload-managed editorial mirror of `public.hotel_rooms`, plus
 * the operator UI for supplier room mappings (migration 0071).
 *
 * - Lives in the **`cms` schema** (`cms.hotel_rooms`) per the dual-table mirror
 *   strategy (ADR 0010). The public site keeps reading `public.hotel_rooms`;
 *   the eventual `afterChange` sync hook (Phase 8.1) upserts edits into
 *   `public.hotel_rooms` and the `supplier_mappings` array into
 *   `public.room_supplier_mappings` (deterministic editorial <-> supplier
 *   room join — replaces the runtime fuzzy matcher).
 * - `supplier_mappings` is the human-validated link: editors record, per
 *   room, the supplier room identity (Travelport labels/bookingCodes,
 *   RateHawk `rg_ext`). Human validation here is the strongest EEAT signal
 *   for the mapping.
 *
 * RBAC:
 *   - read: admin/editor/seo/operator.
 *   - create/update: admin + editor (operators may edit mappings).
 *   - delete: admin only.
 *
 * Skill: backoffice-cms + content-modeling + product-architecture.
 */
interface PayloadUserRole {
  readonly role?: string;
}

function hasRole(user: unknown, roles: readonly string[]): boolean {
  if (user === null || typeof user !== 'object') return false;
  const role = (user as PayloadUserRole).role;
  return typeof role === 'string' && roles.includes(role);
}

const SUPPLIER_OPTIONS = [
  { label: 'Travelport', value: 'travelport' },
  { label: 'RateHawk (ETG)', value: 'ratehawk' },
  { label: 'Little Emperors (concierge)', value: 'little_emperors' },
] as const;

const MAPPING_CONFIDENCE_OPTIONS = [
  { label: 'Manuel (validé humain)', value: 'manual' },
  { label: 'Auto — confiance haute', value: 'auto_high' },
  { label: 'Auto — confiance moyenne', value: 'auto_medium' },
  { label: 'Auto — confiance basse', value: 'auto_low' },
] as const;

export const HotelRooms: CollectionConfig = {
  slug: 'hotel_rooms',
  dbName: 'hotel_rooms',
  admin: {
    useAsTitle: 'room_code',
    defaultColumns: ['hotel_id', 'room_code', 'name_fr', 'is_signature', 'display_order'],
    description:
      'Editorial rooms (cms mirror of public.hotel_rooms) + supplier room mappings (room_supplier_mappings). Curated Cloudinary photos stay the indexable source; supplier media is funnel-only.',
    listSearchableFields: ['hotel_id', 'room_code', 'name_fr', 'name_en'],
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'seo', 'operator']),
    create: ({ req: { user } }) => hasRole(user, ['admin', 'editor']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'operator']),
    delete: ({ req: { user } }) => hasRole(user, ['admin']),
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'hotel_id',
          type: 'text',
          required: true,
          admin: { width: '60%', description: 'UUID of the hotel in public.hotels.' },
        },
        {
          name: 'room_code',
          type: 'text',
          required: true,
          admin: { width: '40%', description: 'Stable internal room code (unique per hotel).' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'name_fr', type: 'text', admin: { width: '50%' } },
        { name: 'name_en', type: 'text', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'description_fr', type: 'textarea', admin: { width: '50%' } },
        { name: 'description_en', type: 'textarea', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'max_occupancy', type: 'number', min: 1, max: 12, admin: { width: '25%' } },
        { name: 'bed_type', type: 'text', admin: { width: '25%' } },
        { name: 'size_sqm', type: 'number', min: 1, max: 2000, admin: { width: '25%' } },
        {
          name: 'display_order',
          type: 'number',
          defaultValue: 100,
          min: 0,
          admin: { width: '25%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'is_signature',
          type: 'checkbox',
          defaultValue: false,
          admin: { width: '50%', description: 'Signature suite — pinned above other rooms.' },
        },
        {
          name: 'hero_image',
          type: 'text',
          admin: {
            width: '50%',
            description:
              'Curated Cloudinary public_id (INDEXABLE source). e.g. cct/hotels/<slug>/<room>-1',
          },
        },
      ],
    },
    {
      name: 'supplier_mappings',
      type: 'array',
      label: 'Supplier room mappings',
      admin: {
        description:
          'Deterministic link to supplier room identities. One row per supplier room key. Synced to public.room_supplier_mappings.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'supplier',
              type: 'select',
              required: true,
              options: [...SUPPLIER_OPTIONS],
              admin: { width: '40%' },
            },
            {
              name: 'confidence',
              type: 'select',
              required: true,
              defaultValue: 'manual',
              options: [...MAPPING_CONFIDENCE_OPTIONS],
              admin: { width: '60%' },
            },
          ],
        },
        {
          name: 'supplier_room_key',
          type: 'json',
          required: true,
          admin: {
            description:
              'JSON identity. travelport: {"labels":["Deluxe Room"],"bookingCodes":["…"]}. ratehawk: {"rg_ext":{"class":3,"quality":2,…}}.',
          },
        },
      ],
    },
  ],
};
