import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envText = readFileSync(resolve(process.cwd(), '../../.env.local'), 'utf8');
const env = {};
for (const raw of envText.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = (m[2] ?? '').trim();
  const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
  v = q ? (q[1] ?? '') : v.split(/\s+#/)[0]?.trim() ?? '';
  env[m[1] ?? ''] = v;
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/\?sslmode=require/, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const { rows: total } = await cli.query(`select count(*)::int as n from hotels where is_published = true`);
console.log(`\n=== Hotels (published) ===`);
console.log(`  Total: ${total[0].n}`);

const { rows: faq } = await cli.query(`
  select
    count(*) filter (where coalesce(jsonb_array_length(faq_content),0) >= 10) as faq_10,
    count(*) filter (where coalesce(jsonb_array_length(faq_content),0) >= 1 and coalesce(jsonb_array_length(faq_content),0) < 10) as faq_1to9,
    count(*) filter (where coalesce(jsonb_array_length(faq_content),0) = 0) as faq_0
  from hotels where is_published = true`);
console.log(`\n=== FAQ (hard rule: >=10) ===`);
console.log(`  >= 10  Q&A : ${faq[0].faq_10}`);
console.log(`  1-9   Q&A : ${faq[0].faq_1to9}`);
console.log(`  none      : ${faq[0].faq_0}`);

const { rows: sections } = await cli.query(`
  select
    count(*) filter (where coalesce(jsonb_array_length(long_description_sections),0) >= 5) as s_5,
    count(*) filter (where coalesce(jsonb_array_length(long_description_sections),0) >= 1 and coalesce(jsonb_array_length(long_description_sections),0) < 5) as s_1to4,
    count(*) filter (where coalesce(jsonb_array_length(long_description_sections),0) = 0) as s_0
  from hotels where is_published = true`);
console.log(`\n=== Long description sections ===`);
console.log(`  >= 5 sections : ${sections[0].s_5}`);
console.log(`  1-4 sections : ${sections[0].s_1to4}`);
console.log(`  none         : ${sections[0].s_0}`);

const { rows: sig } = await cli.query(`
  select
    count(*) filter (where coalesce(jsonb_array_length(signature_experiences),0) >= 1) as has_sig,
    count(*) filter (where coalesce(jsonb_array_length(awards),0) >= 1) as has_award
  from hotels where is_published = true`);
console.log(`\n=== Editorial extras ===`);
console.log(`  with signature_experiences : ${sig[0].has_sig}`);
console.log(`  with awards               : ${sig[0].has_award}`);

const { rows: i18n } = await cli.query(`
  select
    count(*) filter (where length(coalesce(description_en,'')) >= 100) as desc_en,
    count(*) filter (where length(coalesce(meta_title_en,'')) >= 10) as title_en,
    count(*) filter (where (faq_content -> 0 ->> 'answer_en') is not null and length(faq_content -> 0 ->> 'answer_en') >= 20) as faq_en,
    count(*) filter (where (long_description_sections -> 0 ->> 'body_en') is not null and length(long_description_sections -> 0 ->> 'body_en') >= 100) as sec_en
  from hotels where is_published = true`);
console.log(`\n=== EN translations (1ere vague) ===`);
console.log(`  description_en  : ${i18n[0].desc_en}/${total[0].n}`);
console.log(`  meta_title_en   : ${i18n[0].title_en}/${total[0].n}`);
console.log(`  faq[0].answer_en: ${i18n[0].faq_en}/${total[0].n}`);
console.log(`  sec[0].body_en  : ${i18n[0].sec_en}/${total[0].n}`);

const { rows: pillars } = await cli.query(`
  select count(*) as n from editorial_guides where is_published = true`);
console.log(`\n=== Editorial guides published: ${pillars[0].n} ===`);

const { rows: rankings } = await cli.query(`
  select count(*) as n from editorial_rankings`);
console.log(`=== Editorial rankings total: ${rankings[0].n} ===`);

const { rows: regions } = await cli.query(`
  select region, count(*)::int as n
  from hotels where is_published = true
  group by region order by n desc`);
console.log(`\n=== Region distribution (catalog) ===`);
for (const r of regions) console.log(`  ${(r.region ?? '?').padEnd(28)} ${r.n}`);

const { rows: indexable } = await cli.query(`
  select count(*) filter (where is_published = true) as published,
         count(*) filter (where is_published = true and coalesce(jsonb_array_length(faq_content),0) >= 10
                            and coalesce(jsonb_array_length(long_description_sections),0) >= 5) as ready_for_index
  from hotels`);
console.log(`\n=== Indexable ===`);
console.log(`  published       : ${indexable[0].published}`);
console.log(`  CDC §2 ready    : ${indexable[0].ready_for_index} (FAQ≥10 + sections≥5)`);

// Voix Concierge (ADR-0011) — concierge_advice presence + word count envelope
//
// Word count splits on any non-letter / non-digit run (mirrors the JS regex
// `/[^\p{L}\p{N}]+/u` used by `run-humanizer.ts#countWordsLocal` and the
// Zod validators in `apps/web/src/server/hotels/get-hotel-by-slug.ts`).
// SQL default `\s+` undercounts separators (it treats "Mon conseil :"
// as 3 words instead of 2), inflates wordcount, and surfaces phantom
// outliers that the shipped code never flags. Keep the two definitions
// in lockstep — they are the contract.
const { rows: ca } = await cli.query(`
  with stats as (
    select
      concierge_advice -> 'fr' ->> 'body' as fr_body,
      concierge_advice -> 'en' ->> 'body' as en_body
    from hotels where is_published = true
  ),
  counts as (
    select
      fr_body,
      en_body,
      coalesce(array_length(regexp_split_to_array(trim(coalesce(fr_body, '')), '[^[:alnum:]]+'), 1), 0) as fr_words,
      coalesce(array_length(regexp_split_to_array(trim(coalesce(en_body, '')), '[^[:alnum:]]+'), 1), 0) as en_words
    from stats
  )
  select
    count(*) filter (where fr_body is not null) as fr_present,
    count(*) filter (where en_body is not null) as en_present,
    count(*) filter (where fr_words between 50 and 110) as fr_in_envelope,
    count(*) filter (where en_words between 50 and 110) as en_in_envelope,
    count(*) filter (where fr_body is null) as fr_missing,
    count(*) as total
  from counts`);
console.log(`\n=== Concierge advice (ADR-0011, envelope 50-110 mots) ===`);
console.log(`  FR present       : ${ca[0].fr_present}/${ca[0].total}`);
console.log(`  EN present       : ${ca[0].en_present}/${ca[0].total}`);
console.log(`  FR in envelope   : ${ca[0].fr_in_envelope}/${ca[0].total}`);
console.log(`  EN in envelope   : ${ca[0].en_in_envelope}/${ca[0].total}`);
console.log(`  FR missing       : ${ca[0].fr_missing}`);

await cli.end();
