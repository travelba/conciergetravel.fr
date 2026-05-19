/**
 * Legacy EN URL redirects (i18n V2 — Phase 2 rollout).
 *
 * Phase 2 of the multilingual rollout (commits 75115dc + 5587056)
 * introduced locale-specific slugs for the UI / system routes via the
 * `routing.pathnames` map:
 *
 *   - `/recherche`         → served at `/en/search`
 *   - `/a-propos`          → served at `/en/about`
 *   - `/compte`            → served at `/en/account`
 *   - `/compte/connexion`  → served at `/en/account/sign-in`
 *   - `/compte/inscription` → served at `/en/account/sign-up`
 *   - `/reservation/*`     → served at `/en/booking/*`
 *   - `/cgv`               → served at `/en/terms`
 *   - `/confidentialite`   → served at `/en/privacy`
 *   - `/mentions-legales`  → served at `/en/legal-notice`
 *
 * Before Phase 2, the same content was served from the FR slug under
 * the `/en/` prefix (e.g. `/en/recherche`). External signals (Google
 * index entries, social shares, bookmarks, sitemaps already crawled)
 * still point at those legacy paths — we issue a 301 redirect so we
 * do not fragment link equity or strand users on a 404.
 *
 * The redirects are intentionally **prefix-shaped** rather than
 * exhaustive. We do not enumerate every leaf (`/en/compte/favoris`,
 * `/en/compte/nouveau-mot-de-passe`, …) — a single `/en/compte` entry
 * with the "+ suffix preserved" semantic handles the entire account
 * subtree consistently. A few suffixed targets (e.g.
 * `/en/account/connexion`) will not match a localized route and will
 * 404 in `/en` context, but that is preferable to keeping a stale FR
 * slug indexed under `/en/`. The most-clicked entry points (`/en/compte`,
 * `/en/reservation/start`) all resolve cleanly.
 *
 * Ordering: longest prefix first so a future overlapping entry never
 * shadows a more specific one (none today, cheap insurance).
 */
export const LEGACY_EN_PREFIX_REDIRECTS: ReadonlyArray<{
  readonly from: string;
  readonly to: string;
}> = [
  { from: '/en/mentions-legales', to: '/en/legal-notice' },
  { from: '/en/confidentialite', to: '/en/privacy' },
  { from: '/en/reservation', to: '/en/booking' },
  { from: '/en/a-propos', to: '/en/about' },
  { from: '/en/recherche', to: '/en/search' },
  { from: '/en/compte', to: '/en/account' },
  { from: '/en/cgv', to: '/en/terms' },
];

/**
 * Returns the new path for a legacy `/en/*` URL, or `null` when no
 * redirect applies.
 *
 * The match is segment-aware: `/en/compte` matches the bare path and
 * any path under it (`/en/compte/...`), but never a path that merely
 * starts with the same characters (`/en/comptez`). The trailing
 * segment is preserved verbatim so `/en/compte/connexion` redirects
 * to `/en/account/connexion`.
 *
 * Pure function — no I/O, no Next.js imports — safe to unit-test in
 * isolation from the middleware.
 */
export function matchLegacyEnRedirect(pathname: string): string | null {
  for (const { from, to } of LEGACY_EN_PREFIX_REDIRECTS) {
    if (pathname === from) return to;
    if (pathname.startsWith(`${from}/`)) {
      return `${to}${pathname.slice(from.length)}`;
    }
  }
  return null;
}
