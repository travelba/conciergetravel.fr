/**
 * Travelport connector stub — Phase 9 `SupplierConnector` (Q43).
 *
 * Search is wired via `createTravelportConnector`; quote/book/cancel remain
 * unsupported until the normalised reservation path is promoted from
 * `apps/web` (ADR-0026).
 */
import { err, ok, type Result } from '@mch/domain/shared';
import type { SupplierOffer } from '@mch/domain/booking';

import { createTravelportConnector } from '../../supplier/connectors/travelport-connector';
import type { TravelportCredentials } from '../../travelport';
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
  if (key.supplier !== 'travelport') {
    return err({ kind: 'not_configured', details: 'property key is not travelport' });
  }
  return ok({
    supplier: 'travelport',
    chainCode: key.chainCode,
    propertyCode: key.propertyCode,
  });
}

export function createTravelportAggregationConnector(
  creds: TravelportCredentials,
  options: { readonly enabled?: boolean } = {},
): SupplierConnector {
  const inner = createTravelportConnector(creds);
  const enabled = options.enabled ?? true;

  return {
    supplierId: 'travelport',
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

    quote(_input: AggregationQuoteInput): Promise<Result<SupplierOffer, AggregationError>> {
      return Promise.resolve(err({ kind: 'unsupported', capability: 'quote' }));
    },

    book(
      _input: AggregationBookInput,
    ): Promise<Result<AggregationBookingConfirmation, AggregationError>> {
      return Promise.resolve(err({ kind: 'unsupported', capability: 'book' }));
    },

    cancel(
      _input: AggregationCancelInput,
    ): Promise<Result<AggregationCancelResult, AggregationError>> {
      return Promise.resolve(err({ kind: 'unsupported', capability: 'cancel' }));
    },
  };
}
