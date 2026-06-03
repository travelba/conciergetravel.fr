import 'server-only';

import {
  cancelReservation,
  createReservation,
  type ReservationCardInput,
  type ReservationConfirmation,
  type ReservationGuestInput,
} from '@mch/integrations/travelport';

import {
  getTravelportCredentials,
  getTravelportTestCard,
  isTravelportSandboxEnabled,
} from '@/lib/travelport';

import { loadDraft } from './draft-store';
import {
  loadTravelportContext,
  loadTravelportReservation,
  saveTravelportReservation,
  type TravelportReservationRecord,
} from './travelport-context';

/**
 * Confirmation + annulation **réelles** d'une réservation Travelport (sandbox
 * preprod) depuis le tunnel — Étape B du câblage. Tout est gated derrière
 * `TRAVELPORT_SANDBOX_ENABLED` ; la carte de garantie est une carte de test
 * (env `TRAVELPORT_TEST_CARD_*` ou, à défaut, la carte DevKit). Aucune carte
 * réelle ne transite par ce chemin, et rien n'est écrit en base `bookings` :
 * le résultat (locators + statut) vit dans le store latéral Redis du draft.
 */

export type TravelportConfirmResult =
  | { readonly ok: true; readonly reservation: TravelportReservationRecord }
  | {
      readonly ok: false;
      readonly reason: 'disabled' | 'no_draft' | 'no_context' | 'upstream' | 'already_cancelled';
    };

/** Carte DevKit sandbox — utilisée si aucune `TRAVELPORT_TEST_CARD_*` n'est définie. */
const DEVKIT_TEST_CARD: ReservationCardInput = {
  cardCode: 'VI',
  cardType: 'Credit',
  cardHolderName: 'Sandbox Concierge',
  number: '4444333322221111',
  expireDate: '1130',
  seriesCode: '343',
};

function toReservationGuest(
  firstName: string,
  lastName: string,
  email: string,
): ReservationGuestInput {
  return {
    given: firstName,
    surname: lastName,
    email,
    // Téléphone sandbox fixe (format Travelport) — le draft ne porte qu'une
    // chaîne E.164 non découpée ; inutile de la parser pour le pilote.
    phone: { countryAccessCode: '33', areaCityCode: '01', number: '40000000' },
  };
}

function recordFromConfirmation(c: ReservationConfirmation): TravelportReservationRecord {
  return {
    phase: 'confirmed',
    status: c.status,
    ...(c.offerId !== undefined ? { offerId: c.offerId } : {}),
    ...(c.supplierConfirmation !== undefined
      ? { supplierConfirmation: c.supplierConfirmation }
      : {}),
    ...(c.aggregatorLocator !== undefined ? { aggregatorLocator: c.aggregatorLocator } : {}),
    ...(c.agencyLocator !== undefined ? { agencyLocator: c.agencyLocator } : {}),
    ...(c.totalPrice !== undefined ? { totalPrice: c.totalPrice } : {}),
    bookedAt: new Date().toISOString(),
  };
}

/**
 * Crée la réservation sandbox pour le draft donné. Idempotent : si une
 * réservation confirmée existe déjà pour ce draft, on la renvoie sans
 * re-réserver.
 */
export async function confirmTravelportSandboxReservation(
  draftId: string,
): Promise<TravelportConfirmResult> {
  if (!isTravelportSandboxEnabled()) return { ok: false, reason: 'disabled' };

  const existing = await loadTravelportReservation(draftId);
  if (existing !== null && existing.phase === 'confirmed') {
    return { ok: true, reservation: existing };
  }

  const persisted = await loadDraft(draftId);
  if (persisted === null || persisted.draft.offer?.provider !== 'travelport') {
    return { ok: false, reason: 'no_draft' };
  }
  const guest = persisted.draft.guest;
  const ctx = await loadTravelportContext(draftId);
  if (ctx === null || guest === undefined) return { ok: false, reason: 'no_context' };

  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'disabled' };

  const reservationGuest = toReservationGuest(guest.firstName, guest.lastName, guest.email);
  const card = getTravelportTestCard() ?? DEVKIT_TEST_CARD;

  const baseInput = {
    rateKey: ctx.rateKey,
    rooms: 1,
    currency: ctx.currency,
    amount: ctx.amount,
    ...(ctx.guaranteeType !== undefined ? { guaranteeType: ctx.guaranteeType } : {}),
    acceptPriceChange: false,
    acceptGuaranteeChange: false,
  };

  const idempotencyKey = `tp-book-${draftId}`;
  let result = await createReservation(creds, baseInput, reservationGuest, card, {
    idempotencyKey,
  });

  // Rejeu unique en acceptant un éventuel changement de prix/garantie amont,
  // comme le CLI `travelport:book`.
  if (
    !result.ok &&
    (result.error.kind === 'pricing_changed' || result.error.kind === 'guarantee_changed')
  ) {
    result = await createReservation(creds, baseInput, reservationGuest, card, {
      idempotencyKey: `${idempotencyKey}-retry`,
      acceptPriceChange: true,
      acceptGuaranteeChange: true,
    });
  }

  if (!result.ok) return { ok: false, reason: 'upstream' };

  const record = recordFromConfirmation(result.value);
  await saveTravelportReservation(draftId, record);
  return { ok: true, reservation: record };
}

/**
 * Annule la réservation sandbox associée au draft. Nécessite le locator
 * agrégateur + la confirmation supplier (tous deux renvoyés au booking).
 */
export async function cancelTravelportSandboxReservation(
  draftId: string,
): Promise<TravelportConfirmResult> {
  if (!isTravelportSandboxEnabled()) return { ok: false, reason: 'disabled' };

  const existing = await loadTravelportReservation(draftId);
  if (existing === null) return { ok: false, reason: 'no_context' };
  if (existing.phase === 'cancelled') return { ok: false, reason: 'already_cancelled' };
  if (existing.aggregatorLocator === undefined || existing.supplierConfirmation === undefined) {
    return { ok: false, reason: 'upstream' };
  }

  const creds = getTravelportCredentials();
  if (creds === null) return { ok: false, reason: 'disabled' };

  const cancelled = await cancelReservation(creds, existing.aggregatorLocator, {
    idempotencyKey: `tp-cancel-${draftId}`,
    supplierLocator: existing.supplierConfirmation,
  });
  if (!cancelled.ok) return { ok: false, reason: 'upstream' };

  const record: TravelportReservationRecord = {
    ...existing,
    phase: 'cancelled',
    status: cancelled.value.status,
    cancelledAt: new Date().toISOString(),
  };
  await saveTravelportReservation(draftId, record);
  return { ok: true, reservation: record };
}
