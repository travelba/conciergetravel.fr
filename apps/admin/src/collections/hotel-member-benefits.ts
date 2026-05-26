import type { CollectionConfig } from 'payload';

/**
 * HotelMemberBenefits — operator-facing editor for the `hotel_member_benefits`
 * table (migration 0057). Phase 1: empty by default; manual addendum entries
 * are added here when a hotel signs a paper addendum and the team wants the
 * benefit to appear under the personalised view. Phase 6: nightly Little API
 * sync uses the service role to populate `source='little_api'` rows without
 * going through Payload.
 *
 * RBAC: operator + admin (writers). Read-open to all back-office roles for
 * QA traceability.
 *
 * Skill: backoffice-cms + loyalty-program.
 */
interface PayloadUserRole {
  readonly role?: string;
}

function hasRole(user: unknown, roles: readonly string[]): boolean {
  if (user === null || typeof user !== 'object') return false;
  const role = (user as PayloadUserRole).role;
  return typeof role === 'string' && roles.includes(role);
}

const TIER_OPTIONS = [
  { label: 'Club (gratuit)', value: 'club' },
  { label: 'Prestige (payant)', value: 'prestige' },
] as const;

const BENEFIT_CODE_OPTIONS = [
  { label: 'Petit-déjeuner pour 2', value: 'breakfast_for_2' },
  { label: 'Surclassement chambre', value: 'room_upgrade' },
  { label: 'Crédit hôtel', value: 'hotel_credit' },
  { label: 'Check-out tardif 14h', value: 'late_checkout_14h' },
  { label: 'Cadeau de bienvenue', value: 'welcome_gift' },
  { label: 'WhatsApp Concierge 24/7', value: 'whatsapp_concierge_24_7' },
  { label: 'Présentation au GM', value: 'gm_introduction' },
  { label: 'Tarif membre (Phase 6)', value: 'member_rate_differential' },
  { label: 'Newsletter mensuelle Concierge', value: 'concierge_newsletter_monthly' },
  { label: 'Compte programme', value: 'program_membership_account' },
  { label: 'Priorité de lancement Prestige', value: 'prestige_launch_priority' },
] as const;

const SOURCE_OPTIONS = [
  { label: 'Default (catalogue)', value: 'default' },
  { label: 'Manual addendum (signé)', value: 'manual_addendum' },
  { label: 'Little API (sync nightly)', value: 'little_api' },
] as const;

export const HotelMemberBenefits: CollectionConfig = {
  slug: 'hotel_member_benefits',
  dbName: 'hotel_member_benefits',
  admin: {
    useAsTitle: 'benefit_code',
    defaultColumns: ['hotel_id', 'tier', 'benefit_code', 'source', 'updated_at'],
    description:
      'Per-hotel reality of Le Concierge Club benefits. Phase 1 = manual addendum entries only. Phase 6 = nightly Little API sync populates source=little_api rows.',
    listSearchableFields: ['hotel_id', 'benefit_code'],
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'seo', 'operator']),
    create: ({ req: { user } }) => hasRole(user, ['admin', 'operator']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'operator']),
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
          admin: { width: '50%', description: 'UUID of the hotel in public.hotels.' },
        },
        {
          name: 'tier',
          type: 'select',
          required: true,
          options: [...TIER_OPTIONS],
          admin: { width: '25%' },
        },
        {
          name: 'benefit_code',
          type: 'select',
          required: true,
          options: [...BENEFIT_CODE_OPTIONS],
          admin: { width: '25%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'description_fr',
          type: 'textarea',
          admin: {
            width: '50%',
            description: 'Optional FR override of the catalogue label.',
          },
        },
        {
          name: 'description_en',
          type: 'textarea',
          admin: {
            width: '50%',
            description: 'Optional EN override of the catalogue label.',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'is_subject_to_availability',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            width: '50%',
            description: 'When true, the UI renders "sur demande" instead of "garanti".',
          },
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          defaultValue: 'manual_addendum',
          options: [...SOURCE_OPTIONS],
          admin: {
            width: '50%',
            description: 'Phase 1 manual entries are always "manual_addendum".',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'sort_order',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 9999,
          admin: { width: '33%' },
        },
        {
          name: 'valid_from',
          type: 'date',
          admin: { width: '33%' },
        },
        {
          name: 'valid_until',
          type: 'date',
          admin: { width: '34%' },
        },
      ],
    },
  ],
};
