/**
 * Bootstrap deterministic Travelport supplier mappings — FULLY AUTOMATED, no
 * human in the loop (Phase 3/4 activation, scaled for the ~2200-hotel catalogue).
 *
 * Turns the runtime fuzzy matcher into STORED data through a cascade:
 *
 *   1. coordinate search (same as the live fiche path) -> best-match property
 *      => chainCode / propertyCode + distinct room labels ;
 *   2. TIER 1 — deterministic token overlap (>= min-overlap distinctive tokens)
 *      assigns the obvious labels (e.g. "Art Déco Deluxe") => confidence auto_high ;
 *   3. TIER 2 — LLM attribute matcher (match-rooms-llm.ts) resolves the residual
 *      labels that share NO name token with a branded editorial room
 *      (e.g. "Junior Suite With Terrace" -> "Suite Mosaïque") by SIZE / BED /
 *      VIEW / TIER => confidence auto_medium ; ambiguous => dropped ;
 *   4. CONFIDENCE GATE — auto_high + auto_medium are written ; auto_low / null
 *      are NOT written. A label with no confident mapping degrades GRACEFULLY:
 *      the orchestrator surfaces it as a supplier-labelled room (still bookable).
 *      Nothing is ever queued for a human.
 *   5. upsert hotel_supplier_connections (travelport) + room_supplier_mappings.
 *
 * After running this (catalogue-wide via run-travelport-bootstrap-all.ts) and
 * with MULTI_SUPPLIER_RATESHOPPING_ENABLED=true, the fiche shows deterministic
 * prices for the mapped rooms and graceful supplier rooms for the rest.
 *
 * Usage (single hotel) :
 *   pnpm --filter @mch/editorial-pilot travelport:bootstrap -- \
 *     --slug=prince-de-galles-paris [--dry-run] [--adults=1] [--radius=1] \
 *     [--min-overlap=2] [--no-llm] [--llm-model=gpt-4o-mini-2024-07-18]
 *
 * Skills : editorial-rankings-matrix, llm-output-robustness, api-integration,
 *          redis-caching, windows-dev-environment.
 */
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  haversineMeters,
  normalizeName,
  searchByCoordinates,
  uniqueProperties,
  type PropertyItem,
  type SearchCompleteResponse,
  type TravelportCredentials,
} from '@mch/integrations/travelport';
import type { IntegrationRedis } from '@mch/integrations/redis';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import {
  matchSupplierRoomsToEditorial,
  type EditorialRoomForMatch,
  type MatchConfidence,
} from './match-rooms-llm.js';

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
  OPENAI_API_KEY: z.preprocess(
    (v) => (typeof v === 'string' && v.trim().length === 0 ? undefined : v),
    z.string().min(20).optional(),
  ),
});
export type BootEnv = z.infer<typeof EnvSchema>;

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === `--${name}`) return 'true';
  }
  return undefined;
}

export function createMemoryRedis(): IntegrationRedis {
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

function todayPlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export interface HotelRow {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface EditorialRoom {
  readonly id: string;
  readonly name_fr: string | null;
  readonly name_en: string | null;
  readonly room_code: string;
  readonly bed_type: string | null;
  readonly size_sqm: number | null;
  readonly max_occupancy: number | null;
  readonly description: string | null;
}

/** Token source for matching: FR + EN names + code (Travelport labels are EN). */
function roomTokens(room: EditorialRoom): ReadonlySet<string> {
  return normalizeName(`${room.name_en ?? ''} ${room.name_fr ?? ''} ${room.room_code}`);
}

function roomDisplay(room: EditorialRoom): string {
  return room.name_fr ?? room.name_en ?? room.room_code;
}

function toMatchRoom(room: EditorialRoom): EditorialRoomForMatch {
  return {
    id: room.id,
    nameFr: room.name_fr,
    nameEn: room.name_en,
    roomCode: room.room_code,
    bedType: room.bed_type,
    sizeSqm: room.size_sqm,
    maxOccupancy: room.max_occupancy,
    description: room.description,
  };
}

const CONFIDENCE_RANK: Record<MatchConfidence, number> = {
  auto_high: 3,
  auto_medium: 2,
  auto_low: 1,
};

function strongerConfidence(a: MatchConfidence, b: MatchConfidence): MatchConfidence {
  return CONFIDENCE_RANK[a] >= CONFIDENCE_RANK[b] ? a : b;
}

async function sbGet<T>(env: BootEnv, path: string): Promise<T> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok)
    throw new Error(
      `Supabase GET ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
  return (await res.json()) as T;
}

async function sbWrite(
  env: BootEnv,
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<void> {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? 'return=minimal',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok)
    throw new Error(
      `Supabase ${method} ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
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

interface LabelInfo {
  readonly label: string;
  readonly fromMinor: number | null;
}

/** Distinct Travelport room labels (shortRoomDescription) with their lowest EUR price. */
function distinctLabels(item: PropertyItem): LabelInfo[] {
  const byLabel = new Map<string, number | null>();
  for (const rt of item.roomTypes ?? []) {
    const label = rt.shortRoomDescription;
    if (label === undefined || label.trim().length === 0) continue;
    let lowest: number | null = byLabel.get(label) ?? null;
    for (const rate of rt.rates ?? []) {
      const amount = rate.price?.totalPrice?.amount;
      const currency = rate.price?.currencyCode;
      if (amount === undefined) continue;
      if (currency !== undefined && currency.toUpperCase() !== 'EUR') continue;
      const minor = Math.round(amount * 100);
      if (lowest === null || minor < lowest) lowest = minor;
    }
    byLabel.set(label, lowest);
  }
  return [...byLabel.entries()].map(([label, fromMinor]) => ({ label, fromMinor }));
}

export interface BootstrapOptions {
  readonly dryRun: boolean;
  readonly adults: number;
  readonly radius: number;
  /** Minimum shared distinctive tokens for the TIER 1 deterministic auto_high match. */
  readonly minOverlap: number;
  /** Run the TIER 2 LLM attribute matcher on residual labels (default true). */
  readonly useLlm: boolean;
  readonly llmModel?: string;
  /** Verbose per-label logging (single-hotel CLI). Off for the batch runner. */
  readonly verbose?: boolean;
}

export type BootstrapStatus = 'ok' | 'search_failed' | 'no_property' | 'no_rooms';

export interface BootstrapResult {
  readonly status: BootstrapStatus;
  readonly hotelName: string;
  readonly propertyLabel?: string;
  readonly editorialRoomCount: number;
  readonly tier1Mappings: number;
  readonly llmMappings: number;
  readonly mappedRoomCount: number;
  readonly detail?: string;
}

/**
 * Bootstrap (or refresh) Travelport mappings for ONE hotel. Pure orchestration —
 * never throws on a per-hotel failure path (returns a status the batch runner
 * tallies). Reuses a SHARED {@link TravelportCredentials} (memory-redis token
 * cache) so a catalogue run authenticates once.
 */
export async function bootstrapTravelportHotel(
  env: BootEnv,
  creds: TravelportCredentials,
  hotel: HotelRow,
  opts: BootstrapOptions,
): Promise<BootstrapResult> {
  const log = (msg: string): void => {
    if (opts.verbose === true) console.log(msg);
  };

  const checkIn = todayPlus(30);
  const checkOut = todayPlus(31);

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: opts.radius,
    unit: 'mi',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults: opts.adults,
    currency: env.TRAVELPORT_CURRENCY,
  });
  if (!search.ok) {
    return {
      status: 'search_failed',
      hotelName: hotel.name,
      editorialRoomCount: 0,
      tier1Mappings: 0,
      llmMappings: 0,
      mappedRoomCount: 0,
      detail: JSON.stringify(search.error).slice(0, 200),
    };
  }

  const property = bestMatch(hotel, search.value);
  if (property === null) {
    return {
      status: 'no_property',
      hotelName: hotel.name,
      editorialRoomCount: 0,
      tier1Mappings: 0,
      llmMappings: 0,
      mappedRoomCount: 0,
    };
  }

  const labels = distinctLabels(property);
  const propertyLabel = `${property.name} [${property.chainCode}/${property.propertyCode}]`;
  log(`[tp:bootstrap] match : ${propertyLabel} · ${labels.length} type(s) de chambre`);
  for (const l of labels) {
    log(
      `    - ${l.label}${l.fromMinor !== null ? ` (dès ${(l.fromMinor / 100).toFixed(0)} €)` : ''}`,
    );
  }

  const rooms = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotel_rooms?hotel_id=eq.${hotel.id}` +
      `&select=id,name_fr,name_en,room_code,bed_type,size_sqm,max_occupancy,description_fr,long_description_fr`,
  );
  const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const editorialRooms: EditorialRoom[] = rooms.map((r) => ({
    id: String(r['id']),
    name_fr: str(r['name_fr']),
    name_en: str(r['name_en']),
    room_code: String(r['room_code']),
    bed_type: str(r['bed_type']),
    size_sqm: num(r['size_sqm']),
    max_occupancy: num(r['max_occupancy']),
    description: str(r['long_description_fr']) ?? str(r['description_fr']),
  }));
  log(`[tp:bootstrap] ${editorialRooms.length} chambre(s) éditoriale(s).`);

  if (editorialRooms.length === 0) {
    return {
      status: 'no_rooms',
      hotelName: hotel.name,
      propertyLabel,
      editorialRoomCount: 0,
      tier1Mappings: 0,
      llmMappings: 0,
      mappedRoomCount: 0,
    };
  }

  // label -> { roomId, confidence }. One supplier label resolves to AT MOST one
  // editorial room (orchestrator invariant: deterministic reverse mapping).
  const labelAssignment = new Map<string, { roomId: string; confidence: MatchConfidence }>();

  // ---- TIER 1 — deterministic token overlap (auto_high) -------------------
  let tier1 = 0;
  for (const l of labels) {
    const wanted = normalizeName(l.label);
    if (wanted.size === 0) continue;
    let bestRoomId: string | undefined;
    let bestOverlap = 0;
    for (const room of editorialRooms) {
      const tokens = roomTokens(room);
      let overlap = 0;
      for (const t of tokens) if (wanted.has(t)) overlap += 1;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestRoomId = room.id;
      }
    }
    if (bestRoomId !== undefined && bestOverlap >= opts.minOverlap) {
      labelAssignment.set(l.label, { roomId: bestRoomId, confidence: 'auto_high' });
      tier1 += 1;
    }
  }

  // ---- TIER 2 — LLM attribute matcher on residual labels (auto_medium) ----
  let llm = 0;
  const residual = labels.filter((l) => !labelAssignment.has(l.label));
  if (opts.useLlm && env.OPENAI_API_KEY !== undefined && residual.length > 0) {
    const supplierRooms = residual.map((l, i) => ({ index: i, label: l.label }));
    const matches = await matchSupplierRoomsToEditorial({
      hotelName: hotel.name,
      editorialRooms: editorialRooms.map(toMatchRoom),
      supplierRooms,
      apiKey: env.OPENAI_API_KEY,
      ...(opts.llmModel !== undefined ? { model: opts.llmModel } : {}),
    });
    if (matches !== null) {
      for (const m of matches) {
        // CONFIDENCE GATE — keep high+medium, drop low/null (graceful fallback).
        if (m.hotelRoomId === null) continue;
        if (m.confidence === 'auto_low') continue;
        const label = residual[m.supplierIndex]?.label;
        if (label === undefined) continue;
        labelAssignment.set(label, { roomId: m.hotelRoomId, confidence: m.confidence });
        llm += 1;
        log(`    ~ LLM ${m.confidence}: "${label}" → ${m.hotelRoomId} (${m.reasoning})`);
      }
    } else {
      log('[tp:bootstrap] LLM matcher indisponible (fallback déterministe seul).');
    }
  }

  // ---- Group labels by editorial room; row confidence = strongest label ----
  const byRoom = new Map<string, { labels: string[]; confidence: MatchConfidence }>();
  for (const [label, { roomId, confidence }] of labelAssignment) {
    const cur = byRoom.get(roomId);
    if (cur === undefined) {
      byRoom.set(roomId, { labels: [label], confidence });
    } else {
      cur.labels.push(label);
      cur.confidence = strongerConfidence(cur.confidence, confidence);
    }
  }

  const mappingRows = [...byRoom.entries()].map(([hotelRoomId, info]) => ({
    hotel_id: hotel.id,
    hotel_room_id: hotelRoomId,
    supplier: 'travelport' as const,
    supplier_room_key: { labels: info.labels },
    confidence: info.confidence,
  }));

  const connectionRow = {
    hotel_id: hotel.id,
    supplier: 'travelport' as const,
    supplier_property_key: { chainCode: property.chainCode, propertyCode: property.propertyCode },
    enabled: true,
    priority: 100,
    currency: 'EUR' as const,
  };

  const mappedRoomIds = new Set(byRoom.keys());
  const unmatched = editorialRooms.filter((r) => !mappedRoomIds.has(r.id));
  log(
    `[tp:bootstrap] mappings : ${mappingRows.length}/${editorialRooms.length} chambres reliées ` +
      `(tier1=${tier1}, llm=${llm})` +
      (unmatched.length > 0 ? ` · repli gracieux : ${unmatched.map(roomDisplay).join(', ')}` : ''),
  );

  if (opts.dryRun) {
    log('[tp:bootstrap] --dry-run : aucune écriture.');
    if (opts.verbose === true) console.log(JSON.stringify({ connectionRow, mappingRows }, null, 2));
    return {
      status: 'ok',
      hotelName: hotel.name,
      propertyLabel,
      editorialRoomCount: editorialRooms.length,
      tier1Mappings: tier1,
      llmMappings: llm,
      mappedRoomCount: mappingRows.length,
    };
  }

  await sbWrite(
    env,
    'POST',
    'hotel_supplier_connections?on_conflict=hotel_id,supplier',
    [connectionRow],
    'resolution=merge-duplicates,return=minimal',
  );
  await sbWrite(
    env,
    'DELETE',
    `room_supplier_mappings?hotel_id=eq.${hotel.id}&supplier=eq.travelport`,
  );
  if (mappingRows.length > 0) {
    await sbWrite(env, 'POST', 'room_supplier_mappings', mappingRows, 'return=minimal');
  }

  return {
    status: 'ok',
    hotelName: hotel.name,
    propertyLabel,
    editorialRoomCount: editorialRooms.length,
    tier1Mappings: tier1,
    llmMappings: llm,
    mappedRoomCount: mappingRows.length,
  };
}

export function buildTravelportCreds(env: BootEnv, redis: IntegrationRedis): TravelportCredentials {
  return {
    authUrl: env.TRAVELPORT_AUTH_URL,
    apiBaseUrl: env.TRAVELPORT_API_BASE,
    clientId: env.TRAVELPORT_CLIENT_ID,
    clientSecret: env.TRAVELPORT_CLIENT_SECRET,
    username: env.TRAVELPORT_USERNAME,
    password: env.TRAVELPORT_PASSWORD,
    accessGroup: env.TRAVELPORT_ACCESS_GROUP,
    pcc: env.TRAVELPORT_PCC,
    redis,
  };
}

export function parseBootEnv():
  | { readonly ok: true; readonly env: BootEnv }
  | { readonly ok: false } {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[tp:bootstrap] env invalide :');
    console.error(
      parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    return { ok: false };
  }
  return { ok: true, env: parsed.data };
}

async function main(): Promise<void> {
  const parsed = parseBootEnv();
  if (!parsed.ok) {
    process.exitCode = 1;
    return;
  }
  const env = parsed.env;

  const slug = flag('slug');
  if (slug === undefined) {
    console.error('[tp:bootstrap] requis : --slug=<hotel_slug> [--dry-run] [--no-llm]');
    process.exitCode = 1;
    return;
  }
  const llmModel = flag('llm-model');
  const opts: BootstrapOptions = {
    dryRun: flag('dry-run') === 'true',
    adults: Number.parseInt(flag('adults') ?? '1', 10) || 1,
    radius: Number.parseFloat(flag('radius') ?? '1') || 1,
    minOverlap: Math.max(1, Number.parseInt(flag('min-overlap') ?? '2', 10) || 2),
    useLlm: flag('no-llm') !== 'true',
    ...(llmModel !== undefined ? { llmModel } : {}),
    verbose: true,
  };

  if (opts.useLlm && env.OPENAI_API_KEY === undefined) {
    console.warn(
      '[tp:bootstrap] OPENAI_API_KEY absent — TIER 2 LLM désactivé (déterministe seul).',
    );
  }

  const hotels = await sbGet<readonly Record<string, unknown>[]>(
    env,
    `hotels?slug=eq.${encodeURIComponent(slug)}&select=id,name,latitude,longitude&limit=1`,
  );
  const h0 = hotels[0];
  if (h0 === undefined) {
    console.error(`[tp:bootstrap] hôtel introuvable pour slug=${slug}`);
    process.exitCode = 1;
    return;
  }
  const hotel: HotelRow = {
    id: String(h0['id']),
    name: String(h0['name']),
    latitude: Number(h0['latitude']),
    longitude: Number(h0['longitude']),
  };

  const creds = buildTravelportCreds(env, createMemoryRedis());
  console.log(`[tp:bootstrap] recherche Travelport pour « ${hotel.name} »…`);
  const result = await bootstrapTravelportHotel(env, creds, hotel, opts);

  if (result.status !== 'ok') {
    console.error(
      `[tp:bootstrap] ${result.status} pour ${hotel.name}${result.detail ? ` — ${result.detail}` : ''}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `[tp:bootstrap] OK — ${result.mappedRoomCount} mapping(s) ` +
      `(tier1=${result.tier1Mappings}, llm=${result.llmMappings}) ` +
      `${opts.dryRun ? 'simulés' : 'écrits'} pour ${hotel.name}.`,
  );
}

function isRunAsCli(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isRunAsCli()) {
  main().catch((e: unknown) => {
    console.error('[tp:bootstrap] fatal', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
}
