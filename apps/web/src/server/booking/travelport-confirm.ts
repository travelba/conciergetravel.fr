import 'server-only';

import { BookingConfirmationGuest, renderEmailHtml, renderEmailText } from '@mch/emails';
import { generateBookingRef, type BookingDraft, type Guest } from '@mch/domain/booking';
import { sendBrevoTransactionalEmail } from '@mch/integrations/brevo';
import {
  cancelReservation,
  createReservation,
  type ReservationCardInput,
  type ReservationConfirmation,
  type ReservationGuestInput,
} from '@mch/integrations/travelport';
import { getTranslations } from 'next-intl/server';

import { intlLocaleTag } from '@/i18n/runtime';
import { env } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  getTravelportCredentials,
  getTravelportTestCard,
  isTravelportSandboxEnabled,
} from '@/lib/travelport';
import { getOptionalUser } from '@/server/auth/session';

import { loadDraft, type DraftHotelSnapshot } from './draft-store';
import { serverClock, webCryptoRandomSource } from './ports';
import {
  loadTravelportContext,
  loadTravelportReservation,
  saveTravelportReservation,
  type TravelportReservationRecord,
} from './travelport-context';

/**
 * Confirmation + annulation **réelles** d'une réservation Travelport (sandbox
 * preprod) depuis le tunnel. Tout est gated derrière `TRAVELPORT_SANDBOX_ENABLED` ;
 * la carte de garantie est une carte de test (env `TRAVELPORT_TEST_CARD_*` ou, à
 * défaut, la carte DevKit). Aucune carte réelle ne transite par ce chemin.
 *
 * Étape C — la réservation confirmée est désormais persistée en base `bookings`
 * (canal `travelport`, locators dédiés) et déclenche l'e-mail de confirmation
 * Brevo. La persistance + l'e-mail sont *best-effort* : la réservation amont est
 * déjà créée, on ne la perd jamais (le store latéral Redis garde les locators
 * nécessaires à l'annulation même si l'écriture DB échoue).
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

/** Repli si le numéro saisi est inexploitable (jamais bloquant côté sandbox). */
const FALLBACK_PHONE: ReservationGuestInput['phone'] = {
  countryAccessCode: '33',
  areaCityCode: '01',
  number: '40000000',
};

/**
 * Découpe le numéro saisi par le client (E.164 ou national) vers la structure
 * Travelport `{ countryAccessCode?, areaCityCode, number }`. Best-effort : le
 * sandbox ne valide pas finement le découpage, mais on transmet désormais le
 * **vrai** numéro du voyageur plutôt qu'un numéro fixe.
 */
function parsePhone(raw: string): ReservationGuestInput['phone'] {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return FALLBACK_PHONE;

  let countryAccessCode: string | undefined;
  if (hasPlus) {
    // Indicatif pays : on isole le cas FR (33) fréquent, sinon 2 chiffres.
    if (digits.startsWith('33')) {
      countryAccessCode = '33';
      digits = digits.slice(2);
    } else {
      countryAccessCode = digits.slice(0, 2);
      digits = digits.slice(2);
    }
  }
  // Numéro national : retire un éventuel 0 de préfixe (FR) puis découpe un
  // indicatif de zone court + le reste.
  digits = digits.replace(/^0/, '');
  if (digits.length < 2) return FALLBACK_PHONE;
  const areaCityCode = digits.slice(0, 1);
  const number = digits.slice(1);
  return countryAccessCode !== undefined
    ? { countryAccessCode, areaCityCode, number }
    : { areaCityCode, number };
}

function toReservationGuest(guest: Guest): ReservationGuestInput {
  return {
    given: guest.firstName,
    surname: guest.lastName,
    email: guest.email,
    phone: parsePhone(guest.phone),
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

const isoDateOnly = (s: string): string => s.slice(0, 10);

function nightCount(checkIn: string, checkOut: string): number {
  const inMs = Date.parse(`${isoDateOnly(checkIn)}T00:00:00Z`);
  const outMs = Date.parse(`${isoDateOnly(checkOut)}T00:00:00Z`);
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 1;
  const diff = Math.round((outMs - inMs) / 86_400_000);
  return diff > 0 ? diff : 1;
}

const fmtEur = (amountMinor: number, locale: 'fr' | 'en'): string =>
  new Intl.NumberFormat(intlLocaleTag(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);

/**
 * Persiste la réservation Travelport en base `bookings` (service-role, canal
 * `travelport`). Best-effort : renvoie la `booking_ref` créée, ou `null` si
 * l'écriture échoue (la réservation amont reste valide et annulable via Redis).
 */
async function persistTravelportBooking(input: {
  readonly draft: BookingDraft;
  readonly hotel: DraftHotelSnapshot;
  readonly record: TravelportReservationRecord;
  readonly userId: string | null;
}): Promise<string | null> {
  const { draft, hotel, record, userId } = input;
  if (draft.offer === undefined || draft.guest === undefined) return null;

  const refResult = generateBookingRef(serverClock, webCryptoRandomSource);
  if (!refResult.ok) return null;
  const bookingRef = refResult.value;

  const totalEur = draft.offer.totalPrice.amountMinor / 100;
  const nights = nightCount(draft.offer.stay.checkIn, draft.offer.stay.checkOut);
  const pricePerNight = Number((totalEur / nights).toFixed(2));

  try {
    const supabase = getSupabaseAdminClient();
    const insert = await supabase
      .from('bookings')
      .insert({
        booking_ref: bookingRef,
        hotel_id: hotel.id,
        user_id: userId,
        guest_firstname: draft.guest.firstName,
        guest_lastname: draft.guest.lastName,
        guest_email: draft.guest.email,
        guest_phone: draft.guest.phone,
        checkin_date: isoDateOnly(draft.offer.stay.checkIn),
        checkout_date: isoDateOnly(draft.offer.stay.checkOut),
        adults: draft.offer.guests.adults,
        children: draft.offer.guests.children,
        rate_code: draft.offer.roomCode,
        price_per_night: pricePerNight,
        total_price: totalEur,
        currency: draft.offer.totalPrice.currency,
        cancellation_policy: { rawText: draft.offer.cancellationPolicyText },
        // Garantie sandbox : montant garanti, jamais capturé.
        payment_status: 'authorized',
        status: 'confirmed',
        booking_channel: 'travelport',
        ...(record.supplierConfirmation !== undefined
          ? { travelport_supplier_locator: record.supplierConfirmation }
          : {}),
        ...(record.aggregatorLocator !== undefined
          ? { travelport_aggregator_locator: record.aggregatorLocator }
          : {}),
        ...(record.agencyLocator !== undefined
          ? { travelport_agency_locator: record.agencyLocator }
          : {}),
      })
      .select('id')
      .single();

    if (insert.error) {
      console.error('[travelport] bookings insert failed', insert.error.message);
      return null;
    }
    return bookingRef;
  } catch (e) {
    console.error('[travelport] bookings insert threw', e);
    return null;
  }
}

/**
 * Envoie l'e-mail de confirmation Brevo. Best-effort : toute erreur (clé Brevo
 * absente en dev local, panne SMTP…) est avalée pour ne pas casser le tunnel.
 */
async function sendTravelportConfirmationEmail(input: {
  readonly draft: BookingDraft;
  readonly hotel: DraftHotelSnapshot;
  readonly locale: 'fr' | 'en';
  readonly bookingRef: string;
}): Promise<void> {
  const { draft, hotel, locale, bookingRef } = input;
  if (draft.offer === undefined || draft.guest === undefined) return;
  // `SKIP_ENV_VALIDATION=true` (dev local) laisse passer une clé absente bien que
  // le type soit `string` — on élargit pour garder le guard honnête.
  const apiKey: string | undefined = env.BREVO_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) return;

  try {
    const element = BookingConfirmationGuest({
      locale,
      guestFirstName: draft.guest.firstName,
      hotelName: hotel.name,
      hotelLocation: `${hotel.city}, ${hotel.region}`,
      checkIn: draft.offer.stay.checkIn,
      checkOut: draft.offer.stay.checkOut,
      totalLabel: fmtEur(draft.offer.totalPrice.amountMinor, locale),
      bookingRef,
      cancellationPolicyText: draft.offer.cancellationPolicyText,
    });
    const [html, text] = await Promise.all([renderEmailHtml(element), renderEmailText(element)]);
    const t = await getTranslations({ locale, namespace: 'emails' });
    const subject = t('bookingConfirmedSubject', { hotelName: hotel.name, bookingRef });

    await sendBrevoTransactionalEmail(
      { apiKey },
      {
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to: [{ email: draft.guest.email }],
        subject,
        htmlContent: html,
        ...(text.length > 0 ? { textContent: text } : {}),
      },
    );
  } catch (e) {
    console.error('[travelport] confirmation email failed', e);
  }
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

  const reservationGuest = toReservationGuest(guest);
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

  const baseRecord = recordFromConfirmation(result.value);

  // Persistance `bookings` + e-mail (best-effort, jamais bloquant).
  const sessionUser = await getOptionalUser();
  const userId = sessionUser !== null ? sessionUser.id : null;
  const bookingRef = await persistTravelportBooking({
    draft: persisted.draft,
    hotel: persisted.hotel,
    record: baseRecord,
    userId,
  });

  const record: TravelportReservationRecord =
    bookingRef !== null ? { ...baseRecord, bookingRef } : baseRecord;
  await saveTravelportReservation(draftId, record);

  if (bookingRef !== null) {
    await sendTravelportConfirmationEmail({
      draft: persisted.draft,
      hotel: persisted.hotel,
      locale: persisted.locale,
      bookingRef,
    });
  }

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

  // Reflète l'annulation en base si la ligne `bookings` a été créée (best-effort).
  if (existing.bookingRef !== undefined) {
    try {
      const supabase = getSupabaseAdminClient();
      const update = await supabase
        .from('bookings')
        .update({ status: 'cancelled', payment_status: 'cancelled' })
        .eq('booking_ref', existing.bookingRef);
      if (update.error) {
        console.error('[travelport] bookings cancel update failed', update.error.message);
      }
    } catch (e) {
      console.error('[travelport] bookings cancel update threw', e);
    }
  }

  const record: TravelportReservationRecord = {
    ...existing,
    phase: 'cancelled',
    status: cancelled.value.status,
    cancelledAt: new Date().toISOString(),
  };
  await saveTravelportReservation(draftId, record);
  return { ok: true, reservation: record };
}
