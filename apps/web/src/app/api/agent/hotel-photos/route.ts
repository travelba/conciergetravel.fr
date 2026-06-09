import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { buildCloudinarySrc } from '@mch/ui';

import { env } from '@/lib/env';
import { gateAgentByIp, readClientIp } from '@/server/agent/rate-limit';
import { getHotelBySlug, readGallery, readHeroImage } from '@/server/hotels/get-hotel-by-slug';
import { patchKitGoldenRow } from '@/server/hotels/kit/patch-kit-golden-row';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HERO_TRANSFORMS = 'f_auto,q_auto,w_1600,h_900,c_fill,g_auto';
const GALLERY_TRANSFORMS = 'f_auto,q_auto,w_1230,h_820,c_fill,g_auto';

const QuerySchema = z.object({
  slug: z.string().min(1),
  locale: z.enum(['fr', 'en']).default('fr'),
  category: z
    .enum([
      'exterior',
      'lobby',
      'room',
      'dining',
      'spa',
      'pool',
      'view',
      'detail',
      'concierge',
      'events',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * GET /api/agent/hotel-photos?slug=&locale= — hero + categorised gallery
 * with bilingual alt text and captions (ADR-0017 / photo-quality skill).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = readClientIp(req.headers);
  const gate = await gateAgentByIp(ip);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSec: gate.retryAfterSec },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    slug: url.searchParams.get('slug') ?? undefined,
    locale: url.searchParams.get('locale') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_query' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { slug, locale, category, limit } = parsedQuery.data;
  const hotel = await getHotelBySlug(slug, locale).catch(() => null);
  if (hotel === null) {
    return NextResponse.json(
      { ok: false, error: 'not_found', slug },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const row = patchKitGoldenRow(hotel.row);
  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'conciergetravel';
  const name =
    locale === 'en' && row.name_en !== null && row.name_en.length > 0 ? row.name_en : row.name;

  const heroPublicId = readHeroImage(row);
  const galleryAll = readGallery(row, locale, name);
  const galleryFiltered =
    category !== undefined ? galleryAll.filter((g) => g.category === category) : galleryAll;
  const gallerySlice = galleryFiltered.slice(0, limit);

  const heroGalleryMatch =
    heroPublicId !== null ? galleryAll.find((g) => g.publicId === heroPublicId) : undefined;

  const hero =
    heroPublicId !== null
      ? {
          url: buildCloudinarySrc({
            cloudName,
            publicId: heroPublicId,
            transforms: HERO_TRANSFORMS,
          }),
          alt: heroGalleryMatch?.alt ?? name,
          caption: heroGalleryMatch?.caption ?? heroGalleryMatch?.alt ?? name,
        }
      : null;

  const gallery = gallerySlice.map((img) => ({
    url: buildCloudinarySrc({
      cloudName,
      publicId: img.publicId,
      transforms: GALLERY_TRANSFORMS,
    }),
    alt: img.alt,
    caption: img.caption ?? img.alt,
    category: img.category ?? 'detail',
    width: 1230,
    height: 820,
  }));

  return NextResponse.json(
    {
      ok: true,
      slug,
      locale,
      hero,
      gallery,
      totalCount: galleryFiltered.length,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
      },
    },
  );
}
