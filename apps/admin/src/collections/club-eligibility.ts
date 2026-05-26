import type { CollectionConfig } from 'payload';

/**
 * ClubEligibility — operator opt-in flag per hotel for Le Concierge Club.
 *
 * A hotel is eligible to advertise the program (and have its benefits
 * picked up by `<ClubBenefitsBlock>`) only when:
 *
 *   1. `is_eligible = true` here.
 *   2. The hotelier has signed the legal addendum
 *      (`addendum_signed_at` is set).
 *
 * The Phase 6 Little API sync ignores hotels that don't satisfy both.
 *
 * RBAC: operator + admin. Read-open to all back-office roles.
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

export const ClubEligibility: CollectionConfig = {
  slug: 'club_eligibility',
  dbName: 'club_eligibility',
  admin: {
    useAsTitle: 'hotel_id',
    defaultColumns: ['hotel_id', 'is_eligible', 'addendum_signed_at', 'updated_at'],
    description:
      'Opt-in flag for Le Concierge Club per hotel. Requires both is_eligible=true AND a signed addendum (addendum_signed_at set).',
    listSearchableFields: ['hotel_id', 'addendum_signed_by'],
  },
  access: {
    read: ({ req: { user } }) => hasRole(user, ['admin', 'editor', 'seo', 'operator']),
    create: ({ req: { user } }) => hasRole(user, ['admin', 'operator']),
    update: ({ req: { user } }) => hasRole(user, ['admin', 'operator']),
    delete: ({ req: { user } }) => hasRole(user, ['admin']),
  },
  fields: [
    {
      name: 'hotel_id',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'UUID of the hotel in public.hotels. One row per hotel.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'is_eligible',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            width: '50%',
            description:
              'Master flag — hotels with is_eligible=false are invisible to the program.',
          },
        },
        {
          name: 'addendum_signed_at',
          type: 'date',
          admin: {
            width: '50%',
            description: 'Date the hotelier signed the Concierge Club legal addendum.',
          },
        },
      ],
    },
    {
      name: 'addendum_signed_by',
      type: 'text',
      admin: { description: 'Name + role of the hotelier signatory (free text).' },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Operator notes (special terms, exclusions, etc.). Internal only.',
      },
    },
  ],
};
