/**
 * Env loader specialized for `apps/web`. Uses `@t3-oss/env-nextjs` so that
 * client / server boundaries are statically enforced and unset client vars
 * fail the build.
 */
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_DB_URL: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    ALGOLIA_ADMIN_API_KEY: z.string().min(1),
    ALGOLIA_INDEX_PREFIX: z.string().default('dev_'),
    AMADEUS_ENV: z.enum(['test', 'production']),
    AMADEUS_API_KEY: z.string().min(1),
    AMADEUS_API_SECRET: z.string().min(1),
    AMADEUS_PAYMENT_WEBHOOK_SECRET: z.string().min(1),
    LITTLE_HOTELIER_API_BASE: z.string().url(),
    LITTLE_HOTELIER_API_KEY: z.string().min(1),
    // Travelport (Stays) — pilote sandbox Phase 6. Optionnel : l'app démarre
    // sans ces variables tant que TRAVELPORT_SANDBOX_ENABLED est faux. La
    // factory (apps/web/src/lib/travelport.ts) valide leur présence à l'usage.
    TRAVELPORT_SANDBOX_ENABLED: z.coerce.boolean().default(false),
    TRAVELPORT_AUTH_URL: z.string().url().optional(),
    TRAVELPORT_API_BASE: z.string().url().optional(),
    TRAVELPORT_USERNAME: z.string().optional(),
    TRAVELPORT_PASSWORD: z.string().optional(),
    TRAVELPORT_CLIENT_ID: z.string().optional(),
    TRAVELPORT_CLIENT_SECRET: z.string().optional(),
    TRAVELPORT_PCC: z.string().optional(),
    TRAVELPORT_ACCESS_GROUP: z.string().optional(),
    TRAVELPORT_CURRENCY: z.string().length(3).default('EUR'),
    /** Allow-list de slugs hôtels éligibles au sandbox (séparés par virgule). */
    TRAVELPORT_SAMPLE_SLUGS: z.string().optional(),
    // RateHawk (ETG/worldota) — optionnel ; orchestrateur multi-fournisseurs.
    RATEHAWK_ENABLED: z.coerce.boolean().default(false),
    RATEHAWK_API_BASE: z.string().url().optional(),
    RATEHAWK_KEY_ID: z.string().optional(),
    RATEHAWK_API_KEY: z.string().optional(),
    // Little Emperors — canal principal luxe (ADR-0026).
    LITTLE_EMPERORS_ENABLED: z.coerce.boolean().default(false),
    LITTLE_EMPERORS_API_BASE: z.string().url().optional(),
    LITTLE_EMPERORS_API_KEY: z.string().optional(),
    // GIATA Multicodes — identité propriété + crosswalk fournisseurs.
    GIATA_ENABLED: z.coerce.boolean().default(false),
    GIATA_MC_BASE_URL: z.string().url().optional(),
    GIATA_MC_USERNAME: z.string().optional(),
    GIATA_MC_PASSWORD: z.string().optional(),
    GIATA_MC_API_VERSION: z.string().default('1.latest'),
    GIATA_API_BASE: z.string().url().optional(),
    GIATA_API_KEY: z.string().optional(),
    GIATA_API_PREFIX: z.string().optional(),
    GIATA_RTM_ENABLED: z.coerce.boolean().default(false),
    GIATA_RTM_BASE_URL: z.string().url().optional(),
    GIATA_RTM_USERNAME: z.string().optional(),
    GIATA_RTM_PASSWORD: z.string().optional(),
    GIATA_RTM_USE_MAP_PLUS: z.coerce.boolean().default(true),
    // Kill-switch de l'orchestrateur rate-shopping multi-fournisseurs sur la
    // fiche/tunnel. OFF par défaut : aucune requête DB supplémentaire sur les
    // ~2200 fiches tant que des connexions fournisseurs ne sont pas seedées.
    MULTI_SUPPLIER_RATESHOPPING_ENABLED: z.coerce.boolean().default(false),
    /** Carte de test sandbox pour la garantie/dépôt (jamais en production). */
    TRAVELPORT_TEST_CARD_CODE: z.string().optional(),
    TRAVELPORT_TEST_CARD_NUMBER: z.string().optional(),
    TRAVELPORT_TEST_CARD_EXPIRE: z.string().optional(),
    TRAVELPORT_TEST_CARD_CVV: z.string().optional(),
    TRAVELPORT_TEST_CARD_HOLDER: z.string().optional(),
    MAKCORPS_API_BASE: z.string().url(),
    MAKCORPS_API_KEY: z.string().min(1),
    MAKCORPS_DAILY_QUOTA: z.coerce.number().int().positive().default(10000),
    APIFY_API_TOKEN: z.string().optional(),
    APIFY_HOTEL_ACTOR_ID: z.string().optional(),
    GOOGLE_PLACES_API_KEY: z.string().min(1),
    BREVO_API_KEY: z.string().min(1),
    BREVO_SENDER_EMAIL: z.string().email(),
    BREVO_SENDER_NAME: z.string().min(1),
    BREVO_INTERNAL_OPS_EMAIL: z.string().email(),
    SENTRY_ENV: z.enum(['dev', 'preview', 'staging', 'production']).default('dev'),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(16),
    REVALIDATE_SECRET: z.string().min(16),
    DATADOG_ENABLED: z.coerce.boolean().default(false),
    LOYALTY_PREMIUM_BILLING_ENABLED: z.coerce.boolean().default(false),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_SITE_NAME: z.string().default('MyConciergeHotel'),
    NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'en']).default('fr'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_ALGOLIA_APP_ID: z.string().min(1),
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    /**
     * Cloudinary cloud (e.g. "dvbjwh5wy") used to build delivery URLs.
     * Appears verbatim in every `https://res.cloudinary.com/<cloud>/…`
     * URL — not a secret. Required client-side for `<HotelImage>` /
     * `<HotelGallery>` / `<HomeHeroVideo>`.
     *
     * Defaults to the canonical Travelba cloud `dvbjwh5wy` so the
     * production build never renders `https://res.cloudinary.com/undefined/…`
     * even if the Vercel project env var is unset (which it currently is —
     * audit 2026-05-27 surfaced /undefined/ in every Cloudinary URL once
     * the home redesign moved hotel photos to a `cloudName`-driven path).
     * To swap clouds, set the env var; the default is a last-resort
     * fallback, not a recommendation.
     */
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1).default('dvbjwh5wy'),
    /**
     * Mapbox public token (`pk.*`) — Mapbox GL directory map + Static Images
     * on hotel fiches. Scoped to URL restrictions in the Mapbox dashboard.
     */
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().startsWith('pk.').optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'],
    NEXT_PUBLIC_SITE_NAME: process.env['NEXT_PUBLIC_SITE_NAME'],
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env['NEXT_PUBLIC_DEFAULT_LOCALE'],
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_ALGOLIA_APP_ID: process.env['NEXT_PUBLIC_ALGOLIA_APP_ID'],
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: process.env['NEXT_PUBLIC_ALGOLIA_SEARCH_KEY'],
    NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
    // Belt-and-suspenders fallback — when `skipValidation` is true the
    // Zod `.default()` above does NOT run, so the raw value reaches the
    // app as `undefined`. We coalesce here so call sites always receive
    // a usable cloud name. Empty strings are normalised to undefined by
    // `emptyStringAsUndefined` above, so `??` catches them too.
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
      process.env['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME'] ?? 'dvbjwh5wy',
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env['NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN'],
  },
  skipValidation:
    process.env['SKIP_ENV_VALIDATION'] === 'true' ||
    process.env['NEXT_PUBLIC_SKIP_ENV_VALIDATION'] === 'true',
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    // Since @t3-oss/env-nextjs v0.12 (Standard Schema migration) the callback
    // receives a readonly array of issues instead of a ZodError — so the old
    // `error.flatten()` no longer exists. Surface the offending field keys so
    // we can act on them in dev + CI instead of the default `[object Object]`.
    // eslint-disable-next-line no-console
    console.error('[env-web] Environment validation failed:\n' + JSON.stringify(issues, null, 2));
    const fields = Array.from(
      new Set(
        issues.flatMap((issue) => {
          const segment = issue.path?.[0];
          if (segment === undefined) return [];
          return [typeof segment === 'object' ? String(segment.key) : String(segment)];
        }),
      ),
    );
    throw new Error(`Invalid environment variables: ${fields.join(', ')}`);
  },
});
