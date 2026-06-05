import 'server-only';

import { startDraftFromOffer, type Offer } from '@mch/domain/booking';
import {
  haversineMeters,
  normalizeName,
  searchByCoordinates,
  uniqueProperties,
  type PropertyItem,
  type SearchCompleteResponse,
  type TravelportRateTerms,
  type TravelportRoomType,
} from '@mch/integrations/travelport';

import {
  getTravelportCredentials,
  getTravelportCurrency,
  isTravelportSandboxEnabled,
} from '@/lib/travelport';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { redis } from '@/lib/redis';

import { saveTravelportContext, type TravelportBookingContext } from './travelport-context';
import { saveDraft, type DraftHotelSnapshot } from './draft-store';

/**
 * Pilote Travelport — câblage tunnel (découverte d'offre → lock → saisie
 * voyageur → recap). L'éligibilité d'un hôtel est désormais pilotée **par la
 * donnée** : `hotels.booking_mode = 'travelport'`, avec
 * `TRAVELPORT_SANDBOX_ENABLED` conservé comme kill-switch global. Le point
 * d'entrée du parcours est la page gated
 * `/[locale]/reservation/sandbox/[slug]/chambres` (sélection chambre/tarif) →
 * saisie voyageur (`/reservation/invite`) → recap.
 */

const OFFER_TTL_SEC = 10 * 60;

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
  readonly heroImage: string | null;
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

interface ResolvedStayResult {
  readonly stay: ResolvedStay;
  /** `true` quand des dates ont été fournies mais invalides → repli J+30/J+31. */
  readonly datesAdjusted: boolean;
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
function resolveStay(input: TravelportSandboxStayInput | undefined): ResolvedStayResult {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fallback: ResolvedStay = {
    checkIn: addDaysIso(now, 30),
    checkOut: addDaysIso(now, 31),
    adults: 1,
    children: 0,
  };
  if (input === undefined) return { stay: fallback, datesAdjusted: false };

  const { checkIn, checkOut } = input;
  const datesProvided = checkIn !== undefined || checkOut !== undefined;
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
    return {
      stay: { checkIn: fallback.checkIn, checkOut: fallback.checkOut, adults, children },
      // N'avertit que si l'utilisateur avait réellement saisi des dates.
      datesAdjusted: datesProvided,
    };
  }
  return { stay: { checkIn, checkOut, adults, children }, datesAdjusted: false };
}

async function fetchTravelportHotel(slug: string): Promise<TravelportHotelRow | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('id, name, city, region, latitude, longitude, hero_image, is_published')
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
      hero_image: string | null;
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
      heroImage:
        typeof row.hero_image === 'string' && row.hero_image.length > 0 ? row.hero_image : null,
    };
  } catch {
    return null;
  }
}

/**
 * Source de vérité de l'éligibilité pilote : `true` ssi l'hôtel (slug) est
 * publié **et** en `booking_mode = 'travelport'`. Remplace l'ancienne allow-list
 * env. À combiner avec `isTravelportSandboxEnabled()` (kill-switch global) chez
 * l'appelant pour éviter toute lecture DB quand le pilote est globalement coupé.
 */
async function isTravelportBookingSlug(slug: string): Promise<boolean> {
  if (slug.length === 0) return false;
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select('booking_mode, is_published')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return false;
    const row = data as { booking_mode: string | null; is_published: boolean | null };
    return row.is_published === true && row.booking_mode === 'travelport';
  } catch {
    return false;
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
  readonly slug: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly city: string;
  readonly region: string;
  readonly heroImage: string | null;
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
      readonly slug: string;
      readonly hotelName: string;
      readonly checkIn: string;
      readonly checkOut: string;
      readonly adults: number;
      readonly children: number;
      /** `true` si les dates demandées étaient invalides et ont été corrigées. */
      readonly datesAdjusted: boolean;
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

// ---------------------------------------------------------------------------
// Recherche « display-only » mutualisée + cache Redis
//
// La fiche publique (force-dynamic, indexable) ET la page de sélection
// `/chambres` ont besoin du même résultat normalisé pour un couple
// (hôtel, séjour). On factorise la recherche + matching + normalisation et on
// met en cache l'ensemble **normalisé** par `slug:checkIn:checkOut:adults`
// (TTL court). La fiche lit le cache sans persister d'`offerSet` (display) ;
// `/chambres` lit le même cache puis persiste un `offerSet` jetable pour la
// sélection. On évite ainsi un appel Travelport + une écriture Redis à chaque
// rendu de fiche (y compris par les crawlers).
// ---------------------------------------------------------------------------

const SEARCH_PREFIX = 'booking:tp:search:';
const SEARCH_TTL_SEC = 8 * 60;

interface NormalizedSearch {
  readonly slug: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly city: string;
  readonly region: string;
  readonly heroImage: string | null;
  readonly chainCode: string;
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
  readonly rates: readonly CachedRate[];
}

type SearchReason = 'no_credentials' | 'hotel_not_found' | 'search_failed' | 'no_match' | 'no_rate';

function isNormalizedSearch(value: unknown): value is NormalizedSearch {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['slug'] === 'string' &&
    typeof v['hotelId'] === 'string' &&
    typeof v['chainCode'] === 'string' &&
    typeof v['propertyCode'] === 'string' &&
    Array.isArray(v['rates'])
  );
}

function searchCacheKey(slug: string, stay: ResolvedStay): string {
  return `${SEARCH_PREFIX}${slug}:${stay.checkIn}:${stay.checkOut}:${stay.adults}`;
}

async function loadNormalizedSearch(key: string): Promise<NormalizedSearch | null> {
  const raw = await redis.get<string | NormalizedSearch>(key);
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return isNormalizedSearch(value) ? value : null;
}

/**
 * Recherche Travelport + matching + normalisation tarifaire, **mise en cache**.
 * Partagée par la fiche (display) et `/chambres` (sélection). Ne persiste aucun
 * `offerSet` : c'est au seul chemin de sélection de le faire.
 */
async function searchAndNormalize(input: {
  readonly slug: string;
  readonly stay: ResolvedStay;
}): Promise<
  | { readonly ok: true; readonly data: NormalizedSearch }
  | {
      readonly ok: false;
      readonly reason: SearchReason;
    }
> {
  const hotel = await fetchTravelportHotel(input.slug);
  if (hotel === null) return { ok: false, reason: 'hotel_not_found' };

  const cacheKey = searchCacheKey(input.slug, input.stay);
  const cached = await loadNormalizedSearch(cacheKey);
  if (cached !== null) return { ok: true, data: cached };

  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'no_credentials' };

  const search = await searchByCoordinates(creds, {
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    radius: 1,
    unit: 'mi',
    checkInDate: input.stay.checkIn,
    checkOutDate: input.stay.checkOut,
    adults: input.stay.adults,
    currency: getTravelportCurrency(),
  });
  if (!search.ok) return { ok: false, reason: 'search_failed' };

  const item = bestMatch(hotel, search.value);
  if (item === null) return { ok: false, reason: 'no_match' };

  const rates = buildRatesFromItem(item);
  if (rates.length === 0) return { ok: false, reason: 'no_rate' };

  const data: NormalizedSearch = {
    slug: input.slug,
    hotelId: hotel.id,
    hotelName: hotel.name,
    city: hotel.city,
    region: hotel.region,
    heroImage: hotel.heroImage,
    chainCode: item.chainCode,
    propertyCode: item.propertyCode,
    propertyName: item.name,
    checkIn: input.stay.checkIn,
    checkOut: input.stay.checkOut,
    adults: input.stay.adults,
    children: input.stay.children,
    rates,
  };
  await redis.set(cacheKey, JSON.stringify(data), { ex: SEARCH_TTL_SEC });
  return { ok: true, data };
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
  if (!isTravelportSandboxEnabled() || !(await isTravelportBookingSlug(input.slug))) {
    return { ok: false, reason: 'disabled' };
  }

  const { stay, datesAdjusted } = resolveStay(input.stay);
  const res = await searchAndNormalize({ slug: input.slug, stay });
  if (!res.ok) return { ok: false, reason: res.reason };
  const data = res.data;

  const offerSetId = crypto.randomUUID();
  const set: CachedOfferSet = {
    slug: data.slug,
    hotelId: data.hotelId,
    hotelName: data.hotelName,
    city: data.city,
    region: data.region,
    heroImage: data.heroImage,
    chainCode: data.chainCode,
    propertyCode: data.propertyCode,
    propertyName: data.propertyName,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    adults: data.adults,
    children: data.children,
    rates: data.rates,
  };
  await saveOfferSet(offerSetId, set);

  return {
    ok: true,
    offerSetId,
    slug: data.slug,
    hotelName: data.hotelName,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    adults: data.adults,
    children: data.children,
    datesAdjusted,
    options: data.rates.map(toOption),
  };
}

/**
 * Verrouille le tarif **choisi** par le client (depuis l'ensemble mis en cache)
 * et persiste un draft `offer_locked` + le contexte Travelport. Le voyageur
 * réel est collecté ensuite sur `/reservation/invite` (plus de voyageur
 * sandbox codé en dur) avant le recap et la confirmation.
 */
export async function lockTravelportSandboxSelectedOffer(input: {
  readonly offerSetId: string;
  readonly rateKey: string;
  readonly locale: 'fr' | 'en';
}): Promise<TravelportSandboxLockResult> {
  if (!isTravelportSandboxEnabled()) return { ok: false, reason: 'disabled' };

  const set = await loadOfferSet(input.offerSetId);
  if (set === null) return { ok: false, reason: 'search_failed' };
  // Re-valide l'éligibilité de l'hôtel au moment du lock (l'offerSet vient du
  // cache : on ne fait jamais confiance au seul `offerSetId`). Couvre le cas
  // d'un hôtel dé-listé (booking_mode changé) entre la recherche et le lock.
  if (!(await isTravelportBookingSlug(set.slug))) return { ok: false, reason: 'hotel_not_found' };
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

  // Draft laissé en `offer_locked` : `/reservation/invite` attache ensuite le
  // vrai voyageur saisi par le client, puis passe au recap.
  const locked = startDraftFromOffer({ id: crypto.randomUUID(), mode: 'amadeus', offer });

  const snapshot: DraftHotelSnapshot = {
    id: set.hotelId,
    name: set.hotelName,
    city: set.city,
    region: set.region,
    slug: set.slug,
    roomLabel: rate.roomLabel,
    rateLabel: rate.rateLabel,
    refundable: rate.refundable,
    breakfastIncluded: rate.breakfastIncluded,
    ...(set.heroImage !== null ? { heroPublicId: set.heroImage } : {}),
  };
  await saveDraft({ draft: locked, hotel: snapshot, locale: input.locale }, OFFER_TTL_SEC);

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
  await saveTravelportContext(locked.id, bookingCtx);

  return { ok: true, draftId: locked.id, ttlSec: OFFER_TTL_SEC, hotelName: set.hotelName };
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
  readonly rooms: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly room_code: string;
  }[];
}): Promise<TravelportLiveRoomPrices | null> {
  if (!isTravelportSandboxEnabled() || !(await isTravelportBookingSlug(input.slug))) return null;
  if (input.rooms.length === 0) return null;

  let res: Awaited<ReturnType<typeof searchAndNormalize>>;
  try {
    const { stay } = resolveStay(undefined);
    res = await searchAndNormalize({ slug: input.slug, stay });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const fromByRoomId = new Map<string, number>();
  for (const room of input.rooms) {
    const wanted = normalizeName(room.name ?? room.room_code);
    if (wanted.size === 0) continue;
    let bestPrice: number | undefined;
    let bestOverlap = 0;
    for (const opt of res.data.rates) {
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

// ---------------------------------------------------------------------------
// Étape « choix de la chambre » (tunnel) — photo éditoriale par libellé
// Travelport. On rapproche chaque libellé de chambre live d'une chambre
// éditoriale (même heuristique de recouvrement de tokens que ci-dessus) et on
// renvoie sa photo (hero). Pur + best-effort : un libellé sans correspondance
// est simplement absent de la map (la carte reste sans photo, jamais cassée).
// ---------------------------------------------------------------------------

export interface RoomImageRef {
  readonly publicId: string;
  readonly alt: string;
}

export function matchEditorialRoomImages(input: {
  readonly roomLabels: readonly string[];
  readonly rooms: readonly {
    readonly name: string | null;
    readonly room_code: string;
    readonly cardImagePublicId: string | null;
    readonly cardImageAlt: string | null;
  }[];
}): ReadonlyMap<string, RoomImageRef> {
  const out = new Map<string, RoomImageRef>();
  const candidates = input.rooms.filter((r) => r.cardImagePublicId !== null);
  if (candidates.length === 0) return out;
  for (const label of new Set(input.roomLabels)) {
    const wanted = normalizeName(label);
    if (wanted.size === 0) continue;
    let best: (typeof candidates)[number] | undefined;
    let bestOverlap = 0;
    for (const room of candidates) {
      const overlap = [...normalizeName(room.name ?? room.room_code)].filter((token) =>
        wanted.has(token),
      ).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = room;
      }
    }
    if (best?.cardImagePublicId != null && best.cardImagePublicId !== '') {
      out.set(label, {
        publicId: best.cardImagePublicId,
        alt: best.cardImageAlt ?? best.name ?? label,
      });
    }
  }
  return out;
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
  if (!isTravelportSandboxEnabled() || !(await isTravelportBookingSlug(input.slug))) return [];

  let res: Awaited<ReturnType<typeof searchAndNormalize>>;
  try {
    const { stay } = resolveStay(undefined);
    res = await searchAndNormalize({ slug: input.slug, stay });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  // Dédoublonnage par libellé de chambre : on garde l'option la moins chère.
  const byLabel = new Map<string, TravelportLiveRoom>();
  for (const opt of res.data.rates) {
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
