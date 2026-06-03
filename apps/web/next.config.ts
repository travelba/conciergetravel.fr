import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Bundle analyzer is opt-in (`ANALYZE=true pnpm --filter @mch/web build` or
// `pnpm --filter @mch/web analyze`). Skill: performance-engineering.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env['ANALYZE'] === 'true',
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Next 16 promoted `typedRoutes` out of `experimental` to a top-level
  // option; the old position now warns at boot.
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react', '@mch/ui'],
  },
  transpilePackages: [
    '@mch/ui',
    '@mch/seo',
    '@mch/domain',
    '@mch/emails',
    '@mch/db',
    '@mch/integrations',
  ],
  // Webpack fallback for `next build --webpack` / `next dev --webpack`.
  // Turbopack (the default since Next 16) resolves `./foo.js` -> `./foo.ts`
  // natively for `transpilePackages` sources, so this block is only consulted
  // when somebody opts back into the legacy webpack bundler.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
          },
          // RFC 8288: announce agent skills (cf. geo-llm-optimization skill)
          {
            key: 'Link',
            value: '</.well-known/agent-skills.json>; rel="agent-skills"',
          },
        ],
      },
      {
        // ACTION 4 (SEO/ISR) — CDN cache hint for hotel detail pages. Covers
        // the bare FR canonical (`/hotel/:slug`) and the prefixed EN locale
        // (`/en/hotel/:slug`) under `localePrefix: 'as-needed'`.
        //
        // ⚠ The route is currently `export const dynamic = 'force-dynamic'`
        // (per-request CSP nonce read via `headers()`), so Next emits its own
        // `no-store` Cache-Control and this hint only becomes effective once
        // the fiche moves to ISR — which requires swapping the per-request
        // nonce for build-time CSP hashes (see the comment block atop
        // `app/[locale]/hotel/[slug]/page.tsx`). Declared here so the policy
        // is ready the moment ISR is enabled.
        source: '/:locale(en)?/hotel/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Tunnel + account: noindex (prefixed locales: /en/reservation, /en/compte, /en/auth).
        source: '/:locale(fr|en)/(reservation|compte|auth)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        // FR is served without a locale prefix (next-intl as-needed mode), so
        // cover the bare paths too — otherwise the tunnel would be indexable
        // on the canonical FR URLs.
        source: '/(reservation|compte|auth)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
  async redirects() {
    // Anti-cannibalisation 301 redirects (cf. CDC arborescence + ADR seo).
    // Final list managed via Payload `Redirects` collection in Phase 8.
    return [
      {
        source: '/:locale(fr|en)/selection/lune-de-miel',
        destination: '/:locale/selection/romantiques-et-lune-de-miel',
        permanent: true,
      },
      {
        source: '/:locale(fr|en)/selection/ski',
        destination: '/:locale/selection/montagne',
        permanent: true,
      },
      {
        source: '/:locale(fr|en)/selection/plage-privee',
        destination: '/:locale/selection/bord-de-mer-et-plage',
        permanent: true,
      },
      // The bare `/itineraire` was a coming-soon stub; the canonical hub
      // is now plural `/itineraires` (parity with `/classements`,
      // `/guides`, `/hotels`). Permanent 308s for both prefixed (`/en/`)
      // and bare (FR canonical) variants — `localePrefix: 'as-needed'`
      // means FR is served without prefix, so `/itineraire` and
      // `/en/itineraire` both need their own redirect entry.
      {
        source: '/:locale(fr|en)/itineraire',
        destination: '/:locale/itineraires',
        permanent: true,
      },
      {
        source: '/itineraire',
        destination: '/itineraires',
        permanent: true,
      },
      // PO consolidation (2026-05-26): the standalone Prestige waitlist
      // page now lives as a `#prestige` anchor section on the main
      // /le-concierge-club landing. The 301s preserve every inbound
      // link, agent deep-link, llms.txt entry, ad campaign URL, and
      // social share that pointed at the old route.
      //
      // Hash fragments in `destination`: Next.js forwards the
      // `#prestige` fragment in the `Location` header. All evergreen
      // browsers (per RFC 7231 §7.1.2) honour the fragment on 301/308
      // by scrolling to the anchor after the redirect lands.
      {
        source: '/:locale(fr|en)/le-concierge-club/prestige',
        destination: '/:locale/le-concierge-club#prestige',
        permanent: true,
      },
      {
        source: '/le-concierge-club/prestige',
        destination: '/le-concierge-club#prestige',
        permanent: true,
      },
      {
        source: '/en/the-concierge-club/prestige',
        destination: '/en/the-concierge-club#prestige',
        permanent: true,
      },
    ];
  },
};

/**
 * Sentry wraps the outer layer so the Next.js build emits source maps and the
 * SDK can upload them at build time (skill: observability-monitoring).
 *
 * `tunnelRoute: '/monitoring'` routes browser beacons through our origin to
 * bypass adblockers — the matching path is already excluded from the
 * `proxy.ts` matcher.
 *
 * `silent: !CI` keeps local builds quiet; CI gets full upload logs. The auth
 * token is optional: when missing (CI smoke build, dev) no upload happens and
 * the wrapper degrades to plain `withNextIntl(nextConfig)` semantics.
 *
 * In `next dev` we skip the wrapper entirely: Sentry's webpack plugin injects
 * a Sentry import into the edge `instrumentation` bundle, and webpack dev's
 * `eval`-based source maps trigger `EvalError: Code generation from strings
 * disallowed` inside the edge runtime. The wrapper still runs for `next build`
 * (production), which is what matters for SDK source-map upload.
 */
const sentryAuthToken = process.env['SENTRY_AUTH_TOKEN'];
const isDev = process.env['NODE_ENV'] !== 'production';

const baseConfig = withBundleAnalyzer(withNextIntl(nextConfig));

// Skip the Sentry wrapper when the auth token is missing — otherwise the
// post-build sourcemap upload step crashes silently (visible only as
// "Collecting build traces ..." → Error) on Vercel preview builds where
// Sentry credentials are intentionally not provisioned.
const shouldWrapSentry = !isDev && sentryAuthToken !== undefined && sentryAuthToken.length > 0;

export default shouldWrapSentry
  ? withSentryConfig(baseConfig, {
      org: 'travelba',
      project: 'mch-web',
      authToken: sentryAuthToken,
      silent: process.env['CI'] !== 'true',
      widenClientFileUpload: true,
      disableLogger: true,
      tunnelRoute: '/monitoring',
      reactComponentAnnotation: { enabled: true },
      telemetry: false,
    })
  : baseConfig;
