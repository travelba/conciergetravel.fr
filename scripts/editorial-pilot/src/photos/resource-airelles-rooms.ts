/**
 * One-shot high-resolution room photo sourcing for `les-airelles-gordes`.
 *
 * Why this exists (2026-06-09):
 *   The fiche template (template-hotel.html, Homepage 2) wires per-room
 *   mini-galleries from `hotel_rooms.images[]`. Six rooms had either no
 *   photo or a soft Google Places `places-*` hero (≤ 1600 px → upscaled).
 *   The official site (airelles.com) serves room visuals through the same
 *   Imgix CDN as the gallery (`?w=2600`), sources 2250–8000 px, so we pull
 *   genuine ≥ 2400 px frames, upload to Cloudinary (capped 2400 c_limit,
 *   no upscale) and repoint each room's `hero_image` + `images[]`.
 *
 * Legality: every URL is the hotel's OWN official Gordes page media,
 * photographer-credited (©VincentLeroux / ©BrettWood). Source = `press`
 * (official media kit) per photo-quality.mdc. No scraping of third parties.
 *
 * The two `*-village-side` rooms are already wired (press-6 / press-9 /
 * places-2/4) from the reuse pass and are intentionally NOT touched here.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-airelles-rooms.ts --dry-run   # verify URLs + print plan
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/photos/resource-airelles-rooms.ts             # upload + per-room DB patch
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique
 */

import { configureCloudinary, uploadFromUrl } from '@mch/integrations/cloudinary';

import { loadPhotoEnv, requirePhotoEnv } from './env-photos.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const SLUG = 'les-airelles-gordes';
const IMGIX_PREFIX = 'https://assets.airelles.com/images/airelles2023/';
const IMGIX_SUFFIX = '?auto=format%2Ccompress&w=2600';
/** Cloudinary public_id offset — keeps room frames clear of gallery press-1..12. */
const INDEX_OFFSET = 20;

interface RoomImage {
  /** Decoded Imgix filename (script percent-encodes it). */
  readonly file: string;
  readonly category: 'room' | 'suite' | 'detail';
  readonly altFr: string;
  readonly altEn: string;
  readonly credit: string;
}

interface CuratedRoom {
  readonly roomCode: string;
  readonly label: string;
  /** First image is the hero + first mini-gallery tile. */
  readonly images: readonly RoomImage[];
}

const CURATED_ROOMS: readonly CuratedRoom[] = [
  {
    roomCode: 'junior-suite-valley-side',
    label: 'Junior Suite Valley Side',
    images: [
      {
        file: 'Zfhuzw4qyfNhFxCz_BDG-JuniorSuite-Chambreavecvue.jpg',
        category: 'suite',
        altFr: 'Junior Suite côté vallée avec vue sur le Luberon, Airelles Gordes, Gordes',
        altEn: 'Valley-side Junior Suite with Luberon view, Airelles Gordes, Gordes',
        credit: 'Airelles',
      },
      {
        file: 'aiLC2weQX7-eW3dN_Moyen-BDG-JuniorSuite-SalledeBain-422-@VincentLeroux.jpg',
        category: 'detail',
        altFr: 'Salle de bain en pierre de la Junior Suite côté vallée, Airelles Gordes',
        altEn: 'Stone bathroom of the valley-side Junior Suite, Airelles Gordes',
        credit: 'Vincent Leroux',
      },
    ],
  },
  {
    roomCode: 'one-bedroom-suite-valley-side',
    label: 'One Bedroom Suite Valley Side',
    images: [
      {
        file: 'Znl3J5bWFbowezlX_LaBastide-Suite\u00e0uneChambreVall\u00e9e-322-Chambre-\u00a9\ufe0fBrettWood.jpg',
        category: 'suite',
        altFr: 'Chambre de la Suite à une Chambre côté vallée, Airelles Gordes, Gordes',
        altEn: 'Bedroom of the valley-side One Bedroom Suite, Airelles Gordes, Gordes',
        credit: 'Brett Wood',
      },
      {
        file: 'Znl3KJbWFbowezlZ_LaBastide-Suite\u00e0uneChambreVall\u00e9e-322-Salon-\u00a9\ufe0fBrettWood.jpg',
        category: 'suite',
        altFr: 'Salon de la Suite à une Chambre côté vallée, Airelles Gordes, Gordes',
        altEn: 'Living room of the valley-side One Bedroom Suite, Airelles Gordes, Gordes',
        credit: 'Brett Wood',
      },
    ],
  },
  {
    roomCode: 'prestige-junior-suite-valley-side',
    label: 'Prestige Junior Suite Valley Side',
    images: [
      {
        file: 'Zfh17Q4qyfNhFxGm_BDG-JuniorSuitePrestige-Chambre-2.jpg',
        category: 'suite',
        altFr: 'Chambre de la Junior Suite Prestige côté vallée, Airelles Gordes, Gordes',
        altEn: 'Bedroom of the valley-side Prestige Junior Suite, Airelles Gordes, Gordes',
        credit: 'Airelles',
      },
      {
        file: 'Zfh17A4qyfNhFxGl_BDGJuniorSuitePrestige-Salledebain.jpg',
        category: 'detail',
        altFr: 'Salle de bain de la Junior Suite Prestige côté vallée, Airelles Gordes',
        altEn: 'Bathroom of the valley-side Prestige Junior Suite, Airelles Gordes',
        credit: 'Airelles',
      },
    ],
  },
  {
    roomCode: 'vasarely-suite',
    label: 'Vasarely Suite',
    images: [
      {
        file: 'aVz0n3NYClf9o0Pw_BDG-SuiteVasarely-Chambre\u00a9VincentLeroux.jpg',
        category: 'suite',
        altFr: 'Chambre de la Suite Vasarely, Airelles Gordes, Gordes',
        altEn: 'Bedroom of the Vasarely Suite, Airelles Gordes, Gordes',
        credit: 'Vincent Leroux',
      },
      {
        file: 'aVzz7XNYClf9o0Pa_BDG-SuiteVasarely-Salon\u00a9VincentLeroux.jpg',
        category: 'suite',
        altFr: 'Salon de la Suite Vasarely, Airelles Gordes, Gordes',
        altEn: 'Living room of the Vasarely Suite, Airelles Gordes, Gordes',
        credit: 'Vincent Leroux',
      },
    ],
  },
  {
    roomCode: 'deluxe-room-valley-side',
    label: 'Deluxe Room Valley Side',
    // Single frame: the bathroom + alt-angle variants are 403-restricted on
    // the CDN. One crisp official room photo still beats the soft Google hero.
    images: [
      {
        file: 'ZfhqCQ4qyfNhFxAz_BDG-ChambreDeluxeVall\u00e9e-Chambreavecvue.jpg',
        category: 'room',
        altFr: 'Chambre Deluxe côté vallée avec vue sur le Luberon, Airelles Gordes, Gordes',
        altEn: 'Valley-side Deluxe room with Luberon view, Airelles Gordes, Gordes',
        credit: 'Airelles',
      },
    ],
  },
  {
    roomCode: 'superior-room-valley-side',
    label: 'Superior Room Valley Side',
    // Single frame: ©BrettWood La Bastide set is publicly served; the
    // ©VincentLeroux variants for this room are 403-restricted.
    images: [
      {
        file: 'ZnlndJbWFbowezYs_LaBastide-ChambreSup\u00e9rieureVall\u00e9e-122-Chambre-\u00a9\ufe0fBrettWood.jpg',
        category: 'room',
        altFr: 'Chambre Supérieure côté vallée, Airelles Gordes, Gordes',
        altEn: 'Valley-side Superior room, Airelles Gordes, Gordes',
        credit: 'Brett Wood',
      },
    ],
  },
];

interface RoomImageRow {
  readonly public_id: string;
  readonly alt_fr: string;
  readonly alt_en: string;
  readonly category: string;
}

function buildSourceUrl(file: string): string {
  return `${IMGIX_PREFIX}${encodeURIComponent(file)}${IMGIX_SUFFIX}`;
}

/** Patch a single `hotel_rooms` row by id via PostgREST (service role). */
async function patchRoomById(
  cfg: SupabaseRestConfig,
  roomId: string,
  body: Readonly<Record<string, unknown>>,
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotel_rooms?id=eq.${encodeURIComponent(roomId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`hotel_rooms PATCH failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

interface RoomRow {
  readonly id: string;
  readonly room_code: string;
}

async function fetchRooms(cfg: SupabaseRestConfig, hotelId: string): Promise<readonly RoomRow[]> {
  const url =
    `${cfg.url}/rest/v1/hotel_rooms?hotel_id=eq.${encodeURIComponent(hotelId)}` +
    `&select=id,room_code`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`hotel_rooms SELECT failed (${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('hotel_rooms SELECT did not return an array');
  return json as RoomRow[];
}

async function fetchHotelId(cfg: SupabaseRestConfig): Promise<string> {
  const rows = await selectHotels<{ id: string }>(cfg, {
    columns: 'id',
    filters: [`slug=eq.${SLUG}`],
    limit: 1,
  });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`[rooms] hotel not found: ${SLUG}`);
  return id;
}

/** HEAD-then-GET probe — Imgix `Moyen-…` variants sometimes 404 at w=2600. */
async function verifyUrl(url: string): Promise<{ ok: boolean; status: number; type: string }> {
  try {
    const res = await fetch(url, { method: 'GET' });
    const type = res.headers.get('content-type') ?? '';
    // Drain a tiny bit then bail — we only need the status + type.
    await res.body?.cancel();
    return { ok: res.ok && type.startsWith('image/'), status: res.status, type };
  } catch {
    return { ok: false, status: 0, type: 'fetch-error' };
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes('--dry-run');

  const photoEnv = loadPhotoEnv();
  requirePhotoEnv(photoEnv, { needsCloudinary: !dryRun, needsGooglePlaces: false });

  if (!dryRun) {
    const cloudName = photoEnv.CLOUDINARY_CLOUD_NAME;
    const apiKey = photoEnv.CLOUDINARY_API_KEY;
    const apiSecret = photoEnv.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('[rooms] Cloudinary creds missing despite requirePhotoEnv check');
    }
    configureCloudinary({ cloudName, apiKey, apiSecret });
  }

  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };

  const totalImages = CURATED_ROOMS.reduce((n, r) => n + r.images.length, 0);
  console.log(
    `[rooms] ${CURATED_ROOMS.length} rooms / ${totalImages} images — dry-run: ${dryRun ? 'YES' : 'NO'}`,
  );

  // Always verify every source URL first (cheap, surfaces 404s before upload).
  console.log('\n[rooms] verifying source URLs…');
  let allUrlsOk = true;
  for (const room of CURATED_ROOMS) {
    for (const img of room.images) {
      const url = buildSourceUrl(img.file);
      const probe = await verifyUrl(url);
      const mark = probe.ok ? 'OK ' : 'BAD';
      console.log(`  [${mark}] ${probe.status} ${probe.type} — ${room.roomCode} :: ${img.file}`);
      if (!probe.ok) allUrlsOk = false;
    }
  }
  if (!allUrlsOk) {
    throw new Error('[rooms] one or more source URLs failed verification — fix CURATED_ROOMS');
  }
  console.log('[rooms] all source URLs verified.');

  // Map roomCode → row id (only needed for the live patch).
  const hotelId = await fetchHotelId(cfg);
  const rows = await fetchRooms(cfg, hotelId);
  const idByCode = new Map(rows.map((r) => [r.room_code, r.id]));

  let globalIndex = INDEX_OFFSET;

  for (const room of CURATED_ROOMS) {
    const roomId = idByCode.get(room.roomCode);
    if (roomId === undefined) {
      throw new Error(`[rooms] room_code not found in DB: ${room.roomCode}`);
    }

    const imageRows: RoomImageRow[] = [];
    let heroPublicId: string | null = null;

    for (const img of room.images) {
      globalIndex += 1;
      const index = globalIndex;
      const sourceUrl = buildSourceUrl(img.file);

      if (dryRun) {
        const publicId = `cct/hotels/${SLUG}/press-${index}`;
        if (heroPublicId === null) heroPublicId = publicId;
        imageRows.push({
          public_id: publicId,
          alt_fr: img.altFr,
          alt_en: img.altEn,
          category: img.category,
        });
        continue;
      }

      const result = await uploadFromUrl({
        sourceUrl,
        hotelSlug: SLUG,
        source: 'press',
        index,
        altFr: img.altFr,
        altEn: img.altEn,
        category: img.category,
        extraTags: [
          'airelles-gordes-2026',
          `room-${room.roomCode}`,
          `credit-${img.credit.replace(/\s+/gu, '-')}`,
        ],
      });
      if (!result.ok) {
        console.error(
          `  ${room.roomCode} [${index}] UPLOAD FAILED: ${JSON.stringify(result.error)}`,
        );
        throw new Error(`[rooms] upload failed at index ${index}; aborting before DB patch`);
      }
      const publicId = result.value.public_id;
      console.log(
        `  ${room.roomCode} [${index}] OK ${publicId} — ${result.value.width}×${result.value.height}`,
      );
      if (heroPublicId === null) heroPublicId = publicId;
      imageRows.push({
        public_id: publicId,
        alt_fr: img.altFr,
        alt_en: img.altEn,
        category: img.category,
      });
    }

    console.log(`\n[rooms] ${room.label} (${room.roomCode})`);
    console.log(`  hero_image = ${heroPublicId}`);
    console.log(`  images = ${JSON.stringify(imageRows)}`);

    if (!dryRun && heroPublicId !== null) {
      await patchRoomById(cfg, roomId, { hero_image: heroPublicId, images: imageRows });
      console.log(`  → patched room ${roomId}`);
    }
  }

  if (dryRun) {
    console.log('\n[rooms] dry-run — no Cloudinary upload, no DB patch.');
    return;
  }
  console.log('\n[rooms] done. All six rooms patched.');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
