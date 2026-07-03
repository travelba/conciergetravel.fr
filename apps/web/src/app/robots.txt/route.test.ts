import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://myconciergehotel.com' },
}));

import { GET } from './route';

describe('GET /robots.txt (private-area disallow, locale-prefix aware)', () => {
  it('disallows the prefix-less FR canonical private paths (as-needed default locale)', async () => {
    const body = await GET().text();
    // Regression: previously only `/fr/compte/` was disallowed while the
    // real FR URL is `/compte/` (no prefix under localePrefix:'as-needed').
    expect(body).toContain('Disallow: /compte/');
    expect(body).toContain('Disallow: /reservation/');
    expect(body).toContain('Disallow: /auth/');
  });

  it('disallows the localised EN private paths', async () => {
    const body = await GET().text();
    expect(body).toContain('Disallow: /en/account/');
    expect(body).toContain('Disallow: /en/booking/');
    expect(body).toContain('Disallow: /en/auth/');
  });

  it('still advertises the sitemap index', async () => {
    const body = await GET().text();
    expect(body).toContain('Sitemap: https://myconciergehotel.com/sitemap.xml');
  });
});
