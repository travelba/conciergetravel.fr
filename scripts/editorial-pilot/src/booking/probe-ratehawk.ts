/**
 * Probe RateHawk / ETG (worldota) — Phase 0 spike du plan « catalogue
 * commandable multi-fournisseurs ».
 *
 * Objectif (lecture seule, sandbox) : valider en réel que
 *   - l'auth HTTP Basic KEY_ID:API_KEY fonctionne ;
 *   - `/api/content/v1/hotel_content_by_ids/` renvoie des `room_groups`
 *     (photos, amenities, `rg_ext`) pour un hôtel ETG ;
 *   - `/api/b2b/v3/search/hp/` renvoie des tarifs avec `rg_ext` + `book_hash` ;
 *   - le mapping DETERMINISTE chambre live <-> contenu statique via `rg_ext`
 *     est exploitable (taux de couverture).
 *
 * Aucune écriture en base, aucun prebook/book. Les réponses brutes + la
 * normalisation (NormalizedRate / NormalizedRoomStatic) sont dumpées pour
 * inspection.
 *
 * Pré-requis env (.env.local) : RATEHAWK_API_BASE (host root, ex.
 * https://api-sandbox.worldota.net), RATEHAWK_KEY_ID, RATEHAWK_API_KEY.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot ratehawk:probe -- --hotel-id=test_hotel
 *
 * Flags : --hotel-id (requis), --checkin, --checkout, --nights, --adults,
 *         --currency, --residency, --no-raw.
 *
 * Skills : api-integration, windows-dev-environment, llm-output-robustness.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createRateHawkConnector,
  fetchHotelContent,
  rgExtKey,
  searchHotelPage,
  type RateHawkClientConfig,
} from '@mch/integrations/ratehawk';
import type { SupplierPropertyKey } from '@mch/integrations/supplier';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const OUT_DIR = resolve(__dirname, '../../out/ratehawk-probe');

const EnvSchema = z.object({
  RATEHAWK_API_BASE: z.string().url(),
  RATEHAWK_KEY_ID: z.string().min(1),
  RATEHAWK_API_KEY: z.string().min(1),
});

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

function isoDateInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const parsedEnv = EnvSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    console.error(
      '[ratehawk:probe] env manquant. Requis : RATEHAWK_API_BASE, RATEHAWK_KEY_ID, RATEHAWK_API_KEY.',
    );
    console.error(
      parsedEnv.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  const hotelId = flag('hotel-id');
  if (hotelId === undefined || hotelId.length === 0) {
    console.error('[ratehawk:probe] --hotel-id=<etg_hotel_id> requis (ex: --hotel-id=test_hotel).');
    process.exitCode = 1;
    return;
  }

  const nights = Number.parseInt(flag('nights') ?? '2', 10);
  const checkin = flag('checkin') ?? isoDateInDays(30);
  const checkout = flag('checkout') ?? isoDateInDays(30 + (Number.isFinite(nights) ? nights : 2));
  const adults = Number.parseInt(flag('adults') ?? '2', 10);
  const currency = flag('currency') ?? 'EUR';
  const residency = flag('residency') ?? 'fr';
  const dumpRaw = flag('no-raw') !== 'true';

  const cfg: RateHawkClientConfig = {
    baseUrl: parsedEnv.data.RATEHAWK_API_BASE,
    keyId: parsedEnv.data.RATEHAWK_KEY_ID,
    apiKey: parsedEnv.data.RATEHAWK_API_KEY,
  };
  const connector = createRateHawkConnector(cfg);
  const propertyKey: SupplierPropertyKey = { supplier: 'ratehawk', hotelId };

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[ratehawk:probe] hotel=${hotelId} ${checkin} -> ${checkout} adults=${adults}`);

  // 1. Static content (room_groups + rg_ext).
  const content = await fetchHotelContent(cfg, [hotelId]);
  if (!content.ok) {
    console.error(`[ratehawk:probe] content KO: ${content.error.kind}`, content.error);
  } else {
    const groups = content.value.data?.hotels?.[0]?.room_groups ?? [];
    console.log(`[ratehawk:probe] content OK — ${groups.length} room_groups.`);
    if (dumpRaw) {
      writeFileSync(
        resolve(OUT_DIR, `${hotelId}-content.json`),
        JSON.stringify(content.value, null, 2),
      );
    }
  }

  const staticContent = await connector.getStaticRoomContent({ propertyKey });
  const staticRooms = staticContent.ok ? staticContent.value : [];
  const contentRgKeys = new Set(
    staticRooms.map((r) => rgExtKey(r.roomKey.supplier === 'ratehawk' ? r.roomKey.rgExt : {})),
  );
  console.log(`[ratehawk:probe] normalized static rooms: ${staticRooms.length}`);

  // 2. Live search (hotelpage).
  const search = await searchHotelPage(cfg, hotelId, {
    checkin,
    checkout,
    adults,
    currency,
    residency,
  });
  if (!search.ok) {
    console.error(`[ratehawk:probe] search KO: ${search.error.kind}`, search.error);
  } else {
    const rates = search.value.data?.hotels?.[0]?.rates ?? [];
    console.log(`[ratehawk:probe] search OK — ${rates.length} rates.`);
    if (dumpRaw) {
      writeFileSync(
        resolve(OUT_DIR, `${hotelId}-search.json`),
        JSON.stringify(search.value, null, 2),
      );
    }
  }

  const availability = await connector.searchAvailability({
    propertyKey,
    stay: { checkIn: checkin, checkOut: checkout, adults },
  });
  const normalizedRates = availability.ok ? availability.value : [];
  console.log(`[ratehawk:probe] normalized rates: ${normalizedRates.length}`);

  // 3. rg_ext mapping coverage : combien de tarifs live ont un room_group statique ?
  let matched = 0;
  for (const rate of normalizedRates) {
    if (rate.roomKey.supplier !== 'ratehawk') continue;
    if (contentRgKeys.has(rgExtKey(rate.roomKey.rgExt))) matched += 1;
  }
  const coverage =
    normalizedRates.length > 0 ? Math.round((matched / normalizedRates.length) * 100) : 0;
  console.log(
    `[ratehawk:probe] rg_ext coverage : ${matched}/${normalizedRates.length} tarifs liés à un room_group (${coverage}%).`,
  );

  if (dumpRaw) {
    writeFileSync(
      resolve(OUT_DIR, `${hotelId}-normalized.json`),
      JSON.stringify({ staticRooms, normalizedRates, coverage }, null, 2),
    );
  }
  console.log(`[ratehawk:probe] done. Dumps -> ${OUT_DIR}`);
}

main().catch((err: unknown) => {
  console.error('[ratehawk:probe] fatal', err);
  process.exitCode = 1;
});
