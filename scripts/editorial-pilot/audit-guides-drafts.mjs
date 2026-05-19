/**
 * Quality audit for the 10 newly generated guide drafts (Phase F seeds).
 * Checks:
 *  - FR/EN body parity per section
 *  - Total word count per locale
 *  - Sentence length compliance (Concierge rule: ≤ 25 words)
 *  - Banned superlatives (style-guide §4-5)
 *  - Concierge voice signal — "Mon conseil :" / "À noter" / "Le bon plan" callouts
 *  - FAQ structure (count, FR/EN parity, answer length 50-100 words)
 *  - External sources count
 *  - Meta tags present
 *  - Highlights / tables / glossary / TOC presence
 *
 * Outputs a structured JSON report and a human summary.
 * Decides PASS / NEEDS_REGEN per guide based on hard rules.
 */
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const SLUGS = [
  'sologne', 'pays-basque', 'sud-ouest', 'vexin',
  'hauts-de-france', 'occitanie', 'pays-de-la-loire',
  'lac-leman', 'ile-de-france-region', 'auvergne-rhone-alpes',
];

// Banned superlatives — see EDITORIAL_VOICE.md + style-guide.md
const BANNED_TERMS = [
  'incroyable', 'incroyables',
  'magnifique', 'magnifiques',
  'exceptionnel', 'exceptionnels', 'exceptionnelle', 'exceptionnelles',
  'magique', 'magiques',
  'sublime', 'sublimes',
  'extraordinaire', 'extraordinaires',
  'fantastique', 'fantastiques',
  'féerique', 'féeriques',
  'merveilleux', 'merveilleuse', 'merveilleuses',
  'unique en son genre', 'cadre idyllique',
  'plonger dans', 's\u2019évader',
  'véritable joyau', 'véritable bijou',
];

function countWords(s) {
  if (typeof s !== 'string') return 0;
  const t = s.trim();
  if (!t.length) return 0;
  return t.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 0).length;
}

function splitSentences(s) {
  if (typeof s !== 'string') return [];
  return s
    .replace(/\.\.\./g, '.')
    .split(/(?<=[.!?])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function findBanned(text) {
  if (typeof text !== 'string') return [];
  const hits = [];
  const lower = text.toLowerCase();
  for (const term of BANNED_TERMS) {
    const re = new RegExp(`\\b${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let m;
    while ((m = re.exec(lower)) !== null) {
      const start = Math.max(0, m.index - 30);
      const end = Math.min(text.length, m.index + term.length + 30);
      hits.push({ term, ctx: text.slice(start, end) });
    }
  }
  return hits;
}

const report = [];

for (const slug of SLUGS) {
  const r = await c.query(
    `select slug, name_fr, name_en, summary_fr, summary_en,
            sections, faq, highlights, practical_info, tables, glossary,
            external_sources, editorial_callouts, toc_anchors,
            meta_title_fr, meta_desc_fr, meta_title_en, meta_desc_en
     from public.editorial_guides where slug = $1`,
    [slug],
  );
  if (!r.rows.length) {
    report.push({ slug, status: 'MISSING' });
    continue;
  }
  const g = r.rows[0];

  // Section-level audit
  const sections = Array.isArray(g.sections) ? g.sections : [];
  let totalFrWords = 0;
  let totalEnWords = 0;
  let frSentencesOver25 = 0;
  let bannedHits = [];
  let conciergeSignals = 0;
  const conciergeMarkers = ['mon conseil', 'à noter', 'le bon plan', 'attention', 'astuce', 'évitez', 'préférez'];
  const lowSectionsEn = [];
  for (const s of sections) {
    const frBody = s?.body_fr ?? '';
    const enBody = s?.body_en ?? '';
    const frW = countWords(frBody);
    const enW = countWords(enBody);
    totalFrWords += frW;
    totalEnWords += enW;
    if (enW < frW * 0.6) {
      lowSectionsEn.push({ key: s?.key ?? '?', title_fr: s?.title_fr ?? '?', fr_w: frW, en_w: enW });
    }
    const sentences = splitSentences(frBody);
    for (const sentence of sentences) {
      if (countWords(sentence) > 25) frSentencesOver25++;
    }
    bannedHits = bannedHits.concat(findBanned(frBody));
    const lowerFr = frBody.toLowerCase();
    for (const marker of conciergeMarkers) {
      if (lowerFr.includes(marker)) {
        conciergeSignals++;
        break;
      }
    }
  }

  // FAQ audit
  const faq = Array.isArray(g.faq) ? g.faq : [];
  const faqFrAnswers = faq.map((f) => f?.answer_fr ?? '');
  const faqEnAnswers = faq.map((f) => f?.answer_en ?? '');
  const faqFrWordRange = faqFrAnswers.map((a) => countWords(a));
  const faqEnWordRange = faqEnAnswers.map((a) => countWords(a));
  const faqFrAvg = faqFrWordRange.length ? Math.round(faqFrWordRange.reduce((a, b) => a + b, 0) / faqFrWordRange.length) : 0;
  const faqEnAvg = faqEnWordRange.length ? Math.round(faqEnWordRange.reduce((a, b) => a + b, 0) / faqEnWordRange.length) : 0;
  const faqEnEmpty = faqEnAnswers.filter((a) => countWords(a) < 10).length;

  // Decision logic
  const issues = [];
  // Hard blockers
  if (totalFrWords < 3500) issues.push(`FR words=${totalFrWords} < 3500 (hard floor)`);
  if (totalEnWords < totalFrWords * 0.7) issues.push(`EN words=${totalEnWords} < 70% of FR=${totalFrWords} (translation stub)`);
  if (faq.length < 10) issues.push(`FAQ count=${faq.length} < 10 (CDC §2.11)`);
  if (faqEnEmpty > faq.length * 0.3) issues.push(`FAQ EN stubs: ${faqEnEmpty}/${faq.length} answers < 10 words`);
  if (!g.meta_title_fr || !g.meta_title_en) issues.push('missing meta titles');
  if (!g.meta_desc_fr || !g.meta_desc_en) issues.push('missing meta descriptions');
  // Soft warnings
  const warnings = [];
  if (frSentencesOver25 > 5) warnings.push(`${frSentencesOver25} sentences > 25 words (shortener pass needed)`);
  if (bannedHits.length > 0) warnings.push(`${bannedHits.length} banned superlatives`);
  if (conciergeSignals < 3) warnings.push(`only ${conciergeSignals}/${sections.length} sections with concierge marker`);
  if ((Array.isArray(g.external_sources) ? g.external_sources.length : 0) < 5) {
    warnings.push(`external_sources=${Array.isArray(g.external_sources) ? g.external_sources.length : 0} < 5`);
  }

  const status = issues.length === 0 ? (warnings.length > 0 ? 'PASS_WITH_WARNINGS' : 'PASS') : 'NEEDS_REGEN';

  report.push({
    slug,
    status,
    name_fr: g.name_fr,
    sections_count: sections.length,
    fr_total_words: totalFrWords,
    en_total_words: totalEnWords,
    en_ratio: totalFrWords > 0 ? Math.round((totalEnWords / totalFrWords) * 100) : 0,
    fr_sentences_over_25: frSentencesOver25,
    banned_hits: bannedHits.length,
    banned_samples: bannedHits.slice(0, 3),
    concierge_signal_sections: conciergeSignals,
    faq_count: faq.length,
    faq_fr_avg_words: faqFrAvg,
    faq_en_avg_words: faqEnAvg,
    faq_en_stubs: faqEnEmpty,
    highlights_count: Array.isArray(g.highlights) ? g.highlights.length : 0,
    tables_count: Array.isArray(g.tables) ? g.tables.length : 0,
    glossary_count: Array.isArray(g.glossary) ? g.glossary.length : 0,
    callouts_count: Array.isArray(g.editorial_callouts) ? g.editorial_callouts.length : 0,
    external_sources_count: Array.isArray(g.external_sources) ? g.external_sources.length : 0,
    low_en_sections: lowSectionsEn,
    issues,
    warnings,
  });
}

await c.end();

// Output
console.log('\n=== GUIDES DRAFTS AUDIT REPORT ===\n');
console.log('Slug                          | Status              | FR w   | EN w   | EN%  | FAQ | FAQ-en stubs | Banned | >25w | Issues');
console.log('-'.repeat(140));
for (const row of report) {
  const slugPad = String(row.slug).padEnd(28);
  const statusPad = String(row.status).padEnd(20);
  const frw = String(row.fr_total_words ?? '-').padEnd(6);
  const enw = String(row.en_total_words ?? '-').padEnd(6);
  const enr = String(row.en_ratio ?? '-').padStart(3) + '%';
  const faqc = String(row.faq_count ?? '-').padStart(3);
  const faqstub = String(row.faq_en_stubs ?? '-').padStart(2);
  const banned = String(row.banned_hits ?? '-').padStart(3);
  const long = String(row.fr_sentences_over_25 ?? '-').padStart(3);
  console.log(`${slugPad}  | ${statusPad}| ${frw} | ${enw} | ${enr} | ${faqc} | ${faqstub}           | ${banned}    | ${long}  | ${row.issues?.length ?? 0}`);
}

const passes = report.filter((r) => r.status === 'PASS' || r.status === 'PASS_WITH_WARNINGS');
const needs = report.filter((r) => r.status === 'NEEDS_REGEN');

console.log('\n--- Detail ---');
for (const row of report) {
  console.log(`\n  ${row.slug} (${row.status}):`);
  if (row.issues?.length) {
    console.log('    ISSUES:');
    for (const i of row.issues) console.log(`      ✗ ${i}`);
  }
  if (row.warnings?.length) {
    console.log('    WARNINGS:');
    for (const w of row.warnings) console.log(`      ⚠ ${w}`);
  }
  if (row.banned_samples?.length) {
    console.log('    Banned superlative samples:');
    for (const s of row.banned_samples) console.log(`      - "${s.term}" in: …${s.ctx}…`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`  PASS                     : ${report.filter((r) => r.status === 'PASS').length}`);
console.log(`  PASS_WITH_WARNINGS       : ${report.filter((r) => r.status === 'PASS_WITH_WARNINGS').length}`);
console.log(`  NEEDS_REGEN              : ${needs.length}`);
console.log(`  MISSING                  : ${report.filter((r) => r.status === 'MISSING').length}`);

const outPath = path.resolve(__dirname, 'runs', `guides-audit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nFull report: ${outPath}`);
console.log(`\nPublishable slugs (PASS or PASS_WITH_WARNINGS): ${passes.map((r) => r.slug).join(', ') || '(none)'}`);
console.log(`Needs regen: ${needs.map((r) => r.slug).join(', ') || '(none)'}`);
