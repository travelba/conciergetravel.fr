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

console.log('\n=== Hotels with FAQ < 10 (need fix) ===');
const { rows: faqShort } = await cli.query(`
  select slug, name, city,
         coalesce(jsonb_array_length(faq_content),0) as faq_n,
         coalesce(jsonb_array_length(long_description_sections),0) as sec_n
  from hotels where is_published = true
    and coalesce(jsonb_array_length(faq_content),0) < 10
  order by slug`);
for (const r of faqShort) console.log(`  ${r.slug.padEnd(45)} faq=${r.faq_n} sec=${r.sec_n}  (${r.city})`);

console.log('\n=== Hotels without signature_experiences (need enrich) ===');
const { rows: noSig } = await cli.query(`
  select slug, name, city
  from hotels where is_published = true
    and coalesce(jsonb_array_length(signature_experiences),0) = 0
  order by slug`);
console.log(`  Total: ${noSig.length}`);
console.log(`  First 8: ${noSig.slice(0, 8).map(r => r.slug).join(', ')}`);

console.log('\n=== Editorial guides per region ===');
const { rows: guides } = await cli.query(`
  select slug, name_fr, is_published, jsonb_array_length(sections) as sec_n
  from editorial_guides
  where is_published = true
  order by slug`);
for (const r of guides) console.log(`  ${r.slug.padEnd(35)} sec=${r.sec_n ?? '?'}  "${r.name_fr}"`);

console.log('\n=== Hotels by region (catalog density) ===');
const { rows: regions } = await cli.query(`
  select region, count(*)::int as n
  from hotels where is_published = true
  group by region order by n desc`);
for (const r of regions) console.log(`  ${(r.region ?? '?').padEnd(25)} ${r.n}`);

// Voix Concierge (ADR-0011) — publication blocker preview
console.log('\n=== Hotels published WITHOUT concierge_advice (FR) — bloquant Concierge ===');
const { rows: noCa } = await cli.query(`
  select slug, name, city
  from hotels
  where is_published = true
    and (concierge_advice is null
      or coalesce(concierge_advice -> 'fr' ->> 'body', '') = '')
  order by slug`);
console.log(`  Total: ${noCa.length}`);
for (const r of noCa.slice(0, 20))
  console.log(`  ${r.slug.padEnd(45)} (${r.city})`);
if (noCa.length > 20) console.log(`  … (+${noCa.length - 20} more)`);

console.log('\n=== Hotels with concierge_advice outside 50-110 word envelope ===');
const { rows: outEnv } = await cli.query(`
  with c as (
    select slug, name, city,
           concierge_advice -> 'fr' ->> 'body' as fr_body,
           concierge_advice -> 'en' ->> 'body' as en_body
    from hotels where is_published = true
  ),
  w as (
    select slug, name, city,
      -- Splits on any non-alphanumeric run (mirrors JS /[^\p{L}\p{N}]+/u
      -- used by Zod validators + run-humanizer.ts). `\s+` undercounts.
      coalesce(array_length(regexp_split_to_array(trim(coalesce(fr_body, '')), '[^[:alnum:]]+'), 1), 0) as fr_words,
      coalesce(array_length(regexp_split_to_array(trim(coalesce(en_body, '')), '[^[:alnum:]]+'), 1), 0) as en_words
    from c
  )
  select slug, name, city, fr_words, en_words
  from w
  where (fr_words is not null and (fr_words < 50 or fr_words > 110))
     or (en_words is not null and (en_words < 50 or en_words > 110))
  order by slug`);
console.log(`  Total: ${outEnv.length}`);
for (const r of outEnv.slice(0, 20))
  console.log(`  ${r.slug.padEnd(45)} fr=${r.fr_words} en=${r.en_words}`);
if (outEnv.length > 20) console.log(`  … (+${outEnv.length - 20} more)`);

await cli.end();
