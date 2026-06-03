import { err, ok, type Result } from '@mch/domain/shared';

import type { TravelportError } from './errors';
import { authorizedJsonRequest, type TravelportCredentials } from './travelport-client';
import {
  CreateReservationInputSchema,
  ReservationResponseSchema,
  type CreateReservationInput,
  type ReservationCardInput,
  type ReservationGuestInput,
} from './types';

const RESERVATION_VERSION = '11';
const BUILD_PATH = '/11/hotel/book/reservations/build';

/**
 * Confirmation normalisée d'une réservation Travelport.
 *
 * Une réservation renvoie 3 reçus (`Receipt`) :
 *  - `Supplier`   : numéro de confirmation hôtel (requis pour annuler) ;
 *  - `Travelport` : locator agrégateur / PNR (requis pour retrieve/modify/cancel) ;
 *  - `Agency`     : locator de notre PCC.
 * On expose `aggregatorLocator` (clé d'annulation) en priorité.
 */
export interface ReservationConfirmation {
  readonly status: string;
  readonly offerId?: string;
  readonly supplierConfirmation?: string;
  readonly aggregatorLocator?: string;
  readonly agencyLocator?: string;
  readonly totalPrice?: { readonly amount: number; readonly currency: string };
  readonly raw: unknown;
}

/** Indicateurs de paiement déduits du type de garantie (DevKit §Payment). */
function paymentIndicators(guaranteeType: string | undefined): {
  readonly depositInd: boolean;
  readonly guaranteeInd: boolean;
} {
  const g = (guaranteeType ?? '').toLowerCase();
  // Prepay / Deposit Required → on débite la carte au booking.
  if (g.includes('prepay') || g.includes('deposit')) {
    return { depositInd: true, guaranteeInd: false };
  }
  // Guarantee Required (défaut prudent) → rien débité au booking, paiement à l'arrivée.
  return { depositInd: false, guaranteeInd: true };
}

function buildReservationPayload(
  input: CreateReservationInput,
  guest: ReservationGuestInput,
  card: ReservationCardInput,
): Record<string, unknown> {
  const indicators = paymentIndicators(input.guaranteeType);

  const telephone = {
    '@type': 'TelephoneDetail',
    ...(guest.phone.countryAccessCode !== undefined
      ? { countryAccessCode: guest.phone.countryAccessCode }
      : {}),
    areaCityCode: guest.phone.areaCityCode,
    phoneNumber: guest.phone.number,
  };

  return {
    ReservationQueryBuild: {
      '@type': 'ReservationQueryBuild',
      ReservationBuild: {
        '@type': 'ReservationBuildFromCatalogOffering',
        BuildFromCatalogOfferingHospitality: {
          '@type': 'BuildFromCatalogOfferingHospitality',
          NumberOfRooms: input.rooms,
          CatalogOfferingIdentifier: { value: input.rateKey },
        },
        Traveler: [
          {
            '@type': 'Traveler',
            PersonName: {
              Given: guest.given,
              Surname: guest.surname,
              ...(guest.prefix !== undefined ? { Prefix: guest.prefix } : {}),
            },
            Telephone: [telephone],
            Email: [{ value: guest.email }],
          },
        ],
        FormOfPayment: [
          {
            '@type': 'FormOfPaymentPaymentCard',
            PaymentCard: {
              '@type': 'PaymentCardDetail',
              expireDate: card.expireDate,
              CardType: card.cardType,
              CardCode: card.cardCode,
              CardHolderName: card.cardHolderName,
              CardNumber: { '@type': 'CardNumber', PlainText: card.number },
              ...(card.seriesCode !== undefined
                ? { SeriesCode: { '@type': 'SeriesCode', PlainText: card.seriesCode } }
                : {}),
            },
          },
        ],
        Payment: [
          {
            '@type': 'Payment',
            Amount: { code: input.currency, value: input.amount },
            depositInd: indicators.depositInd,
            guaranteeInd: indicators.guaranteeInd,
          },
        ],
      },
    },
  };
}

function extractConfirmation(parsed: unknown, raw: unknown): ReservationConfirmation {
  const safe = ReservationResponseSchema.safeParse(parsed);
  const reservation = safe.success ? safe.data.ReservationResponse?.Reservation : undefined;

  let status = 'Unknown';
  let supplierConfirmation: string | undefined;
  let aggregatorLocator: string | undefined;
  let agencyLocator: string | undefined;

  for (const receipt of reservation?.Receipt ?? []) {
    const loc = receipt.Confirmation?.Locator;
    const ctx = loc?.sourceContext;
    const value = loc?.value;
    const st = receipt.Confirmation?.OfferStatus?.Status;
    if (typeof st === 'string' && status === 'Unknown') status = st;
    if (value === undefined) continue;
    if (ctx === 'Supplier') supplierConfirmation = value;
    else if (ctx === 'Agency') agencyLocator = value;
    else if (ctx === 'Travelport' || loc?.locatorType === 'PNR Locator') aggregatorLocator = value;
  }

  const offer = reservation?.Offer?.[0];
  const offerId = offer?.Identifier?.value;
  const amount = offer?.Price?.TotalPrice;
  const currency = offer?.Price?.CurrencyCode?.value;

  return {
    status,
    ...(offerId !== undefined ? { offerId } : {}),
    ...(supplierConfirmation !== undefined ? { supplierConfirmation } : {}),
    ...(aggregatorLocator !== undefined ? { aggregatorLocator } : {}),
    ...(agencyLocator !== undefined ? { agencyLocator } : {}),
    ...(amount !== undefined && currency !== undefined ? { totalPrice: { amount, currency } } : {}),
    raw,
  };
}

export interface CreateReservationOptions {
  /** Clé d'idempotence — obligatoire pour sécuriser le rejeu d'un booking. */
  readonly idempotencyKey: string;
  /** Rejouer en acceptant un changement de prix amont (2e tentative). */
  readonly acceptPriceChange?: boolean;
  /** Rejouer en acceptant un changement de type de garantie (2e tentative). */
  readonly acceptGuaranteeChange?: boolean;
}

/**
 * Crée une réservation (reference payload) à partir d'un `rateKey` issu de
 * SearchComplete v12 / Availability v11. En cas d'écart de prix ou de
 * garantie, Travelport renvoie une erreur ; relancer avec
 * `acceptPriceChange`/`acceptGuaranteeChange` (query params) pour confirmer.
 */
export async function createReservation(
  creds: TravelportCredentials,
  rawInput: CreateReservationInput,
  guest: ReservationGuestInput,
  card: ReservationCardInput,
  opts: CreateReservationOptions,
): Promise<Result<ReservationConfirmation, TravelportError>> {
  const input = CreateReservationInputSchema.parse(rawInput);
  const payload = buildReservationPayload(input, guest, card);

  const query: Record<string, string> = {};
  if (opts.acceptPriceChange === true) query['acceptPriceChangeInd'] = 'true';
  if (opts.acceptGuaranteeChange === true) query['acceptGuaranteeChangeInd'] = 'true';

  const res = await authorizedJsonRequest(creds, {
    method: 'POST',
    pathname: BUILD_PATH,
    version: RESERVATION_VERSION,
    jsonBody: payload,
    idempotencyKey: opts.idempotencyKey,
    ...(Object.keys(query).length > 0 ? { query } : {}),
  });
  if (!res.ok) return err(res.error);

  return ok(extractConfirmation(res.value.json, res.value.json));
}

/**
 * Annule une réservation via le locator agrégateur (Travelport).
 * `PUT /11/hotel/book/reservations/{aggregatorLocator}/canceloffer?supplierLocator=...`.
 *
 * Le paramètre `supplierLocator` (numéro de confirmation hôtel renvoyé par
 * `createReservation`) est **obligatoire** côté Travelport.
 */
export async function cancelReservation(
  creds: TravelportCredentials,
  aggregatorLocator: string,
  opts: { readonly idempotencyKey: string; readonly supplierLocator: string },
): Promise<Result<{ readonly status: string; readonly raw: unknown }, TravelportError>> {
  const path = `/11/hotel/book/reservations/${encodeURIComponent(aggregatorLocator)}/canceloffer`;
  const res = await authorizedJsonRequest(creds, {
    method: 'PUT',
    pathname: path,
    version: RESERVATION_VERSION,
    query: { supplierLocator: opts.supplierLocator },
    idempotencyKey: opts.idempotencyKey,
  });
  if (!res.ok) return err(res.error);

  const confirmation = extractConfirmation(res.value.json, res.value.json);
  const status = confirmation.status === 'Unknown' ? 'Cancelled' : confirmation.status;
  return ok({ status, raw: res.value.json });
}
