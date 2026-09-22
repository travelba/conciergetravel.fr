/**
 * RateHawk connector stub — Phase 9 `SupplierConnector` (Q43).
 *
 * Delegates to the existing `@mch/integrations/ratehawk` client via
 * `createRateHawkConnector`; book/cancel paths are wired but remain sandbox-only
 * until PO live credentials (Q43-accès).
 */
import { err, ok, type Result } from '@mch/domain/shared';
import type { SupplierOffer } from '@mch/domain/booking';

import { createRateHawkConnector } from '../../ratehawk/connector';
import type { RateHawkClientConfig } from '../../ratehawk/client';
import { isBookingCapable } from '../../supplier/connector';
import type { SupplierPropertyKey } from '../../supplier/types';

import { defaultPriceValidUntil, normalizedRateToSupplierOffer } from '../map-offer';
import type {
  AggregationBookInput,
  AggregationBookingConfirmation,
  AggregationCancelInput,
  AggregationCancelResult,
  AggregationError,
  AggregationQuoteInput,
  AggregationSearchInput,
  SupplierConnector,
} from '../types';

function toPropertyKey(
  key: AggregationSearchInput['propertyKey'],
): Result<SupplierPropertyKey, AggregationError> {
  if (key.supplier !== 'ratehawk') {
    return err({ kind: 'not_configured', details: 'property key is not ratehawk' });
  }
  return ok({ supplier: 'ratehawk', hotelId: key.hotelId });
}

export function createRatehawkAggregationConnector(
  cfg: RateHawkClientConfig,
  options: { readonly enabled?: boolean } = {},
): SupplierConnector {
  const inner = createRateHawkConnector(cfg);
  const enabled = options.enabled ?? true;

  return {
    supplierId: 'ratehawk',
    enabled,

    async search(
      input: AggregationSearchInput,
    ): Promise<Result<readonly SupplierOffer[], AggregationError>> {
      if (!enabled) return err({ kind: 'disabled' });
      const propertyKey = toPropertyKey(input.propertyKey);
      if (!propertyKey.ok) return propertyKey;
      const res = await inner.searchAvailability({
        propertyKey: propertyKey.value,
        stay: input.stay,
      });
      if (!res.ok) return res;
      const validUntil = defaultPriceValidUntil(Date.now());
      const offers = res.value.map((rate, index) =>
        normalizedRateToSupplierOffer(rate, {
          priority: input.priority,
          priceValidUntil: validUntil,
          idSuffix: String(index),
        }),
      );
      return ok(offers);
    },

    async quote(input: AggregationQuoteInput): Promise<Result<SupplierOffer, AggregationError>> {
      if (!enabled) return err({ kind: 'disabled' });
      if (!isBookingCapable(inner)) {
        return err({ kind: 'unsupported', capability: 'quote' });
      }
      const res = await inner.prebook({ rateToken: input.rateToken });
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk quote: ${res.error.kind}` });
      const validUntil = defaultPriceValidUntil(Date.now());
      return ok({
        id: `ratehawk:quote:${input.rateToken.slice(0, 12)}`,
        supplierId: 'ratehawk',
        rateToken: res.value.rateToken,
        roomType: { key: 'unknown', label: 'Room', maxOccupancy: null },
        ratePlanLabel: 'Quoted rate',
        totalPriceTtc: { amountMinor: res.value.priceMinor, currency: 'EUR' },
        cancellation: { rawText: '', policy: null, refundable: null },
        priceValidUntil: validUntil,
        priority: 100,
      });
    },

    async book(
      input: AggregationBookInput,
    ): Promise<Result<AggregationBookingConfirmation, AggregationError>> {
      if (!enabled) return err({ kind: 'disabled' });
      if (!isBookingCapable(inner)) {
        return err({ kind: 'unsupported', capability: 'book' });
      }
      const res = await inner.book({
        rateToken: input.rateToken,
        partnerOrderId: input.partnerOrderId,
        stay: input.stay,
        leadGuest: input.leadGuest,
        guests: input.guests,
        email: input.email,
        phone: input.phone,
      });
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk book: ${res.error.kind}` });
      return ok({
        supplierId: 'ratehawk',
        partnerOrderId: res.value.partnerOrderId,
        supplierOrderId: res.value.supplierOrderId,
        status: res.value.status,
      });
    },

    async cancel(
      input: AggregationCancelInput,
    ): Promise<Result<AggregationCancelResult, AggregationError>> {
      if (!enabled) return err({ kind: 'disabled' });
      if (!isBookingCapable(inner)) {
        return err({ kind: 'unsupported', capability: 'cancel' });
      }
      const res = await inner.cancel({ partnerOrderId: input.partnerOrderId });
      if (!res.ok)
        return err({ kind: 'parse_failure', details: `ratehawk cancel: ${res.error.kind}` });
      return ok({ cancelled: res.value.cancelled, status: res.value.status });
    },
  };
}
