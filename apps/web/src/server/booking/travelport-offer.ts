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
  type TravelportError,
} from '@mch/integrations/travelport';

import {
  getTravelportCredentials,
  getTravelportCurrency,
  isTravelportSampleSlug,
  isTravelportSandboxEnabled,
} from '@/lib/travelport';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

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
  email: 'sandbox@myconciergehotel.com',
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
      // DIAG TEMPORAIRE (Phase 6) — code court de la cause Travelport, propagé
      // à l'URL de redirect pour diagnostiquer `search_failed` sur Vercel sans
      // dépendre des logs runtime. À retirer une fois la cause confirmée.
      readonly detail?: string;
    };

/** DIAG TEMPORAIRE — résumé court et non sensible d'une `TravelportError`. */
function summarizeTravelportError(e: TravelportError): string {
  if (e.kind === 'http') {
    const h = e.error;
    if (h.kind === 'upstream_4xx' || h.kind === 'upstream_5xx') return `http_${h.kind}_${h.status}`;
    return `http_${h.kind}`;
  }
  if (e.kind === 'oauth_rejected' || e.kind === 'authorization_error') {
    return e.details !== undefined ? `${e.kind}:${e.details}` : e.kind;
  }
  if (e.kind === 'parse_failure' || e.kind === 'mapping_failure') {
    return `${e.kind}:${e.details}`;
  }
  return e.kind;
}

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
}): Promise<TravelportSandboxLockResult> {
  if (!isTravelportSandboxEnabled() || !isTravelportSampleSlug(input.slug)) {
    return { ok: false, reason: 'disabled' };
  }
  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'no_credentials' };

  const hotel = await fetchTravelportHotel(input.slug);
  if (hotel === null) return { ok: false, reason: 'hotel_not_found' };

  const now = new Date();
  const checkIn = addDaysIso(now, 30);
  const checkOut = addDaysIso(now, 31);
  const adults = 1;
  const children = 0;

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
  if (!search.ok) {
    return { ok: false, reason: 'search_failed', detail: summarizeTravelportError(search.error) };
  }

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
