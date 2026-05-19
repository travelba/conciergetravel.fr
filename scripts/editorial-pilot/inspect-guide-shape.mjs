import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../.env.local') });

const conn = (process.env['SUPABASE_DB_POOLER_URL'] ?? process.env['SUPABASE_DB_URL'] ?? '').replace(/[?&]sslmode=[^&]*/gi, '');
const c = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await c.connect();

const slug = process.argv[2] ?? 'sologne';
const r = await c.query(
  `select slug, scope, country_code, name_fr, name_en, summary_fr, summary_en,
          sections, faq, highlights, practical_info, tables, glossary,
          external_sources, editorial_callouts, toc_anchors,
          meta_title_fr, meta_desc_fr, meta_title_en, meta_desc_en
   from public.editorial_guides where slug = $1`,
  [slug],
);
if (!r.rows.length) {
  console.log('Not found:', slug);
} else {
  const g = r.rows[0];
  console.log('Slug         :', g.slug);
  console.log('Scope        :', g.scope, '   country:', g.country_code);
  console.log('Name FR      :', g.name_fr);
  console.log('Name EN      :', g.name_en);
  console.log('Summary FR   :', (g.summary_fr ?? '').slice(0, 250) + '…');
  console.log('Summary EN   :', (g.summary_en ?? '').slice(0, 250) + '…');
  console.log('Meta title FR:', g.meta_title_fr);
  console.log('Meta desc FR :', g.meta_desc_fr);
  console.log('Sections     :', Array.isArray(g.sections) ? g.sections.length : typeof g.sections);
  if (Array.isArray(g.sections)) {
    for (const s of g.sections) {
      const keys = s ? Object.keys(s).join(', ') : '?';
      const headFr = (s?.heading_fr ?? s?.heading ?? '').slice(0, 60);
      const bodyLen = ((s?.body_fr ?? s?.body ?? '') + '').length;
      const bodyEnLen = ((s?.body_en ?? '') + '').length;
      console.log(`  - ${headFr}  | keys: ${keys}  | body_fr len=${bodyLen}  body_en len=${bodyEnLen}`);
    }
  }
  console.log('FAQ          :', Array.isArray(g.faq) ? g.faq.length : typeof g.faq);
  if (Array.isArray(g.faq) && g.faq[0]) {
    console.log('  faq[0] keys:', Object.keys(g.faq[0]).join(', '));
  }
  console.log('Highlights   :', Array.isArray(g.highlights) ? g.highlights.length : typeof g.highlights);
  console.log('Tables       :', Array.isArray(g.tables) ? g.tables.length : typeof g.tables);
  console.log('Glossary     :', Array.isArray(g.glossary) ? g.glossary.length : typeof g.glossary);
  console.log('Ext sources  :', Array.isArray(g.external_sources) ? g.external_sources.length : typeof g.external_sources);
  console.log('Callouts     :', Array.isArray(g.editorial_callouts) ? g.editorial_callouts.length : typeof g.editorial_callouts);
  console.log('TOC anchors  :', Array.isArray(g.toc_anchors) ? g.toc_anchors.length : typeof g.toc_anchors);
}
await c.end();
