import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import type { SupportedLocale } from '@/i18n/supported-locale';
import { pickByLocale } from '@/i18n/supported-locale';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Three random « Conseil du Concierge » picks for the homepage
 * carousel. Pool size 40, sampled to `count` (typically 3) with a
 * daily-deterministic seed so the surface rotates every UTC day
 * without invalidating the upstream Supabase query.
 */
const ConciergeAdviceLocaleSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  tip_for: z.string().min(1),
});
const ConciergeAdvicePayloadSchema = z.object({
  fr: ConciergeAdviceLocaleSchema,
  en: ConciergeAdviceLocaleSchema.optional(),
});

interface PoolEntry {
  readonly hotelSlug: string;
  readonly hotelSlugEn: string | null;
  readonly hotelNameFr: string;
  readonly hotelNameEn: string | null;
  readonly city: string;
  readonly countryCode: string;
  readonly titleFr: string;
  readonly bodyFr: string;
  readonly tipForFr: string;
  readonly titleEn: string | null;
  readonly bodyEn: string | null;
  readonly tipForEn: string | null;
  readonly updatedAt: string | null;
}

export interface HomeConciergeAdviceCard {
  readonly hotelSlug: string;
  readonly hotelName: string;
  readonly city: string;
  readonly countryCode: string;
  readonly title: string;
  readonly body: string;
  readonly tipFor: string;
  readonly updatedAt: string | null;
}

const POOL_LIMIT = 40;

async function fetchConciergeAdvicePool(): Promise<readonly PoolEntry[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('hotels')
      .select(
        'slug, slug_en, name, name_en, city, country_code, concierge_advice, updated_at, priority',
      )
      .eq('is_published', true)
      .not('concierge_advice', 'is', null)
      .order('priority', { ascending: true })
      .limit(POOL_LIMIT);

    if (error !== null || !Array.isArray(data)) return [];

    const out: PoolEntry[] = [];
    for (const raw of data as Array<{
      slug: string;
      slug_en: string | null;
      name: string;
      name_en: string | null;
      city: string;
      country_code: string | null;
      concierge_advice: unknown;
      updated_at: string | null;
    }>) {
      const parsed = ConciergeAdvicePayloadSchema.safeParse(raw.concierge_advice);
      if (!parsed.success) continue;
      out.push({
        hotelSlug: raw.slug,
        hotelSlugEn: raw.slug_en,
        hotelNameFr: raw.name,
        hotelNameEn: raw.name_en,
        city: raw.city,
        countryCode: raw.country_code ?? 'FR',
        titleFr: parsed.data.fr.title,
        bodyFr: parsed.data.fr.body,
        tipForFr: parsed.data.fr.tip_for,
        titleEn: parsed.data.en?.title ?? null,
        bodyEn: parsed.data.en?.body ?? null,
        tipForEn: parsed.data.en?.tip_for ?? null,
        updatedAt: raw.updated_at,
      });
    }
    return out;
  } catch {
    return [];
  }
}

const cachedFetchPool = unstable_cache(
  fetchConciergeAdvicePool,
  ['home-concierge-advice-pool-v1'],
  {
    revalidate: 3600,
    tags: ['home-concierge-advice', 'home-metrics'],
  },
);

function todaySeed(): number {
  const now = new Date();
  return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

function deterministicSample<T>(pool: readonly T[], n: number, seed: number): readonly T[] {
  if (pool.length <= n) return pool;
  let state = seed >>> 0;
  const random = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j] ?? 0, indices[i] ?? 0];
  }
  return indices.slice(0, n).map((idx) => pool[idx] as T);
}

export async function getHomeConciergeAdvicePicks(
  locale: SupportedLocale,
  count = 3,
): Promise<readonly HomeConciergeAdviceCard[]> {
  const pool = await cachedFetchPool();
  if (pool.length === 0) return [];
  const sampled = deterministicSample(pool, count, todaySeed());
  return sampled.map(
    (row): HomeConciergeAdviceCard => ({
      hotelSlug: pickByLocale(
        locale,
        row.hotelSlug,
        row.hotelSlugEn !== null && row.hotelSlugEn.length > 0 ? row.hotelSlugEn : row.hotelSlug,
      ),
      hotelName: pickByLocale(locale, row.hotelNameFr, row.hotelNameEn ?? row.hotelNameFr),
      city: row.city,
      countryCode: row.countryCode,
      title: pickByLocale(locale, row.titleFr, row.titleEn ?? row.titleFr),
      body: pickByLocale(locale, row.bodyFr, row.bodyEn ?? row.bodyFr),
      tipFor: pickByLocale(locale, row.tipForFr, row.tipForEn ?? row.tipForFr),
      updatedAt: row.updatedAt,
    }),
  );
}
