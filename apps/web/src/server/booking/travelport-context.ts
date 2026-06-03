import 'server-only';

import { redis } from '@/lib/redis';

/**
 * Contexte de réservation Travelport persisté **à côté** du draft domaine, le
 * temps du pilote sandbox (Étape B). Le draft ne porte que l'`Offer` domaine
 * (prix EUR + politique d'annulation verbatim) ; or `createReservation` exige
 * des identifiants propres à Travelport (rateKey, garantie, codes chaîne/
 * propriété) perdus à la projection domaine. On les capture donc au lock pour
 * pouvoir réserver puis annuler depuis le tunnel, sans polluer le modèle
 * domaine ni la table `bookings`.
 *
 * Tout est gated derrière `TRAVELPORT_SANDBOX_ENABLED` côté appelants : ce
 * store n'est jamais alimenté hors pilote.
 */
export interface TravelportBookingContext {
  readonly rateKey: string;
  readonly chainCode: string;
  readonly propertyCode: string;
  readonly propertyName: string;
  readonly amount: number;
  readonly currency: string;
  readonly guaranteeType?: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly hotelId: string;
  readonly hotelName: string;
}

/** Résultat normalisé d'une réservation sandbox (ou de son annulation). */
export interface TravelportReservationRecord {
  readonly phase: 'confirmed' | 'cancelled';
  readonly status: string;
  readonly offerId?: string;
  readonly supplierConfirmation?: string;
  readonly aggregatorLocator?: string;
  readonly agencyLocator?: string;
  readonly totalPrice?: { readonly amount: number; readonly currency: string };
  /** Référence booking domaine (CT-…) une fois la ligne `bookings` créée. */
  readonly bookingRef?: string;
  /** ISO timestamp de la réservation. */
  readonly bookedAt: string;
  /** ISO timestamp de l'annulation, si annulée depuis le tunnel. */
  readonly cancelledAt?: string;
}

interface TravelportSlot {
  readonly ctx: TravelportBookingContext;
  readonly reservation?: TravelportReservationRecord;
}

const KEY_PREFIX = 'booking:tp:';
const TTL_SEC = 60 * 60; // 1 h : couvre lock → recap → réservation → annulation.

const key = (draftId: string): string => `${KEY_PREFIX}${draftId}`;

function isSlot(value: unknown): value is TravelportSlot {
  if (typeof value !== 'object' || value === null) return false;
  const ctx = (value as Record<string, unknown>)['ctx'];
  if (typeof ctx !== 'object' || ctx === null) return false;
  const c = ctx as Record<string, unknown>;
  return (
    typeof c['rateKey'] === 'string' &&
    typeof c['amount'] === 'number' &&
    typeof c['currency'] === 'string' &&
    typeof c['hotelId'] === 'string'
  );
}

export async function saveTravelportContext(
  draftId: string,
  ctx: TravelportBookingContext,
): Promise<void> {
  const slot: TravelportSlot = { ctx };
  await redis.set(key(draftId), JSON.stringify(slot), { ex: TTL_SEC });
}

async function loadSlot(draftId: string): Promise<TravelportSlot | null> {
  const raw = await redis.get<string | TravelportSlot>(key(draftId));
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return isSlot(value) ? value : null;
}

export async function loadTravelportContext(
  draftId: string,
): Promise<TravelportBookingContext | null> {
  const slot = await loadSlot(draftId);
  return slot?.ctx ?? null;
}

export async function loadTravelportReservation(
  draftId: string,
): Promise<TravelportReservationRecord | null> {
  const slot = await loadSlot(draftId);
  return slot?.reservation ?? null;
}

/** Persiste (ou met à jour) le résultat de réservation tout en gardant le contexte. */
export async function saveTravelportReservation(
  draftId: string,
  reservation: TravelportReservationRecord,
): Promise<void> {
  const slot = await loadSlot(draftId);
  if (slot === null) return;
  const next: TravelportSlot = { ctx: slot.ctx, reservation };
  await redis.set(key(draftId), JSON.stringify(next), { ex: TTL_SEC });
}

export async function deleteTravelportContext(draftId: string): Promise<void> {
  await redis.del(key(draftId));
}
