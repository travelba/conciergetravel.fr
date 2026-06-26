/**
 * clean-en-pratique-gaps.ts — deterministic removal of "field unspecified"
 * data-gap narration from the structured `en-pratique` bullet block of
 * `long_description_sections` (2026-06-26 catalogue audit, ADR-0029 inv. I1).
 *
 * Why this exists
 * ---------------
 * A past import wrote structured `en-pratique` bullets that narrate a missing
 * field straight into live prose on ~147 published fiches:
 *   FR — "Année de première distinction Palace : non renseignée"
 *   EN — "Year of First Palace Distinction: not specified" / "… not provided"
 * These are admin "not filled in" tokens, never legitimate Concierge prose.
 *
 * Why a DEDICATED tool (not strip-leak / remove-scaffold)
 * ------------------------------------------------------
 *   - `remove-scaffold-sections.ts` would DROP the whole en-pratique section
 *     (losing the legit address / coordinates / classification bullets).
 *   - `strip-leak-sentences.ts` does line-level surgery but (a) only on body_fr
 *     and (b) blanks body_en to '' — which fails the renderer's
 *     `body_en: z.string().min(1)` Zod gate and nukes the WHOLE sections array.
 *   - The EN gap phrasing ("not specified" / "not provided") is intentionally
 *     NOT a global `hasLeak()` marker because it also appears in ~43 legitimate
 *     long-read sections ("opening hours are not specified"). Stripping it
 *     globally would false-positive — so we strip it LOCALLY, scoped strictly to
 *     anchor === 'en-pratique', where it is always the structured data gap.
 *
 * Surgery (per en-pratique section, both locales, deterministic — no LLM):
 *   1. strip an inline trailing data-gap clause introduced by `;`/`,`
 *      ("…Atout France ; date de première distinction non renseignée" →
 *       "…Atout France"), preserving the legit lead of the bullet;
 *   2. drop any whole bullet LINE that is itself a pure data gap
 *      ("Capacité : non renseignée");
 *   3. keep every clean bullet (address, coordinates, classement, wellness).
 * body_en is OMITTED (key removed) only if it collapses to empty — never set ''.
 *
 * Idempotent: a second run finds nothing. FR canonical: a section whose body_fr
 * survives keeps rendering; the FR `hasLeak()` gate is the final correctness
 * assertion on the FR result.
 *
 * CLI:
 *   tsx src/hotels/clean-en-pratique-gaps.ts            # dry-run (default)
 *   tsx src/hotels/clean-en-pratique-gaps.ts --apply     # write
 *   tsx src/hotels/clean-en-pratique-gaps.ts --apply --limit=50
 *
 * Skill: concierge-voice-pipeline, llm-output-robustness, content-enrichment-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const EN_PRATIQUE_ANCHOR = 'en-pratique';

/** Data-gap tokens — FR admin placeholder + the EN en-pratique equivalents. */
const GAP_TOKEN_RE = /non renseign[ée]e?s?|\bnot (?:specified|provided)\b/iu;
/** A `;`/`,`-introduced trailing clause that ends in a data-gap token. */
const INLINE_GAP_CLAUSE_RE =
  /\s*[;,]\s*[^;,\n]*(?:non renseign[ée]e?s?|\bnot (?:specified|provided)\b)[^;,\n]*/giu;

interface Section {
  readonly anchor?: unknown;
  readonly body_fr?: unknown;
  readonly body_en?: unknown;
  readonly [k: string]: unknown;
}
interface Row {
  readonly id: string;
  readonly slug: string;
  readonly long_description_sections: Section[] | null;
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Remove data-gap content from a bullet block while preserving every legit
 * bullet. Returns the cleaned text (possibly empty).
 */
function cleanGapBody(text: string): string {
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    // 1. strip an inline trailing gap clause in place (keep the legit lead).
    let line = rawLine.replace(INLINE_GAP_CLAUSE_RE, '');
    line = line
      .replace(/[ \t]+([;,.])/gu, '$1')
      .replace(/[ \t]{2,}/gu, ' ')
      .trimEnd();
    // 2. a whole-line gap (e.g. "- Capacité : non renseignée") is dropped.
    if (GAP_TOKEN_RE.test(line)) continue;
    out.push(line);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

interface SecResult {
  readonly section: Section;
  readonly changed: boolean;
}

function cleanSection(sec: Section): SecResult {
  if (asStr(sec.anchor) !== EN_PRATIQUE_ANCHOR) return { section: sec, changed: false };
  const bodyFr = asStr(sec.body_fr);
  const bodyEn = asStr(sec.body_en);
  const frHasGap = bodyFr.length > 0 && GAP_TOKEN_RE.test(bodyFr);
  const enHasGap = bodyEn.length > 0 && GAP_TOKEN_RE.test(bodyEn);
  if (!frHasGap && !enHasGap) return { section: sec, changed: false };

  const next: { -readonly [K in keyof Section]: Section[K] } = { ...sec };
  let changed = false;

  if (frHasGap) {
    const cleaned = cleanGapBody(bodyFr);
    // Guardrail: never persist a still-leaking FR result.
    if (cleaned.length > 0 && !hasLeak(cleaned) && cleaned !== bodyFr) {
      next.body_fr = cleaned;
      changed = true;
    }
  }
  if (enHasGap) {
    const cleaned = cleanGapBody(bodyEn);
    if (cleaned !== bodyEn) {
      if (cleaned.length > 0) next.body_en = cleaned;
      // Empty EN ⇒ omit the key (renderer rejects '' and would nuke the array).
      else delete (next as Record<string, unknown>)['body_en'];
      changed = true;
    }
  }
  return { section: next, changed };
}

interface Plan {
  readonly id: string;
  readonly slug: string;
  readonly newSections: Section[];
  readonly sectionsChanged: number;
}

function planFor(row: Row): Plan | null {
  const sections = row.long_description_sections ?? [];
  let sectionsChanged = 0;
  const newSections: Section[] = [];
  for (const sec of sections) {
    const r = cleanSection(sec);
    if (r.changed) sectionsChanged += 1;
    newSections.push(r.section);
  }
  if (sectionsChanged === 0) return null;
  return { id: row.id, slug: row.slug, newSections, sectionsChanged };
}

function cfgFromEnv(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !serviceRoleKey)
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { url, serviceRoleKey };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Math.max(0, Number.parseInt(limitArg.slice('--limit='.length), 10)) : 0;

  const cfg = cfgFromEnv();
  const rows = await selectHotels<Row>(cfg, {
    columns: 'id,slug,long_description_sections',
    filters: ['is_published=eq.true'],
    order: 'slug.asc',
  });

  const plans: Plan[] = [];
  for (const r of rows) {
    const p = planFor(r);
    if (p) plans.push(p);
  }
  const targets = limit > 0 ? plans.slice(0, limit) : plans;

  console.log(`published scanned = ${rows.length}`);
  console.log(`fiches to clean   = ${plans.length}`);
  console.log(
    `  en-pratique sections cleaned = ${plans.reduce((n, p) => n + p.sectionsChanged, 0)}`,
  );

  const RUNS = resolve(__dirname, '../../runs');
  mkdirSync(RUNS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');

  if (!apply) {
    for (const p of targets.slice(0, 20))
      console.log(`  [DRY] ${p.slug} (${p.sectionsChanged} sec)`);
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
    return;
  }

  // Rollback snapshot of the ORIGINAL content of every targeted row.
  const targetIds = new Set(targets.map((t) => t.id));
  const backup = rows
    .filter((r) => targetIds.has(r.id))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      long_description_sections: r.long_description_sections,
    }));
  writeFileSync(resolve(RUNS, `en-pratique-gaps-backup-${stamp}.json`), JSON.stringify(backup));
  console.log(`backup → runs/en-pratique-gaps-backup-${stamp}.json (${backup.length} rows)`);

  let done = 0;
  for (const p of targets) {
    await patchHotelById(cfg, p.id, { long_description_sections: p.newSections });
    done += 1;
    if (done % 25 === 0) console.log(`  …${done}/${targets.length}`);
  }
  console.log(`Done — wrote ${done} fiche(s).`);
}

main().catch((err: unknown) => {
  console.error('[clean-en-pratique-gaps] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
