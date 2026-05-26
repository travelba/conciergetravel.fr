import 'server-only';

import { cache } from 'react';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import * as Loyalty from '@mch/domain/loyalty';

const TierSchema = z.enum(['club', 'prestige']);

/**
 * Wire shape of `public.loyalty_members` after migration 0057. Kept as
 * a Zod-validated boundary so a missing/extra column from a future
 * migration becomes a parse error, not a runtime `undefined`.
 *
 * Skill: typescript-strict-zod-interop + auth-role-management.
 */
export const LoyaltyMemberRowSchema = z.object({
  id: z.string().uuid(),
  tier: TierSchema,
  tier_expiry: z.string().nullable(),
  total_bookings: z.number().int().nonnegative(),
  premium_price: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  trial_started_at: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
  paid_until: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
});

export type LoyaltyMemberRow = z.infer<typeof LoyaltyMemberRowSchema>;

/** Request-cached so the dashboard, header and benefits block only hit Supabase once. */
export const getLoyaltyMember = cache(async (userId: string): Promise<LoyaltyMemberRow | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('loyalty_members')
      .select(
        'id,tier,tier_expiry,total_bookings,premium_price,created_at,updated_at,trial_started_at,trial_ends_at,paid_until,stripe_subscription_id,stripe_customer_id,cancelled_at,cancellation_reason',
      )
      .eq('id', userId)
      .maybeSingle();
    if (error !== null || data === null) return null;
    const parsed = LoyaltyMemberRowSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});

/** Domain projection used by `eligibleBenefits` / `trialState`. */
export function toDomainMember(row: LoyaltyMemberRow): Loyalty.LoyaltyMember {
  return {
    userId: row.id as never,
    tier: row.tier,
    createdAt: new Date(row.created_at),
    ...(row.trial_started_at !== null ? { trialStartedAt: new Date(row.trial_started_at) } : {}),
    ...(row.trial_ends_at !== null ? { trialEndsAt: new Date(row.trial_ends_at) } : {}),
    ...(row.paid_until !== null ? { paidUntil: new Date(row.paid_until) } : {}),
    ...(row.stripe_subscription_id !== null
      ? { stripeSubscriptionId: row.stripe_subscription_id }
      : {}),
    ...(row.stripe_customer_id !== null ? { stripeCustomerId: row.stripe_customer_id } : {}),
    ...(row.cancelled_at !== null ? { cancelledAt: new Date(row.cancelled_at) } : {}),
    ...(row.cancellation_reason !== null ? { cancellationReason: row.cancellation_reason } : {}),
  };
}
