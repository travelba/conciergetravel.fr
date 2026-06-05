/**
 * Little Emperors adapter for `HotelSupplierConnector`.
 *
 * Little Emperors is a private members club with proprietary in-house tech and
 * NO public B2B API (verified 2026-06). It therefore cannot participate in
 * automated rate-shopping. The connector advertises zero machine capabilities
 * and degrades to a concierge/email handover: when a hotel is connected to
 * Little Emperors, the booking funnel should route the request to the
 * concierge (email mode) rather than attempt a live search.
 *
 * If a private partnership API is granted later, replace the `unsupported`
 * implementations with real `searchAvailability` / `getStaticRoomContent`
 * calls (env: LITTLE_EMPERORS_API_BASE / LITTLE_EMPERORS_API_KEY).
 */
import { err, type Result } from '@mch/domain/shared';

import type { HotelSupplierConnector } from '../supplier/connector';
import type { NormalizedRate, NormalizedRoomStatic, SupplierError } from '../supplier/types';

/** How a Little Emperors booking is fulfilled in the absence of an API. */
export type LittleEmperorsFulfilment = 'concierge_email';

export const LITTLE_EMPERORS_FULFILMENT: LittleEmperorsFulfilment = 'concierge_email';

export function createLittleEmperorsConnector(): HotelSupplierConnector {
  return {
    supplier: 'little_emperors',
    capabilities: { search: false, staticContent: false, book: false },

    searchAvailability(): Promise<Result<readonly NormalizedRate[], SupplierError>> {
      return Promise.resolve(
        err({
          kind: 'unsupported',
          capability: 'searchAvailability (no public API — concierge/email handover)',
        }),
      );
    },

    getStaticRoomContent(): Promise<Result<readonly NormalizedRoomStatic[], SupplierError>> {
      return Promise.resolve(err({ kind: 'unsupported', capability: 'staticContent' }));
    },
  };
}
