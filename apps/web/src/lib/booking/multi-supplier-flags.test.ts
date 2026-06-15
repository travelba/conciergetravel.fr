import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    MULTI_SUPPLIER_RATESHOPPING_ENABLED: '1',
  },
}));

import { isMultiSupplierRateShoppingEnabled } from './multi-supplier-flags';

describe('isMultiSupplierRateShoppingEnabled', () => {
  it('accepts string "1" when skipValidation bypasses Zod coercion', () => {
    expect(isMultiSupplierRateShoppingEnabled()).toBe(true);
  });
});
