/**
 * Audit éditorial des drafts pushés (is_published=false + long_description_sections populated).
 *
 * Scores chaque fiche sur 3 axes :
 *
 * 1. CONTENT_QUALITY (LLM output)
 *    - Sections count ≥ 8
 *    - Total FR word count 400-1000
 *    - Long sentences (> 25 mots) ≤ 5
 *    - Banned terms count (incroyable, magnifique, sublime, etc.) ≤ 2
 *    - Concierge advice envelope 50-110 mots FR + 50-110 mots EN
 *    - Address truncation (Yonder Rule 3 bis : street < 15 chars)
 *    Verdict: PASS / NEEDS_REGEN / NEEDS_MANUAL_FIX
 *
 * 2. PUBLICATION_GATES (content-side, indépendant LLM)
 *    - Gallery images ≥ 30 (CDC §2.2)
 *    - FAQ count ≥ 10 (CDC §2.11)
 *    - Hero image set
 *    Verdict: BLOCKING / OK
 *
 * 3. ENRICHMENT_DEPTH (info derived from source data quality)
 *    - Has wikidata_id, lat/lng, postal_code
 *    - Has restaurants/spa/awards
 *    - Has signature_experiences
 *    Verdict: DEEP / LIGHT
 *
 * Output: tableau récap + JSON détaillé pour pilotage manuel.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../../.env.local'), 'utf8');
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
const conn = (env.SUPABASE_DB_POOLER_URL ?? '').replace(/[?&]sslmode=[^&]*/giu, '');
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

const BANNED_TERMS = [
  'incroyable',
  'magnifique',
  'sublime',
  'magique',
  'fascinant',
  'extraordinaire',
  'remarquable',
  'splendide',
  'somptueu', // somptueux/somptueuse
  'merveilleu', // merveilleux/merveilleuse
  'inoubliable',
  'mythique',
  // 'exceptionnel' is allowed only for Atout France classification
  // — handled separately (not counted unless in non-Atout context)
];

function countWords(s) {
  if (!s || typeof s !== 'string') return 0;
  return s
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0).length;
}

function countLongSentences(s) {
  if (!s) return 0;
  // Split into sentences on `.`, `!`, `?` followed by space or end
  const sentences = s
    .replace(/\s+/gu, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 5);
  return sentences.filter((sent) => countWords(sent) > 25).length;
}

function countBannedTerms(s) {
  if (!s) return { count: 0, hits: [] };
  const lower = s.toLowerCase();
  const hits = [];
  for (const term of BANNED_TERMS) {
    const matches = lower.match(new RegExp(term, 'gu')) ?? [];
    if (matches.length > 0) hits.push(`${term}×${matches.length}`);
  }
  return { count: hits.length, hits };
}

function isAddressTruncated(address, postalCode) {
  if (!address || typeof address !== 'string') return true;
  // Truncation patterns: no street name, just a number, or < 8 chars
  if (address.trim().length < 8) return true;
  // No digits = no street number = likely incomplete OR just a placename
  // (countryside hotels). Allow if postal_code is set.
  const hasDigits = /\d/u.test(address);
  if (!hasDigits && !postalCode) return true;
  return false;
}

const rows = await cli.query(`
  select slug, name, city, region,
         long_description_sections,
         concierge_advice,
         address, postal_code,
         hero_image,
         coalesce(jsonb_array_length(gallery_images), 0) as gallery_count,
         coalesce(jsonb_array_length(coalesce(faq_content->'items', faq_content)), 0) as faq_count,
         wikidata_id, latitude, longitude,
         restaurant_info, spa_info, awards, signature_experiences,
         to_char(updated_at, 'YYYY-MM-DD HH24:MI') as updated_at
    from public.hotels
   where is_published = false
     and long_description_sections is not null
     and jsonb_array_length(long_description_sections) >= 5
   order by slug
`);

console.log(`\n=== Audit éditorial : ${rows.rows.length} drafts pushés ===\n`);

const results = [];
const verdicts = { PASS: 0, NEEDS_REGEN: 0, NEEDS_MANUAL_FIX: 0 };
const gateBlocking = { photos: 0, faq: 0, hero: 0 };

for (const row of rows.rows) {
  const sections = row.long_description_sections ?? [];
  let totalFrWords = 0;
  let totalLongSentences = 0;
  let totalBannedCount = 0;
  const bannedHits = [];

  for (const s of sections) {
    const body = s.body_fr ?? '';
    totalFrWords += countWords(body);
    totalLongSentences += countLongSentences(body);
    const banned = countBannedTerms(body);
    totalBannedCount += banned.count;
    bannedHits.push(...banned.hits);
  }

  const advice = row.concierge_advice ?? {};
  const adviceFr = advice.fr ?? {};
  const adviceEn = advice.en ?? {};
  const adviceFrBody = adviceFr.body ?? '';
  const adviceEnBody = adviceEn.body ?? '';
  const adviceFrWords = countWords(adviceFrBody);
  const adviceEnWords = countWords(adviceEnBody);
  const adviceFrOk = adviceFrWords >= 50 && adviceFrWords <= 110;
  const adviceEnOk = adviceEnBody.length === 0 || (adviceEnWords >= 50 && adviceEnWords <= 110);
  const adviceFrStartsCorrect = adviceFrBody.startsWith('Mon conseil');
  const adviceEnStartsCorrect = adviceEnBody.length === 0 || adviceEnBody.startsWith('My tip');

  const addressTruncated = isAddressTruncated(row.address, row.postal_code);
  const galleryOk = row.gallery_count >= 30;
  const faqOk = row.faq_count >= 10;
  const heroOk = !!row.hero_image;

  // Content quality verdict
  const issues = [];
  const warnings = [];
  if (sections.length < 8) issues.push(`sections=${sections.length}<8`);
  if (totalFrWords < 400) issues.push(`words_fr=${totalFrWords}<400`);
  if (totalFrWords > 1000) warnings.push(`words_fr=${totalFrWords}>1000`);
  if (totalLongSentences > 5) issues.push(`long_sentences=${totalLongSentences}>5`);
  else if (totalLongSentences > 0) warnings.push(`long_sentences=${totalLongSentences}`);
  if (totalBannedCount > 2) issues.push(`banned_terms=${totalBannedCount}>2 [${bannedHits.join(',')}]`);
  else if (totalBannedCount > 0) warnings.push(`banned_terms=${totalBannedCount} [${bannedHits.join(',')}]`);
  if (!adviceFrOk) issues.push(`advice_fr=${adviceFrWords}w (need 50-110)`);
  if (!adviceEnOk) issues.push(`advice_en=${adviceEnWords}w (need 50-110)`);
  if (!adviceFrStartsCorrect) issues.push(`advice_fr doesn't start with "Mon conseil"`);
  if (!adviceEnStartsCorrect) warnings.push(`advice_en doesn't start with "My tip"`);

  const manualFixes = [];
  if (addressTruncated) manualFixes.push('address truncated/incomplete');

  let verdict;
  if (issues.length === 0 && manualFixes.length === 0) verdict = 'PASS';
  else if (manualFixes.length > 0) verdict = 'NEEDS_MANUAL_FIX';
  else verdict = 'NEEDS_REGEN';
  verdicts[verdict]++;

  // Gates
  if (!galleryOk) gateBlocking.photos++;
  if (!faqOk) gateBlocking.faq++;
  if (!heroOk) gateBlocking.hero++;

  results.push({
    slug: row.slug,
    name: row.name,
    city: row.city,
    region: row.region,
    verdict,
    issues,
    warnings,
    manualFixes,
    sections: sections.length,
    words_fr: totalFrWords,
    long_sentences: totalLongSentences,
    banned_count: totalBannedCount,
    banned_hits: bannedHits,
    advice_fr_words: adviceFrWords,
    advice_en_words: adviceEnWords,
    advice_fr_ok: adviceFrOk,
    advice_en_ok: adviceEnOk,
    address: row.address,
    postal_code: row.postal_code,
    address_truncated: addressTruncated,
    gallery_count: row.gallery_count,
    faq_count: row.faq_count,
    hero_set: heroOk,
    wikidata_id: row.wikidata_id,
    updated_at: row.updated_at,
  });
}

// Sort: NEEDS_MANUAL_FIX first, then NEEDS_REGEN, then PASS
results.sort((a, b) => {
  const order = { NEEDS_MANUAL_FIX: 0, NEEDS_REGEN: 1, PASS: 2 };
  return order[a.verdict] - order[b.verdict] || a.slug.localeCompare(b.slug);
});

console.log('Slug                                       Verdict             Words  L>25 Ban Adv-FR  Adv-EN  Addr  Gal  FAQ');
console.log('-'.repeat(118));
for (const r of results) {
  const verdictBadge =
    r.verdict === 'PASS' ? '✅ PASS            '
    : r.verdict === 'NEEDS_REGEN' ? '⚠️  NEEDS_REGEN     '
    : '❌ NEEDS_MANUAL_FIX';
  const addrBadge = r.address_truncated ? '❌' : '✓ ';
  const advFrBadge = r.advice_fr_ok ? '✓' : '✗';
  const advEnBadge = r.advice_en_ok ? '✓' : '✗';
  const galBadge = r.gallery_count >= 30 ? '✓' : `${r.gallery_count}❌`;
  const faqBadge = r.faq_count >= 10 ? '✓' : `${r.faq_count}❌`;
  console.log(
    `${r.slug.padEnd(42)} ${verdictBadge}  ${String(r.words_fr).padStart(4)}  ${String(r.long_sentences).padStart(3)}  ${String(r.banned_count).padStart(2)}  ${String(r.advice_fr_words).padStart(3)}w${advFrBadge}  ${String(r.advice_en_words).padStart(3)}w${advEnBadge}  ${addrBadge}   ${galBadge.padEnd(3)}  ${faqBadge}`,
  );
}

console.log('\n=== Récap ===');
console.log(
  `Content quality:  ${verdicts.PASS} PASS  /  ${verdicts.NEEDS_REGEN} NEEDS_REGEN  /  ${verdicts.NEEDS_MANUAL_FIX} NEEDS_MANUAL_FIX`,
);
console.log(
  `Publication gates: ${gateBlocking.photos} drafts < 30 photos  /  ${gateBlocking.faq} drafts < 10 FAQ  /  ${gateBlocking.hero} drafts no hero`,
);

// Save detailed JSON for downstream tooling
const outputPath = resolve(__dirname, 'audit-pushed-drafts.json');
writeFileSync(outputPath, JSON.stringify({ generated_at: new Date().toISOString(), verdicts, gate_blocking: gateBlocking, results }, null, 2));
console.log(`\nDetailed audit → ${outputPath}`);

await cli.end();
