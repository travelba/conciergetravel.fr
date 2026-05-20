/**
 * Phase 6 — push pipeline outputs to DB.
 *
 * Reads `output/<slug>/final.md` (or alternative output_dir override) +
 * `output/<slug>/08-concierge-advice.json`, parses the markdown into
 * `long_description_sections` and pushes both columns to
 * `public.hotels`.
 *
 * Idempotent : `--force` overrides existing data, otherwise skips when
 * the hotel already has 6+ sections.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx push-md-to-sections.ts \
 *     [--slug <slug>] [--all] [--force] [--md-dir <dir>] [--dry-run]
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const args = process.argv.slice(2);
const slugFilter = (() => {
  const i = args.indexOf('--slug');
  return i >= 0 ? (args[i + 1] ?? null) : null;
})();
const useAll = args.includes('--all');
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const mdDir = (() => {
  const i = args.indexOf('--md-dir');
  return i >= 0 ? (args[i + 1] ?? 'output') : 'output';
})();

const conn = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  ''
).replace(/[?&]sslmode=[^&]*/giu, '');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

interface Section {
  anchor: string;
  title_fr: string;
  body_fr: string;
}

interface ConciergeAdvice {
  fr?: { title?: string; body?: string; tip_for?: string };
  en?: { title?: string; body?: string; tip_for?: string };
}

function slugifyAnchor(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
}

function parseMarkdown(md: string): { lead: string; sections: Section[] } {
  // Strip H1.
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i]!.startsWith('# ')) i += 1;
  i += 1; // skip H1
  // skip blank
  while (i < lines.length && lines[i]!.trim() === '') i += 1;

  // Lead = paragraphs until first H2.
  const leadLines: string[] = [];
  while (i < lines.length && !lines[i]!.startsWith('## ')) {
    leadLines.push(lines[i]!);
    i += 1;
  }
  const lead = leadLines.join('\n').trim();

  const sections: Section[] = [];
  // Always emit a "Présentation" section from the lead so the front-end has
  // a canonical first section.
  if (lead.length > 0) {
    sections.push({
      anchor: 'presentation',
      title_fr: 'Présentation',
      body_fr: lead,
    });
  }

  while (i < lines.length) {
    if (lines[i]!.startsWith('## ')) {
      const title = lines[i]!.replace(/^##\s+/u, '').trim();
      i += 1;
      const bodyLines: string[] = [];
      while (i < lines.length && !lines[i]!.startsWith('## ')) {
        bodyLines.push(lines[i]!);
        i += 1;
      }
      const body = bodyLines.join('\n').trim();
      if (body.length >= 60) {
        sections.push({
          anchor: slugifyAnchor(title),
          title_fr: title,
          body_fr: body,
        });
      }
    } else {
      i += 1;
    }
  }

  return { lead, sections };
}

async function loadConciergeAdvice(slug: string): Promise<ConciergeAdvice | null> {
  const adviceFile = resolve(__dirname, mdDir, slug, '08-concierge-advice.json');
  try {
    const raw = await readFile(adviceFile, 'utf-8');
    const parsed = JSON.parse(raw) as { concierge_advice?: ConciergeAdvice };
    return parsed.concierge_advice ?? null;
  } catch {
    return null;
  }
}

async function loadFinalMd(slug: string): Promise<string | null> {
  const f1 = resolve(__dirname, mdDir, slug, 'final.md');
  try {
    return await readFile(f1, 'utf-8');
  } catch {
    return null;
  }
}

async function listSlugs(): Promise<string[]> {
  const dir = resolve(__dirname, mdDir);
  const entries = await readdir(dir);
  const out: string[] = [];
  for (const e of entries) {
    if (e.startsWith('_') || e.startsWith('.')) continue;
    const s = await stat(resolve(dir, e));
    if (!s.isDirectory()) continue;
    out.push(e);
  }
  return out;
}

await client.connect();

const slugs = useAll
  ? await listSlugs()
  : slugFilter
    ? [slugFilter]
    : (() => {
        console.error('Need --slug or --all. Use --dry-run to preview.');
        process.exit(1);
      })();

console.log(
  `[push-md] processing ${slugs.length} slugs (md-dir=${mdDir}, force=${force}, dry-run=${dryRun})`,
);

let pushed = 0;
let skipped = 0;
let missing = 0;

for (const slug of slugs) {
  const md = await loadFinalMd(slug);
  if (!md) {
    missing += 1;
    continue;
  }
  const { sections } = parseMarkdown(md);
  if (sections.length < 4) {
    console.warn(`  ⚠ ${slug}: only ${sections.length} sections parsed — skipping`);
    skipped += 1;
    continue;
  }

  const advice = await loadConciergeAdvice(slug);

  const { rows } = await client.query<{
    id: string;
    existing_count: number;
  }>(
    `select id,
            case when jsonb_typeof(long_description_sections) = 'array'
                 then jsonb_array_length(long_description_sections)
                 else 0
            end as existing_count
       from public.hotels
      where slug = $1`,
    [slug],
  );
  if (rows.length === 0) {
    console.warn(`  ⚠ ${slug}: not found in DB — skipping`);
    skipped += 1;
    continue;
  }
  const existing = rows[0]!.existing_count;
  if (!force && existing >= 6) {
    skipped += 1;
    continue;
  }

  const sectionsForJson = sections.map((s) => ({
    anchor: s.anchor,
    title_fr: s.title_fr,
    title_en: '',
    body_fr: s.body_fr,
    body_en: '',
  }));

  const updateSql =
    advice !== null
      ? `update public.hotels
            set long_description_sections = $1::jsonb,
                concierge_advice = $2::jsonb,
                updated_at = timezone('utc', now())
          where slug = $3`
      : `update public.hotels
            set long_description_sections = $1::jsonb,
                updated_at = timezone('utc', now())
          where slug = $2`;

  const updateParams =
    advice !== null
      ? [JSON.stringify(sectionsForJson), JSON.stringify(advice), slug]
      : [JSON.stringify(sectionsForJson), slug];

  if (dryRun) {
    const adviceFr = advice?.fr?.body ? `${advice.fr.body.split(/\s+/).length}w FR` : 'no advice';
    console.log(`  [dry-run] ${slug}: ${sections.length} sections, ${adviceFr}`);
  } else {
    await client.query(updateSql, updateParams);
    console.log(
      `  ✓ ${slug}: pushed ${sections.length} sections${advice ? ' + concierge_advice' : ''} (was ${existing})`,
    );
    pushed += 1;
  }
}

console.log(
  `\n[push-md] pushed=${pushed} skipped=${skipped} missing-md=${missing} of ${slugs.length}`,
);
await client.end();
