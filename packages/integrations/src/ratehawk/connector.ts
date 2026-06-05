/**
 * RateHawk adapter for `HotelSupplierConnector`.
 *
 * - searchAvailability  -> hotelpage rates mapped to NormalizedRate (EUR).
 * - getStaticRoomContent -> room_groups mapped to NormalizedRoomStatic.
 *   `indexableContent` is FALSE: RateHawk media/descriptions must never be
 *   exposed on index,follow pages (ETG contract).
 */
import { err, ok, type Result } from '@mch/domain/shared';

import type { BookingCapableConnector } from '../supplier/connector';
import { parseCurrency, toEurMinor } from '../supplier/money';
import type {
  BoardType,
  NormalizedRate,
  NormalizedRoomStatic,
  StayQuery,
  SupplierBookInput,
  SupplierBookingConfirmation,
  SupplierCancelInput,
  SupplierCancelResult,
  SupplierError,
  SupplierPrebookResult,
  SupplierPropertyKey,
} from '../supplier/types';

import { book as bookOrder, cancel as cancelOrder, prebook as prebookRate } from './booking';
import { fetchHotelContent, searchHotelPage, type RateHawkClientConfig } from './client';
import type { RateHawkHpRate } from './types';

function boardFromMeal(meal: string | undefined): { board: BoardType; breakfast: boolean | null } {
  const m = (meal ?? '').toLowerCase();
  if (m === '' || m === 'nomeal' || m === 'room-only')
    return { board: 'room_only', breakfast: false };
  if (m.includes('all') && m.includes('inclusive'))
    return { board: 'all_inclusive', breakfast: true };
  if (m.includes('full')) return { board: 'full_board', breakfast: true };
  if (m.includes('half')) return { board: 'half_board', breakfast: true };
  if (m.includes('breakfast')) return { board: 'breakfast', breakfast: true };
  return { board: 'unknown', breakfast: null };
}

function priceMinorFromRate(rate: RateHawkHpRate): { minor: number; currency: string } | null {
  const pt = rate.payment_options?.payment_types?.[0];
  if (pt === undefined) return null;
  const amountStr = pt.show_amount ?? pt.amount;
  const currency = pt.show_currency_code ?? pt.currency_code ?? 'EUR';
  if (amountStr === undefined) return null;
  const amount = Number.parseFloat(amountStr);
  if (!Number.isFinite(amount)) return null;
  return { minor: Math.round(amount * 100), currency };
}

function cancellationFromRate(rate: RateHawkHpRate): {
  refundable: boolean | null;
  text: string;
} {
  const pt = rate.payment_options?.payment_types?.[0];
  const free = pt?.cancellation_penalties?.free_cancellation_before ?? null;
  if (free !== null && free !== '') {
    const date = free.slice(0, 10);
    return { refundable: true, text: `Annulation gratuite jusqu'au ${date}.` };
  }
  return { refundable: false, text: 'Non remboursable.' };
}

function capacityFromRgExt(rgExt: Readonly<Record<string, number>> | undefined): number | null {
  if (rgExt === undefined) return null;
  const cap = rgExt['capacity'];
  return typeof cap === 'number' && cap > 0 ? cap : null;
}

function ratesToNormalized(rates: readonly RateHawkHpRate[]): NormalizedRate[] {
  const out: NormalizedRate[] = [];
  for (const rate of rates) {
    if (rate.rg_ext === undefined) continue;
    const price = priceMinorFromRate(rate);
    if (price === null) continue;
    const currency = parseCurrency(price.currency) ?? 'EUR';
    const eur = toEurMinor(price.minor, currency);
    const { board, breakfast } = boardFromMeal(rate.meal);
    const cancellation = cancellationFromRate(rate);
    const label = rate.room_name ?? 'Room';
    out.push({
      supplier: 'ratehawk',
      rateToken: rate.book_hash,
      roomKey: { supplier: 'ratehawk', rgExt: rate.rg_ext },
      roomLabel: label,
      ratePlanLabel: rate.meal ?? 'Standard rate',
      priceMinor: eur.amountMinor,
      currency: 'EUR',
      ...(currency !== 'EUR'
        ? { originalPriceMinor: price.minor, originalCurrency: currency }
        : {}),
      board,
      breakfastIncluded: breakfast,
      refundable: cancellation.refundable,
      cancellationText: cancellation.text,
      maxOccupancy: capacityFromRgExt(rate.rg_ext),
    });
  }
  return out;
}

/** Public CDN size token used when expanding RateHawk `{size}` image URLs. */
const RATEHAWK_IMAGE_SIZE = '1024x768';

export function createRateHawkConnector(cfg: RateHawkClientConfig): BookingCapableConnector {
  return {
    supplier: 'ratehawk',
    capabilities: { search: true, staticContent: true, book: true },

    async searchAvailability(input: {
      readonly propertyKey: SupplierPropertyKey;
      readonly stay: StayQuery;
    }): Promise<Result<readonly NormalizedRate[], SupplierError>> {
      if (input.propertyKey.supplier !== 'ratehawk') {
        return err({ kind: 'not_configured', details: 'property key is not a ratehawk key' });
      }
      const res = await searchHotelPage(cfg, input.propertyKey.hotelId, {
        checkin: input.stay.checkIn,
        checkout: input.stay.checkOut,
        adults: input.stay.adults,
        currency: input.stay.currency ?? 'EUR',
        ...(input.stay.childAges && input.stay.childAges.length > 0
          ? { childAges: [...input.stay.childAges] }
          : {}),
      });
      if (!res.ok) {
        if (res.error.kind === 'no_availability') return err({ kind: 'no_availability' });
        return err({ kind: 'parse_failure', details: `ratehawk: ${res.error.kind}` });
      }
      const hotel = res.value.data?.hotels?.[0];
      const rates = hotel?.rates ?? [];
      const normalized = ratesToNormalized(rates);
      if (normalized.length === 0) return err({ kind: 'no_availability' });
      return ok(normalized);
    },

    async getStaticRoomContent(input: {
      readonly propertyKey: SupplierPropertyKey;
    }): Promise<Result<readonly NormalizedRoomStatic[], SupplierError>> {
      if (input.propertyKey.supplier !== 'ratehawk') {
        return err({ kind: 'not_configured', details: 'property key is not a ratehawk key' });
      }
      const res = await fetchHotelContent(cfg, [input.propertyKey.hotelId]);
      if (!res.ok) return err({ kind: 'parse_failure', details: `ratehawk: ${res.error.kind}` });
      const hotel = res.value.data?.hotels?.[0];
      const groups = hotel?.room_groups ?? [];
      const out: NormalizedRoomStatic[] = [];
      for (const g of groups) {
        if (g.rg_ext === undefined) continue;
        const fromImages = (g.images ?? []).map((u) => u.replace('{size}', RATEHAWK_IMAGE_SIZE));
        const fromExt = (g.images_ext ?? [])
          .map((i) => i.url)
          .filter((u): u is string => typeof u === 'string')
          .map((u) => u.replace('{size}', RATEHAWK_IMAGE_SIZE));
        out.push({
          roomKey: { supplier: 'ratehawk', rgExt: g.rg_ext },
          name: g.name ?? null,
          amenities: g.room_amenities ?? [],
          imageUrls: [...fromImages, ...fromExt],
          indexableContent: false,
        });
      }
      return ok(out);
    },

    async prebook(input: {
      readonly rateToken: string;
    }): Promise<Result<SupplierPrebookResult, SupplierError>> {
      const res = await prebookRate(cfg, input.rateToken);
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk prebook: ${res.error.kind}` });
      const currency = parseCurrency(res.value.currency) ?? 'EUR';
      const eur = toEurMinor(res.value.priceMinor, currency);
      return ok({
        rateToken: res.value.bookHash,
        priceMinor: eur.amountMinor,
        currency: 'EUR',
        priceChanged: res.value.changed,
        available: res.value.bookHash.length > 0,
      });
    },

    async book(
      input: SupplierBookInput,
    ): Promise<Result<SupplierBookingConfirmation, SupplierError>> {
      const res = await bookOrder(cfg, {
        bookHash: input.rateToken,
        partnerOrderId: input.partnerOrderId,
        leadGuest: { firstName: input.leadGuest.firstName, lastName: input.leadGuest.lastName },
        guests: input.guests.map((g) => ({ firstName: g.firstName, lastName: g.lastName })),
        email: input.email,
        phone: input.phone,
      });
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk book: ${res.error.kind}` });
      return ok({
        supplier: 'ratehawk',
        partnerOrderId: res.value.partnerOrderId,
        supplierOrderId: res.value.orderId,
        status: res.value.status,
      });
    },

    async cancel(input: SupplierCancelInput): Promise<Result<SupplierCancelResult, SupplierError>> {
      const res = await cancelOrder(cfg, input.partnerOrderId);
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk cancel: ${res.error.kind}` });
      return ok({ cancelled: res.value.cancelled, status: res.value.status });
    },
  };
}
