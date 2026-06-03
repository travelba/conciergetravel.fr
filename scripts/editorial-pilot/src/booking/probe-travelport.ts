/**
 * Probe Travelport (lecture seule) — Étape 0 du plan « Travelport Phase 6 e2e ».
 *
 * Objectif : valider en réel, sur une petite sélection de palaces parisiens
 * tirés du catalogue Supabase, que :
 *   - l'OAuth password+openid Travelport fonctionne ;
 *   - `SearchComplete` v12 renvoie des propriétés pour nos coordonnées ;
 *   - on récupère bien un prix le plus bas (et la dispo) par hôtel ;
 *   - on peut rapprocher chaque hôtel du catalogue à une propriété Travelport
 *     (par distance + nom) et donc découvrir les `chainCode/propertyCode`
 *     qui alimenteront l'allow-list de l'échantillon.
 *
 * Aucune écriture en base, aucun appel de booking. Un seul `SearchComplete`
 * par hôtel (le rapprochement réutilise la réponse déjà obtenue). Les réponses
 * brutes sont dumpées sur disque pour inspection (chambres, plans tarifaires,
 * politiques d'annulation).
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot travelport:probe -- --limit=8
 *
 * Flags : --limit, --checkin, --checkout, --nights, --adults, --radius,
 *         --currency, --slugs=slug-a,slug-b, --no-raw.
 *
 * Skills : api-integration, redis-caching, windows-dev-environment.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  searchByCoordinates,
  uniqueProperties,
  normalizeName,
  haversineMeters,
  type PropertyItem,
  type SearchCompleteResponse,
  type TravelportCredentials,
} from '@mch/integrations/travelport';
import type { IntegrationRedis } from '@mch/integrations/redis';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const OUT_DIR = resolve(__dirname, '../../out/travelport-probe');

const EnvSchema = z.object({
  TRAVELPORT_AUTH_URL: z.string().url(),
  TRAVELPORT_API_BASE: z.string().url(),
  TRAVELPORT_USERNAME: z.string().min(1),
  TRAVELPORT_PASSWORD: z.string().min(1),
  TRAVELPORT_CLIENT_ID: z.string().min(1),
  TRAVELPORT_CLIENT_SECRET: z.string().min(1),
  TRAVELPORT_PCC: z.string().min(1),
  TRAVELPORT_ACCESS_GROUP: z.string().min(1),
  TRAVELPORT_CURRENCY: z.string().length(3).default('EUR'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

type ProbeEnv = z.infer<typeof EnvSchema>;

interface CliOptions {
  readonly limit: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly radiusMi: number;
  readonly currency: string;
  readonly slugs: readonly string[];
  readonly dumpRaw: boolean;
}

interface CatalogHotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly city: string | null;
}

interface ProbeRow {
  readonly slug: string;
  readonly name: string;
  readonly status: 'present' | 'absent' | 'error';
  readonly travelportName?: string;
  readonly chainCode?: string;
  readonly propertyCode?: string;
  readonly distanceMeters?: number;
  readonly available?: boolean;
  readonly lowestPriceAmount?: number;
  readonly lowestPriceCurrency?: string;
  readonly propertyItemsCount?: number;
  readonly error?: string;
}

/**
 * Double Redis en mémoire pour le probe (évite une dépendance Upstash réelle).
 * Les méthodes d'Upstash sont fortement surchargées/génériques ; on type le
 * double via un cast unique, conformément à l'usage des doubles de test.
 */
function createMemoryRedis(): IntegrationRedis {
  const store = new Map<string, string>();
  const redis = {
    get: (key: string): Promise<string | null> => Promise.resolve(store.get(key) ?? null),
    set: (
      key: string,
      value: unknown,
      opts?: { readonly nx?: boolean; readonly ex?: number },
    ): Promise<string | null> => {
      if (opts?.nx === true && store.has(key)) return Promise.resolve(null);
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return Promise.resolve('OK');
    },
    del: (...keys: readonly string[]): Promise<number> => {
      let removed = 0;
      for (const k of keys) {
        if (store.delete(k)) removed += 1;
      }
      return Promise.resolve(removed);
    },
  };
  return redis as unknown as IntegrationRedis;
}

function addDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`);
  const d = new Date(ms + days * 86_400_000);
  const part = d.toISOString().slice(0, 10);
  return part;
}

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function parseArgs(argv: readonly string[]): CliOptions {
  const map = new Map<string, string>();
  let dumpRaw = true;
  for (const arg of argv) {
    if (arg === '--no-raw') {
      dumpRaw = false;
      continue;
    }
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m && m[1] !== undefined && m[2] !== undefined) map.set(m[1], m[2]);
  }

  const checkIn = map.get('checkin') ?? todayPlus(30);
  const nights = Number.parseInt(map.get('nights') ?? '1', 10);
  const checkOut =
    map.get('checkout') ?? addDays(checkIn, Number.isFinite(nights) ? Math.max(1, nights) : 1);
  const slugsRaw = map.get('slugs');

  return {
    limit: Math.max(1, Number.parseInt(map.get('limit') ?? '8', 10) || 8),
    checkIn,
    checkOut,
    adults: Math.max(1, Number.parseInt(map.get('adults') ?? '1', 10) || 1),
    radiusMi: Math.max(1, Number.parseFloat(map.get('radius') ?? '1') || 1),
    currency: (map.get('currency') ?? '').toUpperCase() || 'EUR',
    slugs: slugsRaw
      ? slugsRaw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [],
    dumpRaw,
  };
}

async function fetchParisPalaces(env: ProbeEnv, opts: CliOptions): Promise<CatalogHotelRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,slug,name,latitude,longitude,city');
  params.set('is_published', 'eq.true');
  params.set('latitude', 'not.is.null');
  params.set('longitude', 'not.is.null');
  params.set('limit', String(opts.limit));

  if (opts.slugs.length > 0) {
    params.set('slug', `in.(${opts.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  } else {
    // Palaces parisiens : is_palace true OU ville ilike Paris.
    params.set('or', '(is_palace.eq.true,city.ilike.*paris*)');
    params.set('order', 'is_palace.desc,name.asc');
  }

  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/hotels?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[probe-travelport] Supabase SELECT failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('[probe-travelport] Supabase did not return an array');

  const rows: CatalogHotelRow[] = [];
  for (const raw of json) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const id = r['id'];
    const slug = r['slug'];
    const name = r['name'];
    const latitude = r['latitude'];
    const longitude = r['longitude'];
    const city = r['city'];
    if (
      typeof id === 'string' &&
      typeof slug === 'string' &&
      typeof name === 'string' &&
      typeof latitude === 'number' &&
      typeof longitude === 'number'
    ) {
      rows.push({
        id,
        slug,
        name,
        latitude,
        longitude,
        city: typeof city === 'string' ? city : null,
      });
    }
  }
  return rows;
}

function bestMatch(
  hotel: CatalogHotelRow,
  resp: SearchCompleteResponse,
): { readonly item: PropertyItem; readonly distanceMeters: number } | null {
  const wanted = normalizeName(hotel.name);
  const props = uniqueProperties(resp);
  let best: PropertyItem | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestOverlap = 0;

  for (const it of props) {
    const center = it.propertyInfo?.geolocation?.center;
    if (center === undefined) continue;
    const distance = haversineMeters(
      hotel.latitude,
      hotel.longitude,
      center.latitude,
      center.longitude,
    );
    const overlap = [...normalizeName(it.name)].filter((t) => wanted.has(t)).length;
    if (
      overlap > 0 &&
      (overlap > bestOverlap || (overlap === bestOverlap && distance < bestDistance))
    ) {
      bestOverlap = overlap;
      bestDistance = distance;
      best = it;
    }
  }
  if (best === undefined) return null;
  return { item: best, distanceMeters: Math.round(bestDistance) };
}

function lowestRate(item: PropertyItem): { amount?: number; currency?: string } {
  const rate = item.lowestPublicAvailableRate;
  if (rate === undefined) return {};
  // Forme réelle SearchComplete v12 : totalPrice.amount + currencyCode.
  // (fallback sur l'ancienne forme total.amount/total.currency)
  const amount = rate.totalPrice?.amount ?? rate.total?.amount;
  const currency = rate.currencyCode ?? rate.total?.currency;
  return {
    ...(amount !== undefined ? { amount } : {}),
    ...(currency !== undefined ? { currency } : {}),
  };
}

async function probeHotel(
  creds: TravelportCredentials,
  hotel: CatalogHotelRow,
  opts: CliOptions,
): Promise<ProbeRow> {
  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: opts.radiusMi,
    unit: 'mi',
    checkInDate: opts.checkIn,
    checkOutDate: opts.checkOut,
    adults: opts.adults,
    currency: opts.currency,
  });

  if (!search.ok) {
    return {
      slug: hotel.slug,
      name: hotel.name,
      status: 'error',
      error: JSON.stringify(search.error),
    };
  }

  if (opts.dumpRaw) {
    writeFileSync(
      resolve(OUT_DIR, 'raw', `${hotel.slug}.json`),
      JSON.stringify(search.value, null, 2),
      'utf8',
    );
  }

  const count = search.value.hotelsResponse.propertyItems.length;
  const match = bestMatch(hotel, search.value);
  if (match === null) {
    return { slug: hotel.slug, name: hotel.name, status: 'absent', propertyItemsCount: count };
  }

  const price = lowestRate(match.item);
  return {
    slug: hotel.slug,
    name: hotel.name,
    status: 'present',
    travelportName: match.item.name,
    chainCode: match.item.chainCode,
    propertyCode: match.item.propertyCode,
    distanceMeters: match.distanceMeters,
    ...(match.item.availability !== undefined ? { available: match.item.availability } : {}),
    ...(price.amount !== undefined ? { lowestPriceAmount: price.amount } : {}),
    ...(price.currency !== undefined ? { lowestPriceCurrency: price.currency } : {}),
    propertyItemsCount: count,
  };
}

function printRow(row: ProbeRow): void {
  if (row.status === 'error') {
    console.log(`  ✗ ${row.name} — ERREUR : ${row.error ?? 'inconnue'}`);
    return;
  }
  if (row.status === 'absent') {
    console.log(
      `  · ${row.name} — absent (${row.propertyItemsCount ?? 0} propriétés renvoyées, aucun match)`,
    );
    return;
  }
  const price =
    row.lowestPriceAmount !== undefined
      ? `${row.lowestPriceAmount} ${row.lowestPriceCurrency ?? ''}`.trim()
      : 'pas de tarif';
  const dispo = row.available === false ? ' [complet]' : '';
  console.log(
    `  ✓ ${row.name}${dispo} → ${row.travelportName ?? '?'} ` +
      `[${row.chainCode ?? '?'}/${row.propertyCode ?? '?'}] ` +
      `${row.distanceMeters ?? '?'} m · ${price}`,
  );
}

async function main(): Promise<void> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`[probe-travelport] Environnement invalide (.env.local) :\n${issues}`);
  }
  const env = parsed.data;
  const opts = parseArgs(process.argv.slice(2));

  mkdirSync(resolve(OUT_DIR, 'raw'), { recursive: true });

  const creds: TravelportCredentials = {
    authUrl: env.TRAVELPORT_AUTH_URL,
    apiBaseUrl: env.TRAVELPORT_API_BASE,
    clientId: env.TRAVELPORT_CLIENT_ID,
    clientSecret: env.TRAVELPORT_CLIENT_SECRET,
    username: env.TRAVELPORT_USERNAME,
    password: env.TRAVELPORT_PASSWORD,
    accessGroup: env.TRAVELPORT_ACCESS_GROUP,
    pcc: env.TRAVELPORT_PCC,
    redis: createMemoryRedis(),
  };

  console.log('[probe-travelport] Sélection des hôtels…');
  const hotels = await fetchParisPalaces(env, opts);
  console.log(
    `[probe-travelport] ${hotels.length} hôtel(s) · séjour ${opts.checkIn} → ${opts.checkOut} · ` +
      `${opts.adults} adulte(s) · rayon ${opts.radiusMi} mi · devise ${opts.currency}\n`,
  );

  const rows: ProbeRow[] = [];
  for (const hotel of hotels) {
    const row = await probeHotel(creds, hotel, opts);
    rows.push(row);
    printRow(row);
  }

  const present = rows.filter((r) => r.status === 'present');
  const withPrice = present.filter((r) => r.lowestPriceAmount !== undefined);
  const errors = rows.filter((r) => r.status === 'error');

  const summary = {
    generatedAt: new Date().toISOString(),
    stay: {
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      adults: opts.adults,
      currency: opts.currency,
    },
    totals: {
      hotels: rows.length,
      present: present.length,
      absent: rows.filter((r) => r.status === 'absent').length,
      errors: errors.length,
      withPrice: withPrice.length,
    },
    sampleAllowList: present.map((r) => ({
      slug: r.slug,
      chainCode: r.chainCode,
      propertyCode: r.propertyCode,
    })),
    rows,
  };
  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(
    `\n[probe-travelport] Bilan : ${present.length}/${rows.length} présents, ` +
      `${withPrice.length} avec tarif, ${errors.length} erreur(s).`,
  );
  console.log(`[probe-travelport] Détails écrits dans ${OUT_DIR}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
