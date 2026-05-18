import { NextResponse } from 'next/server';

import { buildSitemapXml, type SitemapEntry } from '@mch/seo';

import { env } from '@/lib/env';
import { listPublishedGuides } from '@/server/guides/get-guide-by-slug';

export const revalidate = 3600;

const FALLBACK_SITE_URL = 'https://myconciergehotel.com';

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_SITE_URL).replace(/\/$/, '');
}

/**
 * Editorial destination-guides sub-sitemap (skill: seo-technical).
 * Emits one entry per published guide with FR + EN alternates and a
 * monthly changefreq (long-reads change less often than fiches).
 * Falls back to an empty `<urlset>` on any read error.
 */
export async function GET(): Promise<NextResponse> {
  const origin = siteOrigin();
  let entries: SitemapEntry[] = [];

  try {
    const guides = await listPublishedGuides();
    for (const g of guides) {
      const frUrl = `${origin}/guide/${g.slug}`;
      const enUrl = `${origin}/en/guide/${g.slug}`;
      const entry: SitemapEntry = {
        loc: frUrl,
        changefreq: 'monthly',
        priority: 0.7,
        alternates: [
          { hreflang: 'fr-FR', href: frUrl },
          { hreflang: 'en', href: enUrl },
          { hreflang: 'x-default', href: frUrl },
        ],
      };
      // exactOptionalPropertyTypes — only set lastmod when we actually
      // have a reviewedAt value, never as `undefined`.
      if (g.reviewedAt !== null && g.reviewedAt !== undefined) {
        (entry as { lastmod?: string }).lastmod = g.reviewedAt;
      }
      entries.push(entry);
    }
    // Also include the hub.
    entries.unshift({
      loc: `${origin}/guides`,
      changefreq: 'weekly',
      priority: 0.6,
      alternates: [
        { hreflang: 'fr-FR', href: `${origin}/guides` },
        { hreflang: 'en', href: `${origin}/en/guides` },
        { hreflang: 'x-default', href: `${origin}/guides` },
      ],
    });
  } catch {
    entries = [];
  }

  const xml = buildSitemapXml(entries);
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
