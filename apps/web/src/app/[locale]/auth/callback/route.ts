import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getPathname } from '@/i18n/navigation';
import { isRoutingLocale, type Locale } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const OtpTypeSchema = z.enum([
  'signup',
  'email',
  'magiclink',
  'recovery',
  'invite',
  'email_change',
]);

/**
 * Build a localised account URL via the typed pathnames map.
 *
 * `errorKind` is appended as `?error=<kind>` — the connexion form already
 * displays it. Phase 2: this replaces the bespoke `withLocalePath`
 * string concatenation so the EN flow goes to `/en/account/sign-in`
 * (not the legacy `/en/compte/connexion`).
 */
function accountUrl(
  origin: URL,
  locale: Locale,
  pathname: '/compte' | '/compte/connexion' | '/compte/nouveau-mot-de-passe',
  errorKind?: string,
): URL {
  const path = getPathname({ locale, href: pathname });
  const u = new URL(path, origin);
  if (errorKind !== undefined) u.searchParams.set('error', errorKind);
  return u;
}

/**
 * `nextRaw` is a user-controlled query parameter. We only forward it
 * when it is a strict path (one leading `/`, no protocol, no `//`
 * netloc smuggling) so an attacker can't open-redirect via the auth
 * callback. Anything else falls back to `/compte`.
 */
function safeNextUrl(origin: URL, locale: Locale, candidate: string | null): URL {
  if (candidate === null) return accountUrl(origin, locale, '/compte');
  if (!candidate.startsWith('/')) return accountUrl(origin, locale, '/compte');
  if (candidate.startsWith('//')) return accountUrl(origin, locale, '/compte');
  // The path may already include a search string from the upstream caller;
  // preserve both.
  const parsed = new URL(candidate, origin);
  const out = new URL(parsed.pathname, origin);
  out.search = parsed.search;
  return out;
}

/**
 * Verifies Supabase email-confirm / recovery tokens, sets the cookie session,
 * then forwards to the in-app destination.
 *
 * Supabase sends `?token_hash=...&type=signup|recovery|...` (PKCE-less default).
 * Older flows may use `?code=...` — handle both.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
): Promise<NextResponse> {
  const { locale: raw } = await params;
  const locale: Locale = isRoutingLocale(raw) ? raw : 'fr';
  const url = new URL(request.url);

  const tokenHash = url.searchParams.get('token_hash');
  const rawType = url.searchParams.get('type');
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next');

  const supabase = await createSupabaseServerClient();

  // Branch A: token_hash + type (default email confirm flow).
  if (tokenHash !== null && rawType !== null) {
    const typeParsed = OtpTypeSchema.safeParse(rawType);
    if (!typeParsed.success) {
      return NextResponse.redirect(accountUrl(url, locale, '/compte/connexion', 'upstream'), 303);
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParsed.data,
    });
    if (error !== null) {
      return NextResponse.redirect(accountUrl(url, locale, '/compte/connexion', 'upstream'), 303);
    }
    const destination =
      typeParsed.data === 'recovery'
        ? accountUrl(url, locale, '/compte/nouveau-mot-de-passe')
        : safeNextUrl(url, locale, nextRaw);
    return NextResponse.redirect(destination, 303);
  }

  // Branch B: legacy/PKCE `?code=...` exchange.
  if (code !== null) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error !== null) {
      return NextResponse.redirect(accountUrl(url, locale, '/compte/connexion', 'upstream'), 303);
    }
    return NextResponse.redirect(safeNextUrl(url, locale, nextRaw), 303);
  }

  return NextResponse.redirect(accountUrl(url, locale, '/compte/connexion', 'invalid_input'), 303);
}
