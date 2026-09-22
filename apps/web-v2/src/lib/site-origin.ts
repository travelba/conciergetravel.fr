import { env } from '@/env';

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

/** Production origin for sitemaps, llms.txt, canonical URLs in agent payloads. */
export function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}
