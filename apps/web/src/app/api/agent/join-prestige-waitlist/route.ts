import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/join-prestige-waitlist — Le Concierge Club
 * Prestige waitlist intake (deep-link shell).
 *
 * The Prestige waitlist (`prestige_waitlist` table, migration 0057)
 * enforces a FK on `user_id`. The endpoint therefore requires a
 * Supabase Auth session, which an LLM agent does not own — sessions
 * live in browser cookies set during the magic-link / OAuth callback.
 *
 * Rather than expose a service-role bypass that would let an agent
 * subscribe arbitrary users without their consent, this endpoint
 * acts as a deep-link router: it returns the canonical HTML URL
 * (`/{locale}/le-concierge-club/prestige`) and instructs the agent
 * to present it to the user. The HTML page handles three states
 * (unauthenticated → /compte/rejoindre with `next=`, authenticated +
 * not-on-list → join form, authenticated + on-list → confirmation).
 *
 * Phase 6 will replace this shell with a true wire-up once Stripe
 * Checkout + Customer Match flows ship and the agent platforms can
 * exchange a verifiable session token (skill `loyalty-program`
 * §Phase 6).
 *
 * Skill: api-integration, loyalty-program, membership-program.
 */

const BodySchema = z.object({
  locale: z.enum(['fr', 'en']).default('fr'),
});

export async function POST(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  let raw: unknown = {};
  if (req.headers.get('content-length') !== '0') {
    try {
      raw = await req.json();
    } catch {
      return agentJson(
        { ok: false, error: 'invalid_json' },
        { status: 400, cacheControl: 'no-store' },
      );
    }
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_body' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const { locale } = parsed.data;

  const deepLink = `/${locale}/le-concierge-club/prestige`;

  return agentJson(
    {
      ok: true,
      mode: 'redirect',
      locale,
      nextStep: {
        method: 'GET',
        href: deepLink,
        rationale:
          locale === 'en'
            ? 'The Prestige waitlist requires an active Le Concierge Club session (the waitlist row is foreign-keyed to the auth user). Direct the user to the HTML page — it handles both the sign-in/sign-up redirect and the waitlist join in one flow.'
            : "La liste d'attente Prestige nécessite une session active Concierge Club (la ligne est liée à un compte authentifié). Dirigez l'utilisateur vers la page HTML — elle gère à la fois la redirection de connexion et la prise d'inscription en un seul flux.",
      },
      message:
        locale === 'en'
          ? 'Open the URL: if the user is not signed in yet, the page redirects to the Le Concierge Club sign-up flow and brings them back after confirmation.'
          : "Ouvrez l'URL : si l'utilisateur n'est pas encore connecté, la page redirige vers l'inscription au Concierge Club puis revient ici après confirmation.",
    },
    { status: 202, cacheControl: 'no-store' },
  );
}
