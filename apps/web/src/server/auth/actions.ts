'use server';

import { headers } from 'next/headers';
import { redirect as nextRedirect } from 'next/navigation';
import { z } from 'zod';

import { getPathname, redirect } from '@/i18n/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Supported account locales. Mirrors `next-intl` routing.
 */
const AccountLocaleSchema = z.enum(['fr', 'en']);
type AccountLocale = z.infer<typeof AccountLocaleSchema>;

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  locale: AccountLocaleSchema,
  next: z.string().startsWith('/').max(256).optional(),
});

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  newsletter: z.union([z.literal('on'), z.literal('off')]).optional(),
  honeypot: z.string().max(0).optional(),
  locale: AccountLocaleSchema,
});

const ForgotSchema = z.object({
  email: z.string().email(),
  locale: AccountLocaleSchema,
});

const ResetSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  locale: AccountLocaleSchema,
});

const SignOutSchema = z.object({
  locale: AccountLocaleSchema,
});

type AuthErrorKind =
  | 'invalid_input'
  | 'invalid_credentials'
  | 'password_mismatch'
  | 'email_taken'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'upstream'
  | 'session_missing';

/**
 * The set of typed pathnames that the auth flow can redirect into. Kept as
 * a discriminated string union so a typo (`/compte/connexionn`) becomes a
 * compile error rather than a runtime 404 — see ADR-0012 §Phase 2.
 */
type AccountPath =
  | '/compte'
  | '/compte/connexion'
  | '/compte/inscription'
  | '/compte/mot-de-passe-oublie'
  | '/compte/nouveau-mot-de-passe';

function originFromHeaders(headerList: Headers): string {
  const explicitOrigin = headerList.get('origin');
  if (explicitOrigin !== null && explicitOrigin.length > 0) return explicitOrigin;
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  if (typeof host === 'string' && host.length > 0) return `${proto}://${host}`;
  return 'http://localhost:3000';
}

function readField(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === 'string' ? v : undefined;
}

/**
 * Localised account URL for use in Supabase email templates. Supabase
 * receives an absolute URL (e.g. `https://myconciergehotel.com/en/auth/callback?...`)
 * and forwards the user there after they click the email link.
 */
function callbackUrlFor(origin: string, locale: AccountLocale, nextPathname: AccountPath): string {
  const callbackPath = getPathname({ locale, href: '/auth/callback' });
  const nextPath = getPathname({ locale, href: nextPathname });
  const callback = new URL(callbackPath, origin);
  callback.searchParams.set('next', nextPath);
  return callback.toString();
}

/**
 * `redirectWithError` — central place where every fallible auth action
 * hands control back to the form. Always returns `never` so callers can
 * use it in expression position (`if (err) redirectWithError(...)`).
 */
function redirectWithError(
  locale: AccountLocale,
  pathname: AccountPath,
  kind: AuthErrorKind,
  email?: string,
): never {
  const query: Record<string, string> = { error: kind };
  if (typeof email === 'string' && email.length > 0) query['email'] = email;
  redirect({ href: { pathname, query }, locale });
}

/**
 * `safeNextUrl` — if the form-provided `next` field is a strict, single-
 * leading-slash path (no protocol, no `//` netloc smuggling), forward to
 * it via `nextRedirect` (Next's raw redirect — `next` may carry a slug
 * outside our typed pathname map). Otherwise fall back to the typed
 * `/compte` redirect.
 */
function safeNextUrl(locale: AccountLocale, candidate: string | undefined): never {
  if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')) {
    nextRedirect(candidate);
  }
  redirect({ href: '/compte', locale });
}

/* -------------------------------------------------------------------------- */
/* Sign-in                                                                    */
/* -------------------------------------------------------------------------- */

export async function signInAction(formData: FormData): Promise<void> {
  const parsed = SignInSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
    locale: readField(formData, 'locale'),
    next: readField(formData, 'next'),
  });
  if (!parsed.success) {
    const email = readField(formData, 'email');
    const locale = (readField(formData, 'locale') as AccountLocale | undefined) ?? 'fr';
    redirectWithError(locale, '/compte/connexion', 'invalid_input', email);
  }

  const { email, password, locale, next } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    const code = error.code ?? '';
    const kind: AuthErrorKind =
      code === 'invalid_credentials'
        ? 'invalid_credentials'
        : code === 'email_not_confirmed'
          ? 'email_not_confirmed'
          : error.status === 429
            ? 'rate_limited'
            : 'upstream';
    redirectWithError(locale, '/compte/connexion', kind, email);
  }

  safeNextUrl(locale, next);
}

/* -------------------------------------------------------------------------- */
/* Sign-up                                                                    */
/* -------------------------------------------------------------------------- */

export async function signUpAction(formData: FormData): Promise<void> {
  const parsed = SignUpSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
    confirmPassword: readField(formData, 'confirmPassword'),
    displayName: readField(formData, 'displayName'),
    newsletter: readField(formData, 'newsletter'),
    honeypot: readField(formData, 'website'),
    locale: readField(formData, 'locale'),
  });
  if (!parsed.success) {
    const email = readField(formData, 'email');
    const locale = (readField(formData, 'locale') as AccountLocale | undefined) ?? 'fr';
    redirectWithError(locale, '/compte/inscription', 'invalid_input', email);
  }

  const { email, password, confirmPassword, displayName, newsletter, locale } = parsed.data;
  if (password !== confirmPassword) {
    redirectWithError(locale, '/compte/inscription', 'password_mismatch', email);
  }

  const headerList = await headers();
  const origin = originFromHeaders(headerList);
  const callbackUrl = callbackUrlFor(origin, locale, '/compte');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        display_name: displayName ?? null,
        locale_pref: locale,
        newsletter_opt_in: newsletter === 'on',
      },
    },
  });

  if (error !== null) {
    const code = error.code ?? '';
    const kind: AuthErrorKind =
      code === 'user_already_exists' || code === 'email_address_invalid'
        ? 'email_taken'
        : error.status === 429
          ? 'rate_limited'
          : 'upstream';
    redirectWithError(locale, '/compte/inscription', kind, email);
  }

  // Email confirmation required: send the user to a confirmation-pending page
  // (reuses the sign-in screen with a banner).
  redirect({
    href: { pathname: '/compte/connexion', query: { pending: '1' } },
    locale,
  });
}

/* -------------------------------------------------------------------------- */
/* Sign-out                                                                   */
/* -------------------------------------------------------------------------- */

export async function signOutAction(formData: FormData): Promise<void> {
  const parsed = SignOutSchema.safeParse({ locale: readField(formData, 'locale') });
  const locale: AccountLocale = parsed.success ? parsed.data.locale : 'fr';

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect({ href: '/compte/connexion', locale });
}

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = ForgotSchema.safeParse({
    email: readField(formData, 'email'),
    locale: readField(formData, 'locale'),
  });
  if (!parsed.success) {
    const email = readField(formData, 'email');
    const locale = (readField(formData, 'locale') as AccountLocale | undefined) ?? 'fr';
    redirectWithError(locale, '/compte/mot-de-passe-oublie', 'invalid_input', email);
  }

  const { email, locale } = parsed.data;
  const headerList = await headers();
  const origin = originFromHeaders(headerList);
  const redirectTo = callbackUrlFor(origin, locale, '/compte/nouveau-mot-de-passe');

  const supabase = await createSupabaseServerClient();
  // Always redirect to the "check your inbox" screen — we never reveal whether
  // the email is registered (anti-enumeration). Errors are logged server-side.
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error !== null && process.env['NODE_ENV'] !== 'production') {
    console.warn('[forgotPasswordAction] reset email error', error.message);
  }
  redirect({
    href: { pathname: '/compte/mot-de-passe-oublie', query: { sent: '1' } },
    locale,
  });
}

/* -------------------------------------------------------------------------- */
/* Reset password (after recovery callback opened a session)                  */
/* -------------------------------------------------------------------------- */

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const parsed = ResetSchema.safeParse({
    password: readField(formData, 'password'),
    confirmPassword: readField(formData, 'confirmPassword'),
    locale: readField(formData, 'locale'),
  });
  if (!parsed.success) {
    const locale = (readField(formData, 'locale') as AccountLocale | undefined) ?? 'fr';
    redirectWithError(locale, '/compte/nouveau-mot-de-passe', 'invalid_input');
  }

  const { password, confirmPassword, locale } = parsed.data;
  if (password !== confirmPassword) {
    redirectWithError(locale, '/compte/nouveau-mot-de-passe', 'password_mismatch');
  }

  const supabase = await createSupabaseServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    redirectWithError(locale, '/compte/connexion', 'session_missing');
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error !== null) {
    const kind: AuthErrorKind = error.status === 429 ? 'rate_limited' : 'upstream';
    redirectWithError(locale, '/compte/nouveau-mot-de-passe', kind);
  }

  redirect({
    href: { pathname: '/compte', query: { reset: '1' } },
    locale,
  });
}
