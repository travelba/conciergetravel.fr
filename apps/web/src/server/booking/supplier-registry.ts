import 'server-only';

import { createLittleEmperorsConnector } from '@mch/integrations/little-emperors';
import { createRateHawkConnector } from '@mch/integrations/ratehawk';
import type { HotelSupplierConnector, Supplier } from '@mch/integrations/supplier';
import { createTravelportConnector } from '@mch/integrations/supplier';

import { env } from '@/lib/env';
import { getTravelportCredentials } from '@/lib/travelport';

/**
 * Builds the set of supplier connectors that are currently configured/enabled
 * for this deployment. Each connector is gated by its own env flags so a
 * missing supplier never breaks the others (graceful degradation).
 *
 * The registry is per-request cheap to build (connectors are thin wrappers);
 * we memoise it for the lifetime of the server module.
 */
let cached: ReadonlyMap<Supplier, HotelSupplierConnector> | undefined;

export function getSupplierConnectors(): ReadonlyMap<Supplier, HotelSupplierConnector> {
  if (cached !== undefined) return cached;

  const map = new Map<Supplier, HotelSupplierConnector>();

  // Travelport — reuses the existing sandbox creds factory (kill-switch:
  // TRAVELPORT_SANDBOX_ENABLED). Null when disabled or misconfigured.
  const tpCreds = getTravelportCredentials();
  if (tpCreds !== null) {
    map.set('travelport', createTravelportConnector(tpCreds));
  }

  // RateHawk — opt-in via RATEHAWK_ENABLED + creds.
  if (
    env.RATEHAWK_ENABLED === true &&
    env.RATEHAWK_API_BASE !== undefined &&
    env.RATEHAWK_KEY_ID !== undefined &&
    env.RATEHAWK_API_KEY !== undefined
  ) {
    map.set(
      'ratehawk',
      createRateHawkConnector({
        baseUrl: env.RATEHAWK_API_BASE,
        keyId: env.RATEHAWK_KEY_ID,
        apiKey: env.RATEHAWK_API_KEY,
      }),
    );
  }

  // Little Emperors — primary channel (ADR-0026). Stub until partnership API ships;
  // replace connector when LE exposes searchAvailability / book.
  if (env.LITTLE_EMPERORS_ENABLED === true) {
    map.set('little_emperors', createLittleEmperorsConnector());
  }

  cached = map;
  return cached;
}
