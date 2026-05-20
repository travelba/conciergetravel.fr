import 'server-only';

import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { pickByLocale, type SupportedLocale } from '@/i18n/supported-locale';

/**
 * Slim view of an editorial guide — just enough to render a teaser
 * card on the hotel detail page (CDC §2 bloc 12 / `<LocalGuideTeaser>`).
 *
 * We deliberately do NOT pull `sections` / `tables` / `faq` here: the
 * teaser links out to `/guide/[citySlug]` and must NOT duplicate the
 * guide body (anti-cannibalisation, `seo-geo.mdc`).
 */
export interface GuideTeaser {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly heroImage: string | null;
}

const GuideTeaserRowSchema = z.object({
  slug: z.string(),
  name_fr: z.string(),
  name_en: z.string().nullable(),
  summary_fr: z.string(),
  summary_en: z.string().nullable(),
  hero_image: z.string().nullable(),
  is_published: z.boolean(),
});

/**
 * Fetches the published guide for `citySlug` if any. Designed to be
 * called from the hotel detail page in parallel with the other
 * Supabase reads — single round-trip, slim payload.
 *
 * Returns `null` when no guide exists for the city, or when the row
 * is unpublished. Editorial pipelines can then publish a guide later
 * and the teaser appears automatically on the next ISR revalidation.
 */
export async function getGuideTeaserForCity(
  citySlug: string,
  locale: SupportedLocale,
): Promise<GuideTeaser | null> {
  if (typeof citySlug !== 'string' || citySlug.length === 0) return null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('editorial_guides')
    .select('slug, name_fr, name_en, summary_fr, summary_en, hero_image, is_published')
    .eq('slug', citySlug)
    .eq('is_published', true)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const parsed = GuideTeaserRowSchema.safeParse(data);
  if (!parsed.success) return null;
  if (!parsed.data.is_published) return null;

  const name = pickByLocale(
    locale,
    parsed.data.name_fr,
    parsed.data.name_en ?? parsed.data.name_fr,
  );
  const summary = pickByLocale(
    locale,
    parsed.data.summary_fr,
    parsed.data.summary_en ?? parsed.data.summary_fr,
  );
  return {
    slug: parsed.data.slug,
    name,
    summary,
    heroImage: parsed.data.hero_image,
  };
}
