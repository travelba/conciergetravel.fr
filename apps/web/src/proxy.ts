import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { matchLegacyEnRedirect } from '@/i18n/legacy-en-redirects';
import { routing } from '@/i18n/routing';
import { buildCspHeader, generateNonce, NONCE_HEADER } from '@/lib/security/csp';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware(routing);

const IS_DEV = process.env['NODE_ENV'] !== 'production';

/**
 * Network-boundary proxy. Formerly `middleware`/`middleware.ts` in
 * Next.js 15; Next.js 16 renamed the convention to `proxy`/`proxy.ts`
 * to clarify it as a thin network gateway (no heavy app logic).
 *
 * Pipeline:
 *   0. Legacy `/en/<old-fr-slug>` -> canonical `/en/<localised-slug>` 301
 *   1. Per-request CSP nonce
 *   1b. Expose pathname to RSCs via `x-pathname`
 *   2. next-intl routing
 *   3. Supabase session refresh
 *   4. Security headers (CSP)
 *   5. Agent-skills discovery Link header
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // 0. Legacy EN URL redirects (i18n V2 — Phase 2).
  //    Before Phase 2 the FR slugs (`/en/recherche`, `/en/compte`,
  //    `/en/reservation/...`, `/en/cgv`, …) were served under the
  //    `/en/` prefix. Phase 2 introduced localised slugs via the typed
  //    `routing.pathnames` map (`/en/search`, `/en/account`,
  //    `/en/booking/...`, `/en/terms`, …). External signals — Google
  //    index entries, social shares, bookmarks, sitemaps already
  //    crawled — may still hit the legacy path. Issue a permanent 301
  //    so link equity collapses onto the canonical localised URL.
  //
  //    The 301 must fire BEFORE the next-intl middleware so the latter
  //    does not transparently rewrite the legacy slug back to its
  //    matching `/[locale]/...` route. Query string is preserved
  //    verbatim; the fragment never reaches the server.
  const legacyTarget = matchLegacyEnRedirect(request.nextUrl.pathname);
  if (legacyTarget !== null) {
    const redirectUrl = new URL(legacyTarget, request.nextUrl);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // 1. Per-request CSP nonce. We mutate the inbound NextRequest's Headers
  //    object so downstream `headers().get('x-nonce')` calls in RSCs see it.
  //    Next.js' bundled inline scripts also pick this up automatically and
  //    receive the nonce attribute at SSR time.
  const nonce = generateNonce();
  const csp = buildCspHeader({ nonce, isDev: IS_DEV });
  request.headers.set(NONCE_HEADER, nonce);

  // 1b. Expose the current pathname to Server Components via a custom
  //     request header. Used by `<Breadcrumb>` (ADR-0014 §2.4) to render
  //     the visible fil d'ariane mirror of the `BreadcrumbList` JSON-LD.
  //     Next.js does not expose `usePathname()` in Server Components, and
  //     reading from `headers()` is the canonical workaround.
  request.headers.set('x-pathname', request.nextUrl.pathname);

  // 2. i18n routing (next-intl). Locale detection + cookie + EN/FR redirects.
  const intlResponse = intlMiddleware(request);

  // 3. Supabase session refresh (skill: auth-role-management). Passing the
  //    intl response as carry preserves any rewrite/redirect produced above.
  const finalResponse = await updateSession(request, intlResponse);

  // 4. Security headers on the outbound response. CSP enforces our threat
  //    model (skill: security-engineering). The `x-nonce` echo is exposed so
  //    tests / debug tooling can inspect it; it is *not* a secret.
  finalResponse.headers.set('Content-Security-Policy', csp);
  finalResponse.headers.set(NONCE_HEADER, nonce);

  // 5. Agent-skills discovery (skill: geo-llm-optimization §Link Header
  //    WebMCP). Every HTML response advertises the machine-readable skill
  //    catalog so LLM crawlers can locate the action surface without
  //    parsing the page. The hreflang `Link` entries (set by next-intl
  //    via metadata) and this one coexist as separate comma-joined values.
  finalResponse.headers.append(
    'Link',
    '</.well-known/agent-skills.json>; rel="agent-skills"; type="application/json"',
  );

  return finalResponse;
}

export const config = {
  // Run on app routes only — skip static, _next, api/cron (handled separately), well-known.
  // `sitemaps` (no extension) covers every `sitemaps/*.xml` sub-sitemap;
  // without it next-intl rewrites them to `/fr/sitemaps/...` which 404s.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|sitemaps|llms.txt|llms-full.txt|.well-known|manifest.webmanifest|monitoring).*)',
  ],
};
