import 'server-only';

import { cache } from 'react';
import { z } from 'zod';

import { parseRankingCardV2 } from '@mch/db';

import { DEMO_RANKING, type DemoRanking } from '@/lib/demo-data';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canUseLiveSupabase } from '@/server/lib/live-data';

export type RankingV2Source = 'live' | 'demo';

export type GetRankingV2Result = {
  readonly source: RankingV2Source;
  readonly ranking: DemoRanking;
};

export type GetRankingV2Options = {
  readonly slug: string;
  readonly locale?: 'fr' | 'en';
};

const RankingEntryRowSchema = z.object({
  rank: z.number().int(),
  justification_fr: z.string(),
  justification_en: z.string().nullable(),
  hotel_id: z.string().uuid(),
});

const HotelJoinRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  name_en: z.string().nullable(),
  city: z.string(),
});

const EditorialIntroSchema = z.object({
  intro_fr: z.string(),
  intro_en: z.string().nullable(),
});

function pickLocalized(locale: 'fr' | 'en', fr: string, en: string | null | undefined): string {
  if (locale === 'en' && en !== null && en !== undefined && en.length > 0) return en;
  return fr;
}

async function fetchLiveRanking(slug: string, locale: 'fr' | 'en'): Promise<DemoRanking | null> {
  const client = await createSupabaseServerClient();

  const { data: cardRow, error: cardError } = await client
    .schema('v2')
    .from('ranking_card_v2')
    .select(
      'id, slug, title_fr, title_en, kind, hero_image, factual_summary_fr, factual_summary_en, meta_desc_fr, meta_desc_en, axes, entry_count, updated_at',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (cardError !== null || cardRow === null) return null;

  const cardParsed = parseRankingCardV2(cardRow);
  if (!cardParsed.ok) return null;

  const { data: introRow } = await client
    .from('editorial_rankings')
    .select('intro_fr, intro_en')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  const introParsed = EditorialIntroSchema.safeParse(introRow);
  const intro = introParsed.success
    ? pickLocalized(locale, introParsed.data.intro_fr, introParsed.data.intro_en)
    : pickLocalized(
        locale,
        cardParsed.value.factual_summary_fr ?? '',
        cardParsed.value.factual_summary_en,
      );

  const { data: entryRows, error: entriesError } = await client
    .from('editorial_ranking_entries')
    .select('rank, justification_fr, justification_en, hotel_id')
    .eq('ranking_id', cardParsed.value.id)
    .order('rank', { ascending: true });

  if (entriesError !== null || entryRows === null) return null;

  const parsedEntries = z.array(RankingEntryRowSchema).safeParse(entryRows);
  if (!parsedEntries.success) return null;

  const hotelIds = parsedEntries.data.map((e) => e.hotel_id);
  if (hotelIds.length === 0) {
    return {
      slug: cardParsed.value.slug,
      title: pickLocalized(locale, cardParsed.value.title_fr, cardParsed.value.title_en),
      intro,
      entries: [],
    };
  }

  const { data: hotelRows, error: hotelsError } = await client
    .from('hotels')
    .select('id, slug, name, name_en, city')
    .in('id', hotelIds);

  if (hotelsError !== null || hotelRows === null) return null;

  const hotelsParsed = z.array(HotelJoinRowSchema).safeParse(hotelRows);
  if (!hotelsParsed.success) return null;

  const hotelsById = new Map(hotelsParsed.data.map((h) => [h.id, h]));

  const entries = parsedEntries.data.flatMap((entry) => {
    const hotel = hotelsById.get(entry.hotel_id);
    if (hotel === undefined) return [];
    return [
      {
        rank: entry.rank,
        hotelSlug: hotel.slug,
        hotelName: pickLocalized(locale, hotel.name, hotel.name_en),
        city: hotel.city,
        teaser: pickLocalized(locale, entry.justification_fr, entry.justification_en),
      },
    ];
  });

  return {
    slug: cardParsed.value.slug,
    title: pickLocalized(locale, cardParsed.value.title_fr, cardParsed.value.title_en),
    intro,
    entries,
  };
}

export const getRankingV2 = cache(
  async (options: GetRankingV2Options): Promise<GetRankingV2Result | null> => {
    const locale = options.locale ?? 'fr';

    if (canUseLiveSupabase()) {
      try {
        const live = await fetchLiveRanking(options.slug, locale);
        if (live !== null) return { source: 'live', ranking: live };
      } catch {
        // Degrade to demo below.
      }
    }

    if (options.slug === DEMO_RANKING.slug || options.slug.length > 0) {
      return { source: 'demo', ranking: { ...DEMO_RANKING, slug: options.slug } };
    }

    return null;
  },
);

export function toRankingAgentJson(result: GetRankingV2Result, locale: 'fr' | 'en') {
  const { ranking, source } = result;
  return {
    ok: true as const,
    source,
    ranking: {
      slug: ranking.slug,
      title: ranking.title,
      intro: ranking.intro,
      entries: ranking.entries.map((entry) => ({
        rank: entry.rank,
        hotelSlug: entry.hotelSlug,
        hotelName: entry.hotelName,
        city: entry.city,
        teaser: entry.teaser,
        canonicalUrl:
          locale === 'en' ? `/en/hotel/${entry.hotelSlug}` : `/fr/hotel/${entry.hotelSlug}`,
      })),
      canonicalUrl:
        locale === 'en' ? `/en/classement/${ranking.slug}` : `/fr/classement/${ranking.slug}`,
    },
  };
}
