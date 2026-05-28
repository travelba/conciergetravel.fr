/**
 * Throwaway helper — resolves the Google Places `placeId` for
 * "Le Bristol Paris" so migration 0064 can backfill it.
 *
 * Usage: pnpm -F @mch/editorial-pilot exec tsx src/photos/lookup-bristol-place-id.ts
 *
 * Why a script and not a migration: Place IDs are vendor-issued opaque
 * tokens; we resolve once, paste into the SQL migration, then ship.
 * Re-running is idempotent (Google returns the same ID for the same
 * canonical query).
 */
import { defaultPlacesConfig, searchPlaceByNameAndCity } from '@mch/integrations/google-places';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';

async function main(): Promise<void> {
  const env = loadPhotoEnv();
  requirePhotoEnv(env, { needsCloudinary: false, needsGooglePlaces: true });
  if (env.GOOGLE_PLACES_API_KEY === undefined) {
    throw new Error('GOOGLE_PLACES_API_KEY required');
  }
  const cfg = defaultPlacesConfig(env.GOOGLE_PLACES_API_KEY);

  const targets: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly city: string;
  }> = [{ slug: 'le-bristol-paris', name: 'Hôtel Le Bristol Paris', city: 'Paris' }];

  for (const target of targets) {
    const res = await searchPlaceByNameAndCity(cfg, target.name, target.city);
    if (!res.ok) {
      console.error(`[${target.slug}] lookup failed:`, res.error);
      continue;
    }
    console.log(
      JSON.stringify(
        {
          slug: target.slug,
          placeId: res.value.id,
          displayName: res.value.displayName?.text ?? null,
          formattedAddress: res.value.formattedAddress ?? null,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
