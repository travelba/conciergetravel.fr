import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { Link, redirect } from '@/i18n/navigation';
import { isRoutingLocale } from '@/i18n/routing';
import { joinClubAction, sendMagicLinkAction, signInWithOAuthAction } from '@/server/auth/actions';
import { getOptionalUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

const ERROR_KINDS = new Set([
  'invalid_input',
  'email_taken',
  'rate_limited',
  'upstream',
  'oauth_unavailable',
  'magic_link_failed',
]);

interface JoinSearchParams {
  readonly email?: string;
  readonly error?: string;
  readonly pending?: string;
  readonly magic?: string;
  readonly next?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isRoutingLocale(raw)) return {};
  const t = await getTranslations({ locale: raw, namespace: 'account' });
  return {
    title: t('meta.joinClubTitle'),
    description: t('meta.joinClubDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function RejoindrePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<JoinSearchParams>;
}) {
  const [{ locale: raw }, sp] = await Promise.all([params, searchParams]);
  if (!isRoutingLocale(raw)) notFound();
  const locale = raw;
  setRequestLocale(locale);

  // Already signed-in users skip straight to the dashboard.
  const existing = await getOptionalUser();
  if (existing !== null) {
    redirect({ href: '/compte', locale });
  }

  const t = await getTranslations('account');
  const emailPrefill = typeof sp.email === 'string' ? sp.email : '';
  const errorKind = typeof sp.error === 'string' && ERROR_KINDS.has(sp.error) ? sp.error : null;
  const pending = sp.pending === '1';
  const magicSent = sp.magic === '1';
  const nextPath = typeof sp.next === 'string' ? sp.next : '';

  return (
    <main className="container mx-auto max-w-md px-4 py-12 sm:py-16">
      <p className="text-muted mb-2 text-xs uppercase tracking-[0.18em]">{t('joinClub.eyebrow')}</p>
      <h1 className="text-fg mb-2 font-serif text-3xl sm:text-4xl">{t('joinClub.title')}</h1>
      <p className="text-muted mb-6">{t('joinClub.subtitle')}</p>

      {pending ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {t('joinClub.pendingBanner')}
        </p>
      ) : null}

      {magicSent ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          {t('joinClub.magicLinkSent')}
        </p>
      ) : null}

      {errorKind !== null ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {t(`errors.${errorKind}`)}
        </p>
      ) : null}

      {/* -------------------------------------------------------------------- */}
      {/* OAuth — Google + Apple                                               */}
      {/* -------------------------------------------------------------------- */}
      <div className="mb-6 flex flex-col gap-2">
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value="google" />
          {nextPath.length > 0 ? <input type="hidden" name="next" value={nextPath} /> : null}
          <button
            type="submit"
            className="border-border bg-bg text-fg hover:bg-muted/10 focus-visible:ring-ring w-full rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('joinClub.oauthGoogle')}
          </button>
        </form>
        <form action={signInWithOAuthAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value="apple" />
          {nextPath.length > 0 ? <input type="hidden" name="next" value={nextPath} /> : null}
          <button
            type="submit"
            className="border-border bg-bg text-fg hover:bg-muted/10 focus-visible:ring-ring w-full rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('joinClub.oauthApple')}
          </button>
        </form>
      </div>

      <p
        className="text-muted mb-4 flex items-center gap-2 text-center text-xs uppercase tracking-[0.14em]"
        aria-hidden="true"
      >
        <span className="bg-border h-px flex-1" />
        <span>{t('joinClub.oauthOr')}</span>
        <span className="bg-border h-px flex-1" />
      </p>

      {/* -------------------------------------------------------------------- */}
      {/* 3-field email + password signup                                      */}
      {/* -------------------------------------------------------------------- */}
      <form action={joinClubAction} className="flex flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        {nextPath.length > 0 ? <input type="hidden" name="next" value={nextPath} /> : null}
        {/* honeypot — bots will fill it, humans won't see it */}
        <label className="sr-only" htmlFor="website">
          {t('shared.honeypotLabel')}
        </label>
        <input
          id="website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{t('shared.email')}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            defaultValue={emailPrefill}
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{t('shared.password')}</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
          <span className="text-muted text-xs">{t('shared.passwordHint')}</span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-fg font-medium">{t('joinClub.firstName')}</span>
          <input
            type="text"
            name="firstName"
            autoComplete="given-name"
            maxLength={80}
            className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
          />
        </label>

        <button
          type="submit"
          className="bg-fg text-bg focus-visible:ring-ring rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 focus-visible:outline-none focus-visible:ring-2"
        >
          {t('joinClub.submit')}
        </button>
      </form>

      {/* -------------------------------------------------------------------- */}
      {/* Magic link — reuses the same email field via JS-less form trick      */}
      {/* -------------------------------------------------------------------- */}
      <div className="mt-6 border-t pt-6">
        <p className="text-muted mb-2 text-xs">{t('joinClub.magicLinkHint')}</p>
        <form action={sendMagicLinkAction} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          {nextPath.length > 0 ? <input type="hidden" name="next" value={nextPath} /> : null}
          <label className="sr-only" htmlFor="magic-website">
            {t('shared.honeypotLabel')}
          </label>
          <input
            id="magic-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
          />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-fg font-medium">{t('shared.email')}</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              defaultValue={emailPrefill}
              className="border-border bg-bg text-fg focus-visible:ring-ring rounded-md border px-3 py-2 outline-none focus-visible:ring-2"
            />
          </label>
          <button
            type="submit"
            className="border-fg text-fg hover:bg-fg hover:text-bg focus-visible:ring-ring rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2"
          >
            {t('joinClub.magicLinkCta')}
          </button>
        </form>
      </div>

      <p className="text-muted mt-6 text-xs">{t('joinClub.disclaimer')}</p>

      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/compte/connexion" className="text-muted hover:text-fg underline">
          {t('joinClub.haveAccount')}
        </Link>
      </div>
    </main>
  );
}
