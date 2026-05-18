/**
 * Env loader for the photo ingestion pipeline.
 *
 * Distinct from `../env.ts` because the photo pipeline doesn't need
 * OPENAI/ANTHROPIC and DOES need Supabase + Cloudinary + (optionally)
 * Google Places — surfacing a focused error message when one of those
 * is missing.
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const optionalStr = (min: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z.string().min(min).optional(),
  );

/**
 * Note: every vendor key is `optional()` at the schema level so we can
 * load envs in dev / dry-run mode without all secrets configured. The
 * `requirePhotoEnv` helper enforces the right subset depending on what
 * the orchestrator actually intends to do (dry-run = Supabase only,
 * upload = Supabase + Cloudinary, --tier=all = + Google Places).
 */
const PhotoEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),

  CLOUDINARY_CLOUD_NAME: optionalStr(2),
  CLOUDINARY_API_KEY: optionalStr(10),
  CLOUDINARY_API_SECRET: optionalStr(10),
  GOOGLE_PLACES_API_KEY: optionalStr(20),
});

export type PhotoEnv = z.infer<typeof PhotoEnvSchema>;

export interface PhotoEnvRequirement {
  /** True when uploading to Cloudinary (i.e. NOT a `--dry-run`). */
  readonly needsCloudinary: boolean;
  /** True when fetching Google Places photos. */
  readonly needsGooglePlaces: boolean;
}

export function loadPhotoEnv(): PhotoEnv {
  const parsed = PhotoEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(
      `[photos] Missing or invalid env. Edit .env.local at the monorepo root:\n${issues}`,
    );
  }
  return parsed.data;
}

export function requirePhotoEnv(env: PhotoEnv, req: PhotoEnvRequirement): void {
  const missing: string[] = [];
  if (req.needsCloudinary) {
    if (env.CLOUDINARY_CLOUD_NAME === undefined) missing.push('CLOUDINARY_CLOUD_NAME');
    if (env.CLOUDINARY_API_KEY === undefined) missing.push('CLOUDINARY_API_KEY');
    if (env.CLOUDINARY_API_SECRET === undefined) missing.push('CLOUDINARY_API_SECRET');
  }
  if (req.needsGooglePlaces && env.GOOGLE_PLACES_API_KEY === undefined) {
    missing.push('GOOGLE_PLACES_API_KEY');
  }
  if (missing.length > 0) {
    throw new Error(
      `[photos] Missing env keys for this operation:\n  ${missing
        .map((k) => `- ${k}`)
        .join('\n  ')}\nAdd them to .env.local (or run with --dry-run to skip uploads).`,
    );
  }
}

/**
 * Builds a `postgres://` connection string from the Supabase URL + the
 * service-role key. The Supabase pg connection string format is:
 *   postgresql://postgres.{ref}:{password}@aws-0-{region}.pooler.supabase.com:5432/postgres
 * But we don't have those parts here — the script uses the Supabase
 * REST API (no direct pg) for the few SELECT/UPDATE we need. See
 * `supabase-rest.ts`.
 */
