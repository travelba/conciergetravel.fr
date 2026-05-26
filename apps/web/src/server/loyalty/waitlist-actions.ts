'use server';

import { z } from 'zod';

import { redirect } from '@/i18n/navigation';
import { isRoutingLocale } from '@/i18n/routing';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOptionalUser } from '@/server/auth/session';
import { emitClubEvent, hashUserId } from '@/server/observability/club-events';

/**
 * Prestige waitlist server actions.
 *
 * The `prestige_waitlist` table is empty in Phase 1; sign-ups land
 * there with `source='self_signup'` so Phase 6 can drip-feed launch
 * emails through Brevo from a clean list.
 *
 * The action *requires* a signed-in user (FK on `user_id`). The page
 * gates the unauthenticated state by redirecting to `/compte/rejoindre`
 * with `next=/le-concierge-club#prestige` so the user lands back on
 * the merged programme page (post-2026-05-26 consolidation) and the
 * browser scrolls straight to the Prestige section after sign-up.
 *
 * Skill: loyalty-program + auth-role-management + supabase-postgres-rls.
 */

const PrestigeWaitlistInputSchema = z.object({
  locale: z.string().min(2).max(5),
  intent: z.enum(['trial_at_launch', 'newsletter_only']).default('trial_at_launch'),
});

export interface PrestigeWaitlistJoinError {
  readonly kind: 'unauthenticated' | 'duplicate' | 'invalid_input' | 'upstream';
}

export type PrestigeWaitlistJoinResult =
  | { readonly ok: true; readonly alreadyOnList: boolean }
  | { readonly ok: false; readonly error: PrestigeWaitlistJoinError };

export async function joinPrestigeWaitlistAction(
  formData: FormData,
): Promise<PrestigeWaitlistJoinResult> {
  const raw = {
    locale: String(formData.get('locale') ?? ''),
    intent: String(formData.get('intent') ?? 'trial_at_launch'),
  };

  const parsed = PrestigeWaitlistInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { kind: 'invalid_input' } };
  }
  const localeCandidate = parsed.data.locale;
  if (!isRoutingLocale(localeCandidate)) {
    return { ok: false, error: { kind: 'invalid_input' } };
  }

  const user = await getOptionalUser();
  if (user === null) {
    redirect({
      href: {
        pathname: '/compte/rejoindre',
        query: { next: '/le-concierge-club#prestige' },
      },
      locale: localeCandidate,
    });
  }
  if (user === null) {
    return { ok: false, error: { kind: 'unauthenticated' } };
  }

  let admin: ReturnType<typeof getSupabaseAdminClient>;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return { ok: false, error: { kind: 'upstream' } };
  }

  const insertResult = await admin
    .from('prestige_waitlist')
    .insert({
      user_id: user.id,
      intent: parsed.data.intent,
      source: 'self_signup',
    })
    .select('user_id')
    .maybeSingle();

  const userIdHash = hashUserId(user.id);
  const hashFragment = userIdHash !== undefined ? { userIdHash } : {};

  if (insertResult.error !== null) {
    // 23505 = unique_violation (already on the waitlist).
    if (insertResult.error.code === '23505') {
      await emitClubEvent('club.waitlist_prestige_signup', {
        surface: 'prestige_landing',
        locale: localeCandidate,
        tags: { intent: parsed.data.intent, already_on_list: true },
        ...hashFragment,
      });
      return { ok: true, alreadyOnList: true };
    }
    await emitClubEvent('club.waitlist_prestige_failure', {
      surface: 'prestige_landing',
      errorKind: insertResult.error.code ?? 'upstream',
      locale: localeCandidate,
      ...hashFragment,
    });
    return { ok: false, error: { kind: 'upstream' } };
  }

  await emitClubEvent('club.waitlist_prestige_signup', {
    surface: 'prestige_landing',
    locale: localeCandidate,
    tags: { intent: parsed.data.intent, already_on_list: false },
    ...hashFragment,
  });

  return { ok: true, alreadyOnList: false };
}

export async function isOnPrestigeWaitlist(userId: string): Promise<boolean> {
  try {
    const admin = getSupabaseAdminClient();
    const { count } = await admin
      .from('prestige_waitlist')
      .select('user_id', { head: true, count: 'exact' })
      .eq('user_id', userId);
    return typeof count === 'number' && count > 0;
  } catch {
    return false;
  }
}
