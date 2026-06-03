/**
 * Booking e2e Travelport (sandbox) — Étape 2/5 du plan « Travelport Phase 6 ».
 *
 * Chaîne complète sur UN hôtel du catalogue :
 *   SearchComplete v12 → match catalogue → rateKey + prix
 *   → createReservation (carte de test sandbox + idempotency)
 *   → affiche les locators (supplier / agrégateur / agence) + statut
 *   → annulation optionnelle (--cancel) via le locator agrégateur.
 *
 * ⚠️ Sandbox preprod uniquement. Carte de test par défaut = carte DevKit
 * (VI 4444333322221111). Ne jamais lancer en production.
 *
 * Usage :
 *   pnpm --filter @mch/editorial-pilot travelport:book -- --slug=le-bristol-paris --cancel
 *
 * Flags : --slug (requis), --checkin, --checkout, --nights, --adults,
 *         --given, --surname, --email, --phone, --area, --cancel,
 *         --card, --card-code, --exp, --cvv, --holder.
 */
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cancelReservation,
  createReservation,
  haversineMeters,
  normalizeName,
  searchByCoordinates,
  uniqueProperties,
  type PropertyItem,
  type ReservationCardInput,
  type ReservationConfirmation,
  type ReservationGuestInput,
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
      for (const k of keys) if (store.delete(k)) removed += 1;
      return Promise.resolve(removed);
    },
  };
  return redis as unknown as IntegrationRedis;
}

function addDays(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function parseArgs(argv: readonly string[]): Map<string, string> & { has: (k: string) => boolean } {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m && m[1] !== undefined) {
      if (m[2] === undefined) flags.add(m[1]);
      else map.set(m[1], m[2]);
    }
  }
  return Object.assign(map, { has: (k: string) => flags.has(k) || map.has(k) });
}

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

async function fetchHotelBySlug(env: ProbeEnv, slug: string): Promise<HotelRow> {
  const params = new URLSearchParams();
  params.set('select', 'slug,name,latitude,longitude');
  params.set('slug', `eq.${slug}`);
  params.set('limit', '1');
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/hotels?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok)
    throw new Error(`Supabase SELECT failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json) || json.length === 0)
    throw new Error(`Hôtel introuvable pour slug=${slug}`);
  const r = json[0] as Record<string, unknown>;
  if (
    typeof r['slug'] === 'string' &&
    typeof r['name'] === 'string' &&
    typeof r['latitude'] === 'number' &&
    typeof r['longitude'] === 'number'
  ) {
    return { slug: r['slug'], name: r['name'], latitude: r['latitude'], longitude: r['longitude'] };
  }
  throw new Error(`Hôtel ${slug} sans coordonnées exploitables`);
}

function bestMatch(hotel: HotelRow, resp: SearchCompleteResponse): PropertyItem | null {
  const wanted = normalizeName(hotel.name);
  let best: PropertyItem | undefined;
  let bestOverlap = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const it of uniqueProperties(resp)) {
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
      best = it;
      bestOverlap = overlap;
      bestDistance = distance;
    }
  }
  return best ?? null;
}

/** Propriétés disponibles (avec rateKey + prix) triées du moins cher au plus cher. */
function availableSorted(resp: SearchCompleteResponse): PropertyItem[] {
  return uniqueProperties(resp)
    .filter((it) => {
      const amount =
        it.lowestPublicAvailableRate?.totalPrice?.amount ??
        it.lowestPublicAvailableRate?.total?.amount;
      return it.lowestPublicAvailableRate?.rateKey?.value !== undefined && amount !== undefined;
    })
    .sort((a, b) => {
      const av =
        a.lowestPublicAvailableRate?.totalPrice?.amount ??
        a.lowestPublicAvailableRate?.total?.amount ??
        0;
      const bv =
        b.lowestPublicAvailableRate?.totalPrice?.amount ??
        b.lowestPublicAvailableRate?.total?.amount ??
        0;
      return av - bv;
    });
}

async function main(): Promise<void> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `[book-travelport] Env invalide :\n${parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  const env = parsed.data;
  const args = parseArgs(process.argv.slice(2));

  const slug = args.get('slug');
  if (slug === undefined || slug.length === 0)
    throw new Error('[book-travelport] --slug est requis');

  const checkIn = args.get('checkin') ?? todayPlus(30);
  const nights = Number.parseInt(args.get('nights') ?? '1', 10);
  const checkOut =
    args.get('checkout') ?? addDays(checkIn, Number.isFinite(nights) ? Math.max(1, nights) : 1);
  const adults = Math.max(1, Number.parseInt(args.get('adults') ?? '1', 10) || 1);

  const guest: ReservationGuestInput = {
    given: args.get('given') ?? 'Test',
    surname: args.get('surname') ?? 'Concierge',
    email: args.get('email') ?? 'sandbox@myconciergehotel.com',
    phone: {
      countryAccessCode: '33',
      areaCityCode: args.get('area') ?? '01',
      number: args.get('phone') ?? '40000000',
    },
  };

  const card: ReservationCardInput = {
    cardCode: args.get('card-code') ?? 'VI',
    cardType: 'Credit',
    cardHolderName: args.get('holder') ?? 'Test Concierge',
    number: args.get('card') ?? '4444333322221111',
    expireDate: args.get('exp') ?? '1130',
    seriesCode: args.get('cvv') ?? '343',
  };

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

  console.log(`[book-travelport] Hôtel ${slug} · ${checkIn} → ${checkOut} · ${adults} adulte(s)`);
  const hotel = await fetchHotelBySlug(env, slug);

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: 1,
    unit: 'mi',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults,
    currency: env.TRAVELPORT_CURRENCY,
  });
  if (!search.ok)
    throw new Error(`[book-travelport] Search échouée : ${JSON.stringify(search.error)}`);

  const anyAvailable = args.has('any-available');
  const maxCandidates = Math.max(1, Number.parseInt(args.get('max-candidates') ?? '5', 10) || 5);
  const candidates: PropertyItem[] = anyAvailable
    ? availableSorted(search.value).slice(0, maxCandidates)
    : (() => {
        const m = bestMatch(hotel, search.value);
        return m === null ? [] : [m];
      })();

  if (candidates.length === 0) {
    throw new Error(
      anyAvailable
        ? `[book-travelport] Aucune propriété disponible (avec rateKey) dans le rayon de ${hotel.name}`
        : `[book-travelport] Aucun match Travelport pour ${hotel.name} (essaie --any-available pour réserver une dispo voisine)`,
    );
  }
  if (anyAvailable) {
    console.log(
      `[book-travelport] Mode --any-available : ${candidates.length} candidat(s) dispo testés ` +
        `(cible ${hotel.name} probablement complète).`,
    );
  }

  let confirmation: ReservationConfirmation | null = null;
  let lastError: unknown = null;

  for (const [idx, item] of candidates.entries()) {
    const rate = item.lowestPublicAvailableRate;
    const rateKey = rate?.rateKey?.value;
    const amount = rate?.totalPrice?.amount ?? rate?.total?.amount;
    const currency = rate?.currencyCode ?? rate?.total?.currency ?? env.TRAVELPORT_CURRENCY;
    if (rateKey === undefined || amount === undefined) continue;

    console.log(
      `\n[book-travelport] Candidat ${idx + 1}/${candidates.length} : ${item.name} ` +
        `[${item.chainCode}/${item.propertyCode}] · ${amount} ${currency} · garantie=${rate?.terms?.guaranteeType ?? 'n/a'}`,
    );

    const idempotencyKey = `book-${slug}-${checkIn}-${item.chainCode}${item.propertyCode}-${Date.now()}`;
    const baseInput = {
      rateKey,
      rooms: 1,
      currency,
      amount,
      ...(rate?.terms?.guaranteeType !== undefined
        ? { guaranteeType: rate.terms.guaranteeType }
        : {}),
      acceptPriceChange: false,
      acceptGuaranteeChange: false,
    };

    let result = await createReservation(creds, baseInput, guest, card, { idempotencyKey });

    // Rejeu unique en acceptant un éventuel changement de prix/garantie amont.
    if (
      !result.ok &&
      (result.error.kind === 'pricing_changed' || result.error.kind === 'guarantee_changed')
    ) {
      console.log(
        '[book-travelport]   prix/garantie modifiés — rejeu avec acceptPriceChange + acceptGuaranteeChange…',
      );
      result = await createReservation(creds, baseInput, guest, card, {
        idempotencyKey: `${idempotencyKey}-retry`,
        acceptPriceChange: true,
        acceptGuaranteeChange: true,
      });
    }

    if (result.ok) {
      confirmation = result.value;
      break;
    }

    lastError = result.error;
    const k = result.error.kind;
    const upstream5xx = k === 'http' && result.error.error.kind === 'upstream_5xx';
    if (anyAvailable && upstream5xx && idx < candidates.length - 1) {
      console.log('[book-travelport]   tarif refusé par le fournisseur (500) — candidat suivant…');
      continue;
    }
    break;
  }

  if (confirmation === null) {
    throw new Error(`[book-travelport] Réservation échouée : ${JSON.stringify(lastError)}`);
  }
  const c = confirmation;
  console.log('\n[book-travelport] ✓ Réservation créée');
  console.log(`  statut          : ${c.status}`);
  console.log(`  offerId         : ${c.offerId ?? 'n/a'}`);
  console.log(`  conf. supplier  : ${c.supplierConfirmation ?? 'n/a'}`);
  console.log(`  locator agrégat.: ${c.aggregatorLocator ?? 'n/a'}`);
  console.log(`  locator agence  : ${c.agencyLocator ?? 'n/a'}`);
  if (c.totalPrice)
    console.log(`  prix débité     : ${c.totalPrice.amount} ${c.totalPrice.currency}`);

  if (args.has('cancel')) {
    if (c.aggregatorLocator === undefined || c.supplierConfirmation === undefined) {
      console.log(
        `[book-travelport] --cancel impossible : locator agrégateur=${c.aggregatorLocator ?? 'n/a'} ` +
          `supplier=${c.supplierConfirmation ?? 'n/a'}.`,
      );
    } else {
      const cancelled = await cancelReservation(creds, c.aggregatorLocator, {
        idempotencyKey: `cancel-${c.aggregatorLocator}-${Date.now()}`,
        supplierLocator: c.supplierConfirmation,
      });
      if (!cancelled.ok)
        console.log(`[book-travelport] Annulation échouée : ${JSON.stringify(cancelled.error)}`);
      else console.log(`[book-travelport] ✓ Annulation : statut=${cancelled.value.status}`);
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
