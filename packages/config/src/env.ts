/**
 * Shared env loader (server-side, used by `apps/admin`, `packages/integrations`, `packages/db`).
 * The `apps/web` Next.js app uses `./env-web.ts` which adds NEXT_PUBLIC_* validation.
 *
 * Validation runs at module load time. If a required variable is missing or
 * invalid, the process fails fast — this is intentional (cf. CDC §11).
 */
import { z } from 'zod';

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const requiredUrl = z.string().url();

const SharedEnvSchema = z.object({
  // Public site
  NEXT_PUBLIC_SITE_URL: requiredUrl,
  NEXT_PUBLIC_SITE_NAME: z.string().default('MyConciergeHotel'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['fr', 'en']).default('fr'),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().min(1),
  SUPABASE_PROJECT_REF: z.string().optional(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: requiredUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Algolia
  NEXT_PUBLIC_ALGOLIA_APP_ID: z.string().min(1),
  NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: z.string().min(1),
  ALGOLIA_ADMIN_API_KEY: z.string().min(1),
  ALGOLIA_INDEX_PREFIX: z.string().default('dev_'),

  // Amadeus
  AMADEUS_ENV: z.enum(['test', 'production']).default('test'),
  AMADEUS_API_KEY: z.string().min(1),
  AMADEUS_API_SECRET: z.string().min(1),
  AMADEUS_PAYMENT_WEBHOOK_SECRET: z.string().min(1),

  // Little Hotelier
  LITTLE_HOTELIER_API_BASE: requiredUrl,
  LITTLE_HOTELIER_API_KEY: z.string().min(1),

  // Travelport (Stays / TripServices)
  TRAVELPORT_ENV: z.enum(['preprod', 'production']).default('preprod'),
  TRAVELPORT_AUTH_URL: requiredUrl, // https://auth.pp.travelport.net/oauth/token
  TRAVELPORT_API_BASE: requiredUrl, // https://api.pp.travelport.net
  TRAVELPORT_USERNAME: z.string().min(1),
  TRAVELPORT_PASSWORD: z.string().min(1),
  TRAVELPORT_CLIENT_ID: z.string().min(1),
  TRAVELPORT_CLIENT_SECRET: z.string().min(1),
  TRAVELPORT_PCC: z.string().min(1),
  TRAVELPORT_ACCESS_GROUP: z.string().min(1),
  TRAVELPORT_CURRENCY: z.string().default('GBP'),

  // RateHawk (Emerging Travel Group / worldota) — optional: only set once the
  // connector is enabled for a hotel. HTTP Basic auth (KEY_ID:API_KEY).
  RATEHAWK_ENABLED: z.coerce.boolean().default(false),
  RATEHAWK_API_BASE: optionalUrl, // host root, e.g. https://api-sandbox.worldota.net
  RATEHAWK_KEY_ID: z.string().optional(),
  RATEHAWK_API_KEY: z.string().optional(),

  // Little Emperors — primary luxury channel (API partnership — ADR-0026).
  LITTLE_EMPERORS_ENABLED: z.coerce.boolean().default(false),
  LITTLE_EMPERORS_API_BASE: optionalUrl,
  LITTLE_EMPERORS_API_KEY: z.string().optional(),

  // GIATA MultiCodes — property identity + supplier crosswalk (REST XML).
  GIATA_ENABLED: z.coerce.boolean().default(false),
  GIATA_MC_BASE_URL: optionalUrl,
  /** Format `user|company` per GIATA spec. */
  GIATA_MC_USERNAME: z.string().optional(),
  GIATA_MC_PASSWORD: z.string().optional(),
  GIATA_MC_API_VERSION: z.string().default('1.latest'),
  /** @deprecated Use GIATA_MC_* — kept for transitional scripts. */
  GIATA_API_BASE: optionalUrl,
  GIATA_API_KEY: z.string().optional(),
  GIATA_API_PREFIX: z.string().optional(),

  // GIATA Room Type Mapping (RTM) — dedupe supplier room labels at rate-shop time.
  GIATA_RTM_ENABLED: z.coerce.boolean().default(false),
  GIATA_RTM_BASE_URL: optionalUrl,
  GIATA_RTM_USERNAME: z.string().optional(),
  GIATA_RTM_PASSWORD: z.string().optional(),
  GIATA_RTM_USE_MAP_PLUS: z.coerce.boolean().default(true),

  // Multi-supplier rate-shopping orchestrator kill-switch (fiche/tunnel).
  MULTI_SUPPLIER_RATESHOPPING_ENABLED: z.coerce.boolean().default(false),

  // Makcorps + Apify
  MAKCORPS_API_BASE: requiredUrl,
  MAKCORPS_API_KEY: z.string().min(1),
  MAKCORPS_DAILY_QUOTA: z.coerce.number().int().positive().default(10000),
  APIFY_API_TOKEN: z.string().optional(),
  APIFY_HOTEL_ACTOR_ID: z.string().optional(),

  // Google Places
  GOOGLE_PLACES_API_KEY: z.string().min(1),

  // Brevo
  BREVO_API_KEY: z.string().min(1),
  BREVO_SENDER_EMAIL: z.string().email(),
  BREVO_SENDER_NAME: z.string().default('MyConciergeHotel'),
  BREVO_INTERNAL_OPS_EMAIL: z.string().email(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_ENV: z.enum(['dev', 'preview', 'staging', 'production']).default('dev'),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Cron / interne
  CRON_SECRET: z.string().min(16),
  REVALIDATE_SECRET: z.string().min(16),

  // Feature flags
  DATADOG_ENABLED: z.coerce.boolean().default(false),
  LOYALTY_PREMIUM_BILLING_ENABLED: z.coerce.boolean().default(false),
});

export type SharedEnv = z.infer<typeof SharedEnvSchema>;

let cached: SharedEnv | undefined;

export function loadSharedEnv(source: NodeJS.ProcessEnv = process.env): SharedEnv {
  if (cached) return cached;
  const parsed = SharedEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Lazy accessor — validates env on first property read (not at module load).
 * Tests and tooling that only need types/utility functions can import this
 * module without triggering schema validation, which mirrors the t3-env
 * pattern used in `apps/web`.
 */
export const env: SharedEnv = new Proxy({} as SharedEnv, {
  get(_target, prop, receiver) {
    return Reflect.get(loadSharedEnv(), prop, receiver);
  },
  has(_target, prop) {
    return prop in loadSharedEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(loadSharedEnv());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(loadSharedEnv(), prop);
  },
});
