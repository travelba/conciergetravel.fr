import 'server-only';

import {
  attachGuest,
  moveToRecap,
  startDraftFromOffer,
  type Guest,
  type Offer,
} from '@mch/domain/booking';
import {
  haversineMeters,
  normalizeName,
  searchByCoordinates,
  travelportOfferToDomain,
  uniqueProperties,
  type PropertyItem,
  type SearchCompleteResponse,
  type TravelportRateTerms,
  type TravelportRoomType,
} from '@mch/integrations/travelport';

import {
  getTravelportCredentials,
  getTravelportCurrency,
  isTravelportSampleSlug,
  isTravelportSandboxEnabled,
} from '@/lib/travelport';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';

import { saveTravelportContext, type TravelportBookingContext } from './travelport-context';
import { saveDraft, type DraftHotelSnapshot } from './draft-store';

/**
 * Pilote sandbox Travelport — Étape A du câblage tunnel (découverte d'offre →
 * lock → recap), **sans réservation réelle**. Tout est gated derrière
 * `TRAVELPORT_SANDBOX_ENABLED` + une allow-list de slugs : la fiche publique
 * et le gel Phase 6 (`booking_mode`) restent intacts. Aucune offre Travelport
 * n'est surfacée sur les pages publiques ; l'unique point d'entrée est la
 * route gated `/[locale]/reservation/sandbox/[slug]`.
 */

const OFFER_TTL_SEC = 10 * 60;
const SANDBOX_GUEST: Guest = {
  firstName: 'Sandbox',
  lastName: 'Concierge',
  email: 'benjamin@travelba.fr',
  phone: '+33100000000',
};

export type TravelportSandboxLockResult =
  | {
      readonly ok: true;
      readonly draftId: string;
      readonly ttlSec: number;
      readonly hotelName: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'disabled'
        | 'no_credentials'
        | 'hotel_not_found'
        | 'no_coordinates'
        | 'search_failed'
        | 'no_match'
        | 'no_rate';
    };

interface TravelportHotelRow {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
}

function addDaysIso(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Séjour demandé par le client (depuis le widget fiche), avant validation. */
export interface TravelportSandboxStayInput {
  readonly checkIn?: string | undefined;
  readonly checkOut?: string | undefined;
  readonly adults?: string | undefined;
  readonly children?: string | undefined;
}

interface ResolvedStay {
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIntInRange(raw: string | undefined, min: number, max: number): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Valide et normalise le séjour saisi par le client. Tout champ invalide ou
 * manquant retombe sur des valeurs par défaut sûres (J+30 → J+31, 1 adulte) :
 * le pilote sandbox ne doit jamais échouer à cause d'une saisie partielle.
 */
function resolveStay(input: TravelportSandboxStayInput | undefined): ResolvedStay {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fallback: ResolvedStay = {
    checkIn: addDaysIso(now, 30),
    checkOut: addDaysIso(now, 31),
    adults: 1,
    children: 0,
  };
  if (input === undefined) return fallback;

  const { checkIn, checkOut } = input;
  const datesValid =
    checkIn !== undefined &&
    checkOut !== undefined &&
    ISO_DATE_RE.test(checkIn) &&
    ISO_DATE_RE.test(checkOut) &&
    checkIn >= today &&
    checkOut > checkIn;

  const adults = parseIntInRange(input.adults, 1, 9) ?? fallback.adults;
  const children = parseIntInRange(input.children, 0, 9) ?? fallback.children;

  if (!datesValid) {
    return { checkIn: fallback.checkIn, checkOut: fallback.checkOut, adults, children };
  }
  return { checkIn, checkOut, adults, children };
}

async function fetchTravelportHotel(slug: string): Promise<TravelportHotelRow | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('id, name, city, region, latitude, longitude, is_published')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      id: string;
      name: string;
      city: string | null;
      region: string | null;
      latitude: number | string | null;
      longitude: number | string | null;
      is_published: boolean;
    };
    if (!row.is_published) return null;
    const lat = typeof row.latitude === 'string' ? Number(row.latitude) : row.latitude;
    const lon = typeof row.longitude === 'string' ? Number(row.longitude) : row.longitude;
    if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      id: row.id,
      name: row.name,
      city: row.city ?? '',
      region: row.region ?? '',
      latitude: lat,
      longitude: lon,
    };
  } catch {
    return null;
  }
}

/** Propriété Travelport correspondant le mieux au nom + proximité de l'hôtel. */
function bestMatch(hotel: TravelportHotelRow, resp: SearchCompleteResponse): PropertyItem | null {
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
    const overlap = [...normalizeName(it.name)].filter((token) => wanted.has(token)).length;
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

/**
 * Verrouille une offre Travelport (sandbox) pour un slug allow-listé et
 * persiste un draft directement en état `recap` (invité sandbox pré-rempli),
 * de sorte que la page recap existante affiche prix + dates + politique
 * d'annulation **verbatim**. Renvoie `draftId` à poser en cookie.
 */
export async function lockTravelportSandboxOffer(input: {
  readonly slug: string;
  readonly locale: 'fr' | 'en';
  readonly stay?: TravelportSandboxStayInput;
}): Promise<TravelportSandboxLockResult> {
  if (!isTravelportSandboxEnabled() || !isTravelportSampleSlug(input.slug)) {
    return { ok: false, reason: 'disabled' };
  }
  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'no_credentials' };

  const hotel = await fetchTravelportHotel(input.slug);
  if (hotel === null) return { ok: false, reason: 'hotel_not_found' };

  const now = new Date();
  const { checkIn, checkOut, adults, children } = resolveStay(input.stay);

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: 1,
    unit: 'mi',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults,
    currency: getTravelportCurrency(),
  });
  if (!search.ok) return { ok: false, reason: 'search_failed' };

  const item = bestMatch(hotel, search.value);
  if (item === null) return { ok: false, reason: 'no_match' };

  // Contexte de booking Travelport (rateKey + garantie + prix amont) : requis
  // pour `createReservation` à l'étape de confirmation sandbox, perdu à la
  // projection domaine. Sans rateKey/prix exploitables → pas de tarif.
  const rate = item.lowestPublicAvailableRate;
  const rateKey = rate?.rateKey?.value;
  const rateAmount = rate?.totalPrice?.amount ?? rate?.total?.amount;
  const rateCurrency = rate?.currencyCode ?? rate?.total?.currency ?? getTravelportCurrency();
  if (rateKey === undefined || rateAmount === undefined) {
    return { ok: false, reason: 'no_rate' };
  }

  const expiresAt = new Date(now.getTime() + OFFER_TTL_SEC * 1000).toISOString();
  const mapped = travelportOfferToDomain({
    item,
    hotelId: hotel.id,
    checkIn,
    checkOut,
    adults,
    children,
    expiresAt,
  });
  // `mapping_failure` couvre notamment une devise non-EUR (ex. hôtels hors
  // zone euro) : on retombe proprement sur "pas de tarif" plutôt que d'afficher
  // un montant trompeur (la contrainte domaine impose EUR).
  if (!mapped.ok) return { ok: false, reason: 'no_rate' };
  const offer: Offer = mapped.value;

  const locked = startDraftFromOffer({ id: crypto.randomUUID(), mode: 'amadeus', offer });
  const withGuest = attachGuest(locked, SANDBOX_GUEST);
  if (!withGuest.ok) return { ok: false, reason: 'no_rate' };
  const atRecap = moveToRecap(withGuest.value);
  if (!atRecap.ok) return { ok: false, reason: 'no_rate' };

  const snapshot: DraftHotelSnapshot = {
    id: hotel.id,
    name: hotel.name,
    city: hotel.city,
    region: hotel.region,
  };
  await saveDraft({ draft: atRecap.value, hotel: snapshot, locale: input.locale }, OFFER_TTL_SEC);

  const bookingCtx: TravelportBookingContext = {
    rateKey,
    chainCode: item.chainCode,
    propertyCode: item.propertyCode,
    propertyName: item.name,
    amount: rateAmount,
    currency: rateCurrency,
    ...(rate?.terms?.guaranteeType !== undefined
      ? { guaranteeType: rate.terms.guaranteeType }
      : {}),
    checkIn,
    checkOut,
    adults,
    hotelId: hotel.id,
    hotelName: hotel.name,
  };
  await saveTravelportContext(atRecap.value.id, bookingCtx);

  return { ok: true, draftId: atRecap.value.id, ttlSec: OFFER_TTL_SEC, hotelName: hotel.name };
}

// ---------------------------------------------------------------------------
// Étape B+ — sélection de chambre / plan tarifaire (Travelport `roomTypes`)
//
// `SearchComplete` renvoie, par propriété, plusieurs `roomTypes` × `rates`
// (prix, petit-déjeuner, remboursable, conditions, rateKey). On les normalise
// et on **met en cache côté serveur** (Redis) l'ensemble tarifaire complet,
// puis la page « chambres » n'expose qu'un `offerSetId` + des `rateKey`. Le
// verrouillage relit le tarif choisi depuis le cache : le prix n'est jamais
// repris depuis le client.
// ---------------------------------------------------------------------------

type TravelportRoomRate = NonNullable<TravelportRoomType['rates']>[number];

const OFFERSET_PREFIX = 'booking:tp:offerset:';
const OFFERSET_TTL_SEC = 15 * 60;

interface CachedRate {
  readonly rateKey: string;
  readonly amount: number;
  readonly currency: string;
  readonly priceMinor: number;
  readonly roomLabel: string;
  readonly rateLabel: string;
  readonly maxOccupancy: number | null;
  readonly breakfastIncluded: boolean | null;
  readonly refundable: boolean | null;
  readonly cancellationText: string;
  readonly guaranteeType?: string;
}

interface CachedOfferSet {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly city: string;
  readonly region: string;
  readonly chainCode: string;
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
  readonly rates: readonly CachedRate[];
}

/** Option de chambre/tarif exposée à l'UI (sans secret ni montant brut fournisseur). */
export interface SandboxRoomOption {
  readonly rateKey: string;
  readonly roomLabel: string;
  readonly rateLabel: string;
  readonly maxOccupancy: number | null;
  readonly priceMinor: number;
  readonly breakfastIncluded: boolean | null;
  readonly refundable: boolean | null;
  readonly cancellationText: string;
}

export type TravelportSandboxOffersResult =
  | {
      readonly ok: true;
      readonly offerSetId: string;
      readonly hotelName: string;
      readonly checkIn: string;
      readonly checkOut: string;
      readonly adults: number;
      readonly children: number;
      readonly options: readonly SandboxRoomOption[];
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'disabled'
        | 'no_credentials'
        | 'hotel_not_found'
        | 'search_failed'
        | 'no_match'
        | 'no_rate';
    };

/** Politique d'annulation verbatim (mêmes `terms` que `map-offer`). */
function cancellationFromTerms(terms: TravelportRateTerms | undefined): string {
  if (terms === undefined) return '';
  const parts: string[] = [];
  for (const p of terms.cancelPenalties ?? []) {
    if (typeof p.cancelShortDescription === 'string' && p.cancelShortDescription.length > 0) {
      parts.push(p.cancelShortDescription);
    }
  }
  if (parts.length === 0 && typeof terms.cancelNote === 'string' && terms.cancelNote.length > 0) {
    parts.push(terms.cancelNote);
  }
  if (parts.length === 0 && terms.refundable === false) parts.push('Non remboursable.');
  return parts.join(' ');
}

function normalizeRoomRate(rt: TravelportRoomType, rate: TravelportRoomRate): CachedRate | null {
  const rateKey = rate.rateKey?.value;
  const amount = rate.price?.totalPrice?.amount;
  const currency = rate.price?.currencyCode;
  if (rateKey === undefined || amount === undefined) return null;
  // Contrainte domaine : EUR uniquement (MoneyAmount.currency).
  if (currency !== undefined && currency.toUpperCase() !== 'EUR') return null;
  const breakfast = rate.breakfastIncluded ?? null;
  const refundable = rate.refundable ?? rate.terms?.refundable ?? null;
  const roomLabel = rt.shortRoomDescription ?? rate.roomDescription ?? 'Chambre';
  const rateLabel =
    rate.rateDescription ?? (breakfast === true ? 'Petit-déjeuner inclus' : 'Tarif standard');
  return {
    rateKey,
    amount,
    currency: 'EUR',
    priceMinor: Math.round(amount * 100),
    roomLabel,
    rateLabel,
    maxOccupancy: typeof rt.maxOccupancy === 'number' ? rt.maxOccupancy : null,
    breakfastIncluded: breakfast,
    refundable,
    cancellationText: cancellationFromTerms(rate.terms),
    ...(rate.terms?.guaranteeType !== undefined ? { guaranteeType: rate.terms.guaranteeType } : {}),
  };
}

/** Normalise tous les `roomTypes` × `rates` (EUR), dédoublonne par rateKey, trie par prix. */
function buildRatesFromItem(item: PropertyItem): CachedRate[] {
  const out: CachedRate[] = [];
  const seen = new Set<string>();
  for (const rt of item.roomTypes ?? []) {
    for (const rate of rt.rates ?? []) {
      const norm = normalizeRoomRate(rt, rate);
      if (norm === null || seen.has(norm.rateKey)) continue;
      seen.add(norm.rateKey);
      out.push(norm);
    }
  }
  out.sort((a, b) => a.priceMinor - b.priceMinor);
  return out;
}

function isCachedOfferSet(value: unknown): value is CachedOfferSet {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['hotelId'] === 'string' &&
    typeof v['chainCode'] === 'string' &&
    typeof v['propertyCode'] === 'string' &&
    Array.isArray(v['rates'])
  );
}

async function saveOfferSet(id: string, set: CachedOfferSet): Promise<void> {
  await redis.set(`${OFFERSET_PREFIX}${id}`, JSON.stringify(set), { ex: OFFERSET_TTL_SEC });
}

async function loadOfferSet(id: string): Promise<CachedOfferSet | null> {
  const raw = await redis.get<string | CachedOfferSet>(`${OFFERSET_PREFIX}${id}`);
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return isCachedOfferSet(value) ? value : null;
}

function toOption(r: CachedRate): SandboxRoomOption {
  return {
    rateKey: r.rateKey,
    roomLabel: r.roomLabel,
    rateLabel: r.rateLabel,
    maxOccupancy: r.maxOccupancy,
    priceMinor: r.priceMinor,
    breakfastIncluded: r.breakfastIncluded,
    refundable: r.refundable,
    cancellationText: r.cancellationText,
  };
}

/**
 * Découvre les chambres/plans tarifaires Travelport (sandbox) pour un slug
 * allow-listé et un séjour donné, met en cache l'ensemble tarifaire et renvoie
 * la liste à afficher. Aucune réservation, aucun draft : c'est l'étape de choix.
 */
export async function listTravelportSandboxOffers(input: {
  readonly slug: string;
  readonly locale: 'fr' | 'en';
  readonly stay?: TravelportSandboxStayInput;
}): Promise<TravelportSandboxOffersResult> {
  if (!isTravelportSandboxEnabled() || !isTravelportSampleSlug(input.slug)) {
    return { ok: false, reason: 'disabled' };
  }
  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'no_credentials' };

  const hotel = await fetchTravelportHotel(input.slug);
  if (hotel === null) return { ok: false, reason: 'hotel_not_found' };

  const { checkIn, checkOut, adults, children } = resolveStay(input.stay);

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: 1,
    unit: 'mi',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults,
    currency: getTravelportCurrency(),
  });
  if (!search.ok) return { ok: false, reason: 'search_failed' };

  const item = bestMatch(hotel, search.value);
  if (item === null) return { ok: false, reason: 'no_match' };

  const rates = buildRatesFromItem(item);
  if (rates.length === 0) return { ok: false, reason: 'no_rate' };

  const offerSetId = crypto.randomUUID();
  const set: CachedOfferSet = {
    hotelId: hotel.id,
    hotelName: hotel.name,
    city: hotel.city,
    region: hotel.region,
    chainCode: item.chainCode,
    propertyCode: item.propertyCode,
    propertyName: item.name,
    checkIn,
    checkOut,
    adults,
    children,
    rates,
  };
  await saveOfferSet(offerSetId, set);

  return {
    ok: true,
    offerSetId,
    hotelName: hotel.name,
    checkIn,
    checkOut,
    adults,
    children,
    options: rates.map(toOption),
  };
}

/**
 * Verrouille le tarif **choisi** par le client (depuis l'ensemble mis en cache)
 * et persiste un draft `recap` + le contexte Travelport pour la confirmation.
 */
export async function lockTravelportSandboxSelectedOffer(input: {
  readonly offerSetId: string;
  readonly rateKey: string;
  readonly locale: 'fr' | 'en';
}): Promise<TravelportSandboxLockResult> {
  if (!isTravelportSandboxEnabled()) return { ok: false, reason: 'disabled' };

  const set = await loadOfferSet(input.offerSetId);
  if (set === null) return { ok: false, reason: 'search_failed' };
  const rate = set.rates.find((r) => r.rateKey === input.rateKey);
  if (rate === undefined) return { ok: false, reason: 'no_rate' };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + OFFER_TTL_SEC * 1000).toISOString();
  const offer: Offer = {
    id: rate.rateKey,
    provider: 'travelport',
    hotelId: set.hotelId,
    roomCode: `${set.chainCode}/${set.propertyCode}`,
    stay: { checkIn: set.checkIn, checkOut: set.checkOut },
    guests: { adults: set.adults, children: set.children },
    totalPrice: { amountMinor: rate.priceMinor, currency: 'EUR' },
    cancellationPolicyText: rate.cancellationText,
    expiresAt,
  };

  const locked = startDraftFromOffer({ id: crypto.randomUUID(), mode: 'amadeus', offer });
  const withGuest = attachGuest(locked, SANDBOX_GUEST);
  if (!withGuest.ok) return { ok: false, reason: 'no_rate' };
  const atRecap = moveToRecap(withGuest.value);
  if (!atRecap.ok) return { ok: false, reason: 'no_rate' };

  const snapshot: DraftHotelSnapshot = {
    id: set.hotelId,
    name: set.hotelName,
    city: set.city,
    region: set.region,
  };
  await saveDraft({ draft: atRecap.value, hotel: snapshot, locale: input.locale }, OFFER_TTL_SEC);

  const bookingCtx: TravelportBookingContext = {
    rateKey: rate.rateKey,
    chainCode: set.chainCode,
    propertyCode: set.propertyCode,
    propertyName: set.propertyName,
    amount: rate.amount,
    currency: rate.currency,
    ...(rate.guaranteeType !== undefined ? { guaranteeType: rate.guaranteeType } : {}),
    checkIn: set.checkIn,
    checkOut: set.checkOut,
    adults: set.adults,
    hotelId: set.hotelId,
    hotelName: set.hotelName,
  };
  await saveTravelportContext(atRecap.value.id, bookingCtx);

  return { ok: true, draftId: atRecap.value.id, ttlSec: OFFER_TTL_SEC, hotelName: set.hotelName };
}

// ---------------------------------------------------------------------------
// Étape C — prix live « à partir de » injectés dans les cartes chambres
// éditoriales. On rapproche chaque chambre éditoriale d'un `roomType`
// Travelport par recouvrement de tokens (même heuristique que le matching
// hôtel), et on retient le tarif le plus bas. Best-effort : toute erreur ⇒
// `null` (les cartes restent éditoriales). Gardé derrière le flag + allow-list.
// ---------------------------------------------------------------------------

export interface TravelportLiveRoomPrices {
  /** `id` de chambre éditoriale → prix « à partir de » (EUR minor) Travelport. */
  readonly fromByRoomId: ReadonlyMap<string, number>;
}

export async function getTravelportLiveRoomPrices(input: {
  readonly slug: string;
  readonly locale: 'fr' | 'en';
  readonly rooms: readonly { readonly id: string; readonly name: string | null; readonly room_code: string }[];
}): Promise<TravelportLiveRoomPrices | null> {
  if (!isTravelportSandboxEnabled() || !isTravelportSampleSlug(input.slug)) return null;
  if (input.rooms.length === 0) return null;

  let offers: TravelportSandboxOffersResult;
  try {
    offers = await listTravelportSandboxOffers({ slug: input.slug, locale: input.locale });
  } catch {
    return null;
  }
  if (!offers.ok) return null;

  const fromByRoomId = new Map<string, number>();
  for (const room of input.rooms) {
    const wanted = normalizeName(room.name ?? room.room_code);
    if (wanted.size === 0) continue;
    let bestPrice: number | undefined;
    let bestOverlap = 0;
    for (const opt of offers.options) {
      const overlap = [...normalizeName(opt.roomLabel)].filter((t) => wanted.has(t)).length;
      if (overlap === 0) continue;
      if (
        overlap > bestOverlap ||
        (overlap === bestOverlap && (bestPrice === undefined || opt.priceMinor < bestPrice))
      ) {
        bestOverlap = overlap;
        bestPrice = opt.priceMinor;
      }
    }
    if (bestPrice !== undefined) fromByRoomId.set(room.id, bestPrice);
  }

  if (fromByRoomId.size === 0) return null;
  return { fromByRoomId };
}

/**
 * Chambre Travelport « live » dédoublonnée par type, avec son tarif le plus bas.
 * Sert à **remplir** la section Chambres d'une fiche dépourvue de chambres
 * éditoriales (cas du pilote Prince de Galles) plutôt que d'afficher « aucune
 * chambre ». Best-effort + gated.
 */
export interface TravelportLiveRoom {
  readonly roomLabel: string;
  readonly maxOccupancy: number | null;
  readonly fromMinor: number;
  readonly breakfastIncluded: boolean | null;
  readonly refundable: boolean | null;
}

export async function getTravelportLiveRoomList(input: {
  readonly slug: string;
  readonly locale: 'fr' | 'en';
}): Promise<readonly TravelportLiveRoom[]> {
  if (!isTravelportSandboxEnabled() || !isTravelportSampleSlug(input.slug)) return [];

  let offers: TravelportSandboxOffersResult;
  try {
    offers = await listTravelportSandboxOffers({ slug: input.slug, locale: input.locale });
  } catch {
    return [];
  }
  if (!offers.ok) return [];

  // Dédoublonnage par libellé de chambre : on garde l'option la moins chère.
  const byLabel = new Map<string, TravelportLiveRoom>();
  for (const opt of offers.options) {
    const existing = byLabel.get(opt.roomLabel);
    if (existing === undefined || opt.priceMinor < existing.fromMinor) {
      byLabel.set(opt.roomLabel, {
        roomLabel: opt.roomLabel,
        maxOccupancy: opt.maxOccupancy,
        fromMinor: opt.priceMinor,
        breakfastIncluded: opt.breakfastIncluded,
        refundable: opt.refundable,
      });
    }
  }
  return [...byLabel.values()].sort((a, b) => a.fromMinor - b.fromMinor);
}
