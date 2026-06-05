/**
 * Travelport adapter for `HotelSupplierConnector`.
 *
 * Wraps the existing `@mch/integrations/travelport` vendor client and maps its
 * SearchComplete room/rate shape to the supplier-agnostic `NormalizedRate`.
 * Travelport prices are requested in EUR (EUR-only domain constraint), so the
 * currency conversion is identity.
 *
 * Travelport has NO static room content API (no photos/descriptions), so
 * `getStaticRoomContent` reports `unsupported`.
 */
import { err, ok, type Result } from '@mch/domain/shared';
import {
  searchByProperty,
  type PropertyItem,
  type TravelportCredentials,
  type TravelportRateTerms,
  type SearchCompleteResponse,
} from '@mch/integrations/travelport';

import type { HotelSupplierConnector } from '../connector';
import { parseCurrency, toEurMinor } from '../money';
import type {
  BoardType,
  NormalizedRate,
  NormalizedRoomStatic,
  StayQuery,
  SupplierError,
  SupplierPropertyKey,
} from '../types';

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

function boardFromBreakfast(breakfast: boolean | null): BoardType {
  if (breakfast === true) return 'breakfast';
  return 'unknown';
}

function ratesFromProperty(item: PropertyItem): NormalizedRate[] {
  const out: NormalizedRate[] = [];
  const seen = new Set<string>();
  for (const rt of item.roomTypes ?? []) {
    const roomLabel = rt.shortRoomDescription ?? 'Chambre';
    const maxOccupancy = typeof rt.maxOccupancy === 'number' ? rt.maxOccupancy : null;
    for (const rate of rt.rates ?? []) {
      const rateKey = rate.rateKey?.value;
      const amount = rate.price?.totalPrice?.amount;
      if (rateKey === undefined || amount === undefined || seen.has(rateKey)) continue;
      seen.add(rateKey);
      const currency = parseCurrency(rate.price?.currencyCode) ?? 'EUR';
      const eur = toEurMinor(Math.round(amount * 100), currency);
      const breakfast = rate.breakfastIncluded ?? null;
      const refundable = rate.refundable ?? rate.terms?.refundable ?? null;
      const label = rt.shortRoomDescription ?? rate.roomDescription ?? roomLabel;
      out.push({
        supplier: 'travelport',
        rateToken: rateKey,
        roomKey: {
          supplier: 'travelport',
          labels: [label],
          ...(typeof rate.bookingCode === 'string' && rate.bookingCode.length > 0
            ? { bookingCodes: [rate.bookingCode] }
            : {}),
        },
        roomLabel: label,
        ratePlanLabel:
          rate.rateDescription ?? (breakfast === true ? 'Petit-déjeuner inclus' : 'Tarif standard'),
        priceMinor: eur.amountMinor,
        currency: 'EUR',
        ...(currency !== 'EUR'
          ? { originalPriceMinor: Math.round(amount * 100), originalCurrency: currency }
          : {}),
        board: boardFromBreakfast(breakfast),
        breakfastIncluded: breakfast,
        refundable,
        cancellationText: cancellationFromTerms(rate.terms),
        maxOccupancy,
      });
    }
  }
  return out;
}

function firstMatchingProperty(
  resp: SearchCompleteResponse,
  chainCode: string,
  propertyCode: string,
): PropertyItem | undefined {
  return resp.hotelsResponse.propertyItems.find(
    (p) => p.chainCode === chainCode && p.propertyCode === propertyCode,
  );
}

export function createTravelportConnector(creds: TravelportCredentials): HotelSupplierConnector {
  return {
    // `book: false` here means this connector object does not implement the
    // normalised book()/cancel() methods — Travelport reservations go through
    // the existing reservation path (apps/web travelport-confirm). The
    // booking-router routes Travelport accordingly.
    supplier: 'travelport',
    capabilities: { search: true, staticContent: false, book: false },

    async searchAvailability(input: {
      readonly propertyKey: SupplierPropertyKey;
      readonly stay: StayQuery;
    }): Promise<Result<readonly NormalizedRate[], SupplierError>> {
      if (input.propertyKey.supplier !== 'travelport') {
        return err({ kind: 'not_configured', details: 'property key is not a travelport key' });
      }
      const { chainCode, propertyCode } = input.propertyKey;
      const res = await searchByProperty(creds, {
        propertyKeys: [{ chainCode, propertyCode }],
        checkInDate: input.stay.checkIn,
        checkOutDate: input.stay.checkOut,
        adults: input.stay.adults,
        rooms: 1,
        currency: 'EUR',
        ...(input.stay.childAges && input.stay.childAges.length > 0
          ? { childAges: [...input.stay.childAges] }
          : {}),
      });
      if (!res.ok) return err({ kind: 'parse_failure', details: `travelport: ${res.error.kind}` });
      const property = firstMatchingProperty(res.value, chainCode, propertyCode);
      if (property === undefined) return err({ kind: 'no_availability' });
      const rates = ratesFromProperty(property);
      if (rates.length === 0) return err({ kind: 'no_availability' });
      return ok(rates);
    },

    getStaticRoomContent(): Promise<Result<readonly NormalizedRoomStatic[], SupplierError>> {
      return Promise.resolve(err({ kind: 'unsupported', capability: 'staticContent' }));
    },
  };
}
