import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { resolveHotelSlugHint } from './country-codes.js';
import type { GeneratedItinerary, ResolvedHotel } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../apps/web/.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

function resolveConnectionString(): string {
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (conn === null) {
    throw new Error(
      'No Postgres connection string. Set DATABASE_URL, SUPABASE_DB_POOLER_URL, or SUPABASE_DB_URL.',
    );
  }
  return conn;
}

async function createPgClient(): Promise<import('pg').Client> {
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = resolveConnectionString().replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

export async function countItineraries(): Promise<number> {
  const client = await createPgClient();
  try {
    const res = await client.query<{ count: string }>(
      'select count(*)::text as count from public.itineraries',
    );
    return Number(res.rows[0]?.count ?? '0');
  } finally {
    await client.end();
  }
}

export async function resolveHotelsForBrief(
  slugHints: readonly string[],
  destinationCity: string | undefined,
): Promise<ResolvedHotel[]> {
  const client = await createPgClient();
  try {
    const resolvedSlugs = slugHints.map(resolveHotelSlugHint);
    const bySlug = await client.query<{ id: string; slug: string; name: string }>(
      `select id, slug, name from public.hotels
       where slug = any($1::text[])`,
      [resolvedSlugs],
    );

    const found = new Map(bySlug.rows.map((r) => [r.slug, r] as const));
    const out: ResolvedHotel[] = [];
    for (const hint of slugHints) {
      const slug = resolveHotelSlugHint(hint);
      const row = found.get(slug);
      if (row !== undefined) out.push(row);
    }

    if (out.length === 0 && destinationCity !== undefined) {
      const fallback = await client.query<{ id: string; slug: string; name: string }>(
        `select id, slug, name from public.hotels
         where is_published = true
           and stars >= 5
           and city ilike $1
         order by priority nulls last, name
         limit 3`,
        [`%${destinationCity}%`],
      );
      return fallback.rows;
    }

    return out;
  } finally {
    await client.end();
  }
}

export async function resolveRankingIdsBySlug(slugs: readonly string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const client = await createPgClient();
  try {
    const res = await client.query<{ id: string; slug: string }>(
      `select id, slug from public.editorial_rankings
       where slug = any($1::text[]) and is_published = true`,
      [slugs],
    );
    const bySlug = new Map(res.rows.map((r) => [r.slug, r.id] as const));
    const out: string[] = [];
    for (const slug of slugs) {
      const id = bySlug.get(slug);
      if (id !== undefined) out.push(id);
    }
    return out;
  } finally {
    await client.end();
  }
}

export async function pushItinerary(
  itinerary: GeneratedItinerary,
  options: { readonly dryRun?: boolean } = {},
): Promise<void> {
  if (options.dryRun === true) {
    console.log('[dry-run] Would upsert itinerary', itinerary.slug_fr);
    return;
  }

  const client = await createPgClient();
  try {
    const today = new Date().toISOString().slice(0, 10);
    await client.query(
      `insert into public.itineraries (
        slug_fr, slug_en, title_fr, title_en,
        meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en,
        intro_fr, intro_en,
        aeo_question_fr, aeo_answer_fr, aeo_question_en, aeo_answer_en,
        country_code, destination_region, destination_city, themes,
        duration_min_days, duration_max_days, travel_style, season,
        hotel_ids, sections, faq_content,
        related_ranking_ids, related_guide_slugs, related_itinerary_slugs,
        last_updated, status, priority, word_count_target
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
      )
      on conflict (slug_fr) do update set
        slug_en = excluded.slug_en,
        title_fr = excluded.title_fr,
        title_en = excluded.title_en,
        meta_title_fr = excluded.meta_title_fr,
        meta_title_en = excluded.meta_title_en,
        meta_desc_fr = excluded.meta_desc_fr,
        meta_desc_en = excluded.meta_desc_en,
        intro_fr = excluded.intro_fr,
        intro_en = excluded.intro_en,
        aeo_question_fr = excluded.aeo_question_fr,
        aeo_answer_fr = excluded.aeo_answer_fr,
        aeo_question_en = excluded.aeo_question_en,
        aeo_answer_en = excluded.aeo_answer_en,
        country_code = excluded.country_code,
        destination_region = excluded.destination_region,
        destination_city = excluded.destination_city,
        themes = excluded.themes,
        duration_min_days = excluded.duration_min_days,
        duration_max_days = excluded.duration_max_days,
        travel_style = excluded.travel_style,
        season = excluded.season,
        hotel_ids = excluded.hotel_ids,
        sections = excluded.sections,
        faq_content = excluded.faq_content,
        related_ranking_ids = excluded.related_ranking_ids,
        related_guide_slugs = excluded.related_guide_slugs,
        related_itinerary_slugs = excluded.related_itinerary_slugs,
        last_updated = excluded.last_updated,
        status = excluded.status,
        priority = excluded.priority,
        word_count_target = excluded.word_count_target,
        updated_at = timezone('utc', now())`,
      [
        itinerary.slug_fr,
        itinerary.slug_en,
        itinerary.title_fr,
        itinerary.title_en,
        itinerary.meta_title_fr,
        itinerary.meta_title_en,
        itinerary.meta_desc_fr,
        itinerary.meta_desc_en,
        itinerary.intro_fr,
        itinerary.intro_en,
        itinerary.aeo_question_fr,
        itinerary.aeo_answer_fr,
        itinerary.aeo_question_en,
        itinerary.aeo_answer_en,
        itinerary.country_code,
        itinerary.destination_region,
        itinerary.destination_city,
        itinerary.themes,
        itinerary.duration_min_days,
        itinerary.duration_max_days,
        itinerary.travel_style,
        itinerary.season,
        itinerary.hotel_ids,
        JSON.stringify(itinerary.sections),
        JSON.stringify(itinerary.faq_content),
        itinerary.related_ranking_ids,
        itinerary.related_guide_slugs,
        itinerary.related_itinerary_slugs,
        today,
        itinerary.status,
        itinerary.priority,
        2000,
      ],
    );
    console.log(`✓ Upserted itinerary ${itinerary.slug_fr} (status=${itinerary.status})`);
  } finally {
    await client.end();
  }
}
