import 'server-only';

import { emitClubEvent } from '@/server/observability/club-events';

import { type AgentLocale, type BuilderResponse, rawResponse } from './types';

/**
 * Funnel (mutating, non-pricing) result builders shared by the
 * `/api/agent/*` routes and the MCP tools (Lot 4, ADR-0029). These are
 * dry-run / deep-link shells today — no live vendor calls — so they are
 * NOT subject to the Phase 6 freeze. Honeypot + idempotency semantics
 * are preserved verbatim from the routes.
 */

const NO_STORE = 'no-store';

export interface ContactParams {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly locale: AgentLocale;
  readonly phone?: string;
  /** Honeypot — non-empty means bot; we fake success. */
  readonly website?: string;
}

export function buildContactResult(params: ContactParams): BuilderResponse {
  if (typeof params.website === 'string' && params.website.length > 0) {
    return rawResponse(200, NO_STORE, { ok: true, requestRef: 'spam-trap', etaHours: 24 });
  }

  const ref = `CR-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;

  return rawResponse(200, NO_STORE, {
    ok: true,
    requestRef: ref,
    etaHours: 24,
    locale: params.locale,
    message:
      params.locale === 'en'
        ? 'Your message has been received. Our concierge replies within 24 business hours.'
        : 'Votre message a bien été reçu. Notre conciergerie vous répond sous 24h ouvrées.',
  });
}

export interface NewsletterParams {
  readonly email: string;
  readonly locale: AgentLocale;
  readonly topics?: readonly ('palaces' | 'guides' | 'rankings' | 'concierge-tips')[];
  /** Honeypot — non-empty means bot; we fake success. */
  readonly phone?: string;
}

export function buildNewsletterResult(params: NewsletterParams): BuilderResponse {
  if (typeof params.phone === 'string' && params.phone.length > 0) {
    return rawResponse(202, NO_STORE, { ok: true, mode: 'queued', dryRun: true });
  }

  return rawResponse(202, NO_STORE, {
    ok: true,
    mode: 'queued',
    dryRun: true,
    message:
      "Inscription enregistrée — la newsletter MyConciergeHotel est en cours de bascule sur Brevo. Vous recevrez le prochain numéro dès l'activation (sous quelques jours).",
    locale: params.locale,
    ...(params.topics && params.topics.length > 0 ? { topics: params.topics } : {}),
  });
}

export interface JoinClubParams {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly locale: AgentLocale;
  /** Funnel origin tag — distinguishes HTTP agent skill from MCP tool. */
  readonly via: 'agent-skill' | 'mcp-tool';
  /** Honeypot — non-empty means bot; we fake the redirect. */
  readonly phone?: string;
}

export async function buildJoinClubResult(params: JoinClubParams): Promise<BuilderResponse> {
  if (typeof params.phone === 'string' && params.phone.length > 0) {
    return rawResponse(202, NO_STORE, {
      ok: true,
      mode: 'redirect',
      ref: 'spam-trap',
      nextStep: { method: 'GET', href: `/${params.locale}/compte/rejoindre` },
    });
  }

  await emitClubEvent('club.signup.attempt', {
    surface: 'agent_api',
    provider: 'password',
    locale: params.locale,
    tags: { via: params.via },
  });

  const search = new URLSearchParams();
  search.set('email', params.email);
  if (params.firstName !== undefined) search.set('firstName', params.firstName);
  if (params.lastName !== undefined) search.set('lastName', params.lastName);
  const deepLink = `/${params.locale}/compte/rejoindre?${search.toString()}`;

  return rawResponse(202, NO_STORE, {
    ok: true,
    mode: 'redirect',
    locale: params.locale,
    nextStep: {
      method: 'GET',
      href: deepLink,
      rationale:
        params.locale === 'en'
          ? 'Le Concierge Club sign-up requires an email confirmation step that must happen in the user’s browser. Present this URL to the user to complete the sign-up — the form is prefilled with the provided details.'
          : "L'inscription au Concierge Club nécessite une confirmation par e-mail qui doit se faire dans le navigateur du membre. Présentez cette URL à l'utilisateur pour finaliser l'inscription — le formulaire est pré-rempli.",
    },
    message:
      params.locale === 'en'
        ? 'Continue the sign-up on the provided URL — the email field is prefilled, the user only needs to choose a password and confirm consent.'
        : "Poursuivez l'inscription sur l'URL indiquée — le champ e-mail est pré-rempli, l'utilisateur n'a qu'à choisir un mot de passe et confirmer son consentement.",
  });
}

export interface JoinPrestigeParams {
  readonly locale: AgentLocale;
}

export function buildJoinPrestigeResult(params: JoinPrestigeParams): BuilderResponse {
  const { locale } = params;
  const deepLink = `/${locale}/le-concierge-club#prestige`;

  return rawResponse(202, NO_STORE, {
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
  });
}
