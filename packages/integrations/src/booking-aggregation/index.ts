/**
 * Multi-supplier booking aggregation orchestrator (Phase 9 / Q43).
 *
 * Fans out to enabled GIATA-mapped connectors, collects normalised offers,
 * and returns raw rows for `@mch/domain/booking/aggregate-offers`.
 */
import {
  aggregateSupplierOffers,
  type AggregatedOffersResult,
  type BookingSupplierId,
} from '@mch/domain/booking';
import { ok, type Result } from '@mch/domain/shared';

import type { AggregateOffersInput, AggregateOffersOutput, AggregationError } from './types';

export type { AggregatedOffersResult };

export async function fetchOffersFromSuppliers(
  input: AggregateOffersInput,
): Promise<AggregateOffersOutput> {
  const enabledConnections = input.mapping.connections.filter((c) => c.enabled);
  const tasks = enabledConnections.map(async (connection) => {
    const connector = input.connectors.get(connection.supplierId);
    if (connector === undefined || !connector.enabled) {
      return {
        supplierId: connection.supplierId,
        offers: [] as const,
        error: { kind: 'not_configured' as const, details: 'connector missing or disabled' },
      };
    }
    const res = await connector.search({
      propertyKey: connection.propertyKey,
      stay: input.stay,
      priority: connection.priority,
    });
    if (!res.ok) {
      return { supplierId: connection.supplierId, offers: [] as const, error: res.error };
    }
    return { supplierId: connection.supplierId, offers: res.value, error: undefined };
  });

  const results = await Promise.all(tasks);
  const offers = results.flatMap((r) => r.offers);
  const suppliersQueried = results.filter((r) => r.offers.length > 0).map((r) => r.supplierId);
  const errors: Partial<Record<BookingSupplierId, AggregationError>> = {};
  for (const r of results) {
    if (r.error !== undefined) {
      errors[r.supplierId] = r.error;
    }
  }
  return { offers, suppliersQueried, errors };
}

/** Search all enabled suppliers then reduce via pure domain aggregation. */
export async function searchAndAggregateOffers(
  input: AggregateOffersInput,
): Promise<Result<AggregatedOffersResult & AggregateOffersOutput, never>> {
  const fetched = await fetchOffersFromSuppliers(input);
  const aggregated = aggregateSupplierOffers(fetched.offers);
  return ok({ ...aggregated, ...fetched });
}

export { createRatehawkAggregationConnector } from './connectors/ratehawk-connector';
export { createTravelportAggregationConnector } from './connectors/travelport-connector';
export { normalizedRateToSupplierOffer, defaultPriceValidUntil } from './map-offer';
export type {
  AggregationBookInput,
  AggregationBookingConfirmation,
  AggregationCancelInput,
  AggregationCancelResult,
  AggregationError,
  AggregationPropertyKey,
  AggregationQuoteInput,
  AggregationSearchInput,
  AggregationStayQuery,
  AggregateOffersInput,
  AggregateOffersOutput,
  GiataHotelMapping,
  GiataMappedConnection,
  SupplierConnector,
} from './types';

export const BOOKING_AGGREGATION_VERSION = '0.1.0' as const;
