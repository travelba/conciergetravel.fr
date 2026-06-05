import 'server-only';

import {
  isBookingCapable,
  type BookingCapableConnector,
  type Supplier,
} from '@mch/integrations/supplier';

import { getSupplierConnectors } from '@/server/booking/supplier-registry';

/**
 * Booking router (Phase 5.4).
 *
 * The rate-shopping orchestrator picks the winning supplier per room; this
 * resolves HOW to lock/book that supplier:
 *   - `connector`        : supplier exposes normalised prebook/book/cancel
 *                          (RateHawk). The caller drives the connector.
 *   - `legacy_travelport`: Travelport books through the existing reservation
 *                          path (apps/web travelport-confirm), not this
 *                          connector — kept intact to avoid regressions.
 *   - `concierge_email`  : no live booking API (Little Emperors) — hand over
 *                          to the concierge / email-request flow.
 *   - `unavailable`      : supplier connected but not currently bookable
 *                          (e.g. RateHawk enabled but creds missing).
 */
export type BookingRoute =
  | {
      readonly kind: 'connector';
      readonly supplier: Supplier;
      readonly connector: BookingCapableConnector;
    }
  | { readonly kind: 'legacy_travelport' }
  | { readonly kind: 'concierge_email'; readonly supplier: Supplier }
  | { readonly kind: 'unavailable'; readonly supplier: Supplier };

export function resolveBookingRoute(supplier: Supplier): BookingRoute {
  if (supplier === 'travelport') return { kind: 'legacy_travelport' };
  if (supplier === 'little_emperors') return { kind: 'concierge_email', supplier };

  const connector = getSupplierConnectors().get(supplier);
  if (connector !== undefined && isBookingCapable(connector)) {
    return { kind: 'connector', supplier, connector };
  }
  return { kind: 'unavailable', supplier };
}
