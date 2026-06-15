import 'server-only';

import { env } from '@/lib/env';

/**
 * Kill-switch for ADR-0026 rate-shopping on the fiche/tunnel.
 *
 * With `SKIP_ENV_VALIDATION=true`, `@t3-oss/env-nextjs` skips Zod coercion so
 * `.env.local` values like `"1"` stay strings — mirror `isTravelportSandboxEnabled`.
 */
export function isMultiSupplierRateShoppingEnabled(): boolean {
  const raw: unknown = env.MULTI_SUPPLIER_RATESHOPPING_ENABLED;
  return raw === true || raw === 'true' || raw === '1';
}
