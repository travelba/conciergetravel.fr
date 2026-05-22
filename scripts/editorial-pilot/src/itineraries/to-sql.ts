/**
 * Pure converter: composed itinerary → idempotent UPSERT SQL.
 *
 * Lives separately from the `make-sql.ts` CLI wrapper so it can be reused
 * by the batch runner (`run-all-briefs.ts`) without going through stdin
 * or temporary files. Keeping it free of I/O side effects also makes it
 * trivially unit-testable.
 */
import type { GeneratedItinerary } from './types.js';

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTextArray(values: readonly string[]): string {
  if (values.length === 0) return `'{}'::text[]`;
  const inner = values.map(sqlString).join(', ');
  return `array[${inner}]::text[]`;
}

function sqlUuidArray(values: readonly string[]): string {
  if (values.length === 0) return `'{}'::uuid[]`;
  const inner = values.map((v) => sqlString(v)).join(', ');
  return `array[${inner}]::uuid[]`;
}

function sqlJsonb(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

/**
 * Build a single Postgres UPSERT statement for the given itinerary. The
 * statement is idempotent on `slug_fr` and only updates user-editable
 * fields (`id`, `author_id`, `created_at` stay untouched on conflict).
 */
export function itineraryToSql(data: GeneratedItinerary): string {
  return `insert into public.itineraries (
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
  ${sqlString(data.slug_fr)},
  ${sqlString(data.slug_en)},
  ${sqlString(data.title_fr)},
  ${sqlString(data.title_en)},
  ${sqlString(data.meta_title_fr)},
  ${sqlString(data.meta_title_en)},
  ${sqlString(data.meta_desc_fr)},
  ${sqlString(data.meta_desc_en)},
  ${sqlString(data.intro_fr)},
  ${sqlString(data.intro_en)},
  ${sqlString(data.aeo_question_fr)},
  ${sqlString(data.aeo_answer_fr)},
  ${sqlString(data.aeo_question_en)},
  ${sqlString(data.aeo_answer_en)},
  ${sqlString(data.country_code)},
  ${data.destination_region === null ? 'null' : sqlString(data.destination_region)},
  ${data.destination_city === null ? 'null' : sqlString(data.destination_city)},
  ${sqlTextArray(data.themes)},
  ${data.duration_min_days}::smallint,
  ${data.duration_max_days === null ? 'null' : `${data.duration_max_days}::smallint`},
  ${sqlString(data.travel_style)},
  ${sqlString(data.season)},
  ${sqlUuidArray(data.hotel_ids)},
  ${sqlJsonb(data.sections)},
  ${sqlJsonb(data.faq_content)},
  ${sqlUuidArray(data.related_ranking_ids)},
  ${sqlTextArray(data.related_guide_slugs)},
  ${sqlTextArray(data.related_itinerary_slugs)},
  current_date,
  ${sqlString(data.status)},
  ${sqlString(data.priority)},
  2000
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
  updated_at = timezone('utc', now());`;
}
