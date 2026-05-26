import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { agentJson, gateAgentRequest } from '@/server/agent/respond';
import { emitClubEvent } from '@/server/observability/club-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/join-concierge-club — Le Concierge Club sign-up
 * intake for LLM agents.
 *
 * Why a deep-link shell rather than a direct Supabase signup
 * (ADR-0019 §Phase-1):
 *
 * 1. Supabase Auth requires the user to confirm the email by clicking
 *    a link delivered to their inbox; that callback necessarily
 *    happens in a browser session and cannot be completed from a
 *    stateless API call.
 * 2. Forcing the signup through the HTML flow keeps the consent UX,
 *    honeypot + CSRF protections, and the `signup_source =
 *    concierge_club` user metadata in a single code path
 *    (`joinClubAction` in `server/auth/actions.ts`).
 * 3. Avoids exposing an unguarded server-side `auth.admin.createUser`
 *    surface that bots could enumerate.
 *
 * The agent receives a `nextStep` envelope describing the canonical
 * HTML route (`/{locale}/compte/rejoindre`) with the e-mail prefilled
 * as a query parameter. The agent is expected to present this URL to
 * the user (deep-link in chat, redirect in a webview, etc.).
 *
 * Skill: api-integration, auth-role-management, membership-program.
 */

const BodySchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  consentMarketing: z.boolean().optional(),
  locale: z.enum(['fr', 'en']).default('fr'),
  // Honeypot — bots fill this, humans don't. Silently accept (don't
  // tip off the bot) but never advance the flow.
  phone: z.string().max(0).optional(),
});

export async function POST(req: NextRequest) {
  const gate = await gateAgentRequest(req);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return agentJson(
      { ok: false, error: 'invalid_json' },
      { status: 400, cacheControl: 'no-store' },
    );
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return agentJson(
      { ok: false, error: 'invalid_body' },
      { status: 400, cacheControl: 'no-store' },
    );
  }
  const data = parsed.data;

  // Honeypot tripped — fake the redirect envelope but with a
  // `spam-trap` ref so we can grep Sentry breadcrumbs later.
  if (typeof data.phone === 'string' && data.phone.length > 0) {
    return agentJson(
      {
        ok: true,
        mode: 'redirect',
        ref: 'spam-trap',
        nextStep: {
          method: 'GET',
          href: `/${data.locale}/compte/rejoindre`,
        },
      },
      { status: 202, cacheControl: 'no-store' },
    );
  }

  await emitClubEvent('club.signup.attempt', {
    surface: 'agent_api',
    provider: 'password',
    locale: data.locale,
    tags: { via: 'agent-skill' },
  });

  // Build the prefilled deep-link. Only public-safe fields end up in
  // the query string (no password, no `consentMarketing` — both are
  // collected from the user via the HTML form for clear consent).
  const params = new URLSearchParams();
  params.set('email', data.email);
  if (data.firstName !== undefined) params.set('firstName', data.firstName);
  if (data.lastName !== undefined) params.set('lastName', data.lastName);
  const deepLink = `/${data.locale}/compte/rejoindre?${params.toString()}`;

  return agentJson(
    {
      ok: true,
      mode: 'redirect',
      locale: data.locale,
      nextStep: {
        method: 'GET',
        href: deepLink,
        rationale:
          data.locale === 'en'
            ? 'Le Concierge Club sign-up requires an email confirmation step that must happen in the user’s browser. Present this URL to the user to complete the sign-up — the form is prefilled with the provided details.'
            : "L'inscription au Concierge Club nécessite une confirmation par e-mail qui doit se faire dans le navigateur du membre. Présentez cette URL à l'utilisateur pour finaliser l'inscription — le formulaire est pré-rempli.",
      },
      message:
        data.locale === 'en'
          ? 'Continue the sign-up on the provided URL — the email field is prefilled, the user only needs to choose a password and confirm consent.'
          : "Poursuivez l'inscription sur l'URL indiquée — le champ e-mail est pré-rempli, l'utilisateur n'a qu'à choisir un mot de passe et confirmer son consentement.",
    },
    { status: 202, cacheControl: 'no-store' },
  );
}
