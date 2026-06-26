/**
 * clean-en-pratique-datagap.ts — deterministic removal of user-visible
 * "data-gap" artefacts that the shared `hasLeak()` gate intentionally
 * tolerates as a "field unspecified" state but that the 2026-06 audit
 * flagged as a live regression on ~147 published fiches.
 *
 * Two distinct shapes, both surgically removed WITHOUT ever dropping a section
 * (the section-count floor of 3 is therefore preserved by construction):
 *
 *   1. STRUCTURED BULLET BLOCK ("En pratique") — bullet lines whose value is a
 *      pure data gap:
 *        "- Date de distinction Palace : non renseignée"
 *        "- Capacity: not specified"
 *      → drop the whole bullet line; and trailing data-gap clauses glued onto a
 *        real bullet:
 *        "- Distinction : présence dans le registre Atout France ; année de
 *          première distinction non renseignée"
 *      → strip only the "; … non renseignée" tail, keep the real value.
 *
 *   2. PROSE that narrates the data brief/dossier — sentence-level removal of
 *      the leaking sentence(s) only (mirrors strip-leak-sentences.ts):
 *        "The available brief does not detail the dining offer …"
 *      Catches both the shared `hasLeak()` markers AND the "available brief"
 *      shape that `hasLeak()` misses (an adjective sits between "the" and
 *      "brief", defeating the gate's adjacency rule — see scaffolding-gate.ts).
 *
 * Locale rules: FR is canonical. A cleaned FR body that would collapse to
 * empty is LEFT UNTOUCHED and flagged (never blank a canonical field). A
 * cleaned EN body that collapses is REMOVED (key omitted → /en renders the FR
 * fallback, and translate-sections-en can regenerate it).
 *
 * Deterministic, idempotent, NO LLM. Dry-run by default; --apply writes a
 * rollback backup first.
 *
 * CLI:
 *   tsx src/hotels/clean-en-pratique-datagap.ts            # dry-run
 *   tsx src/hotels/clean-en-pratique-datagap.ts --apply
 *   tsx src/hotels/clean-en-pratique-datagap.ts --apply --limit=50
 *   tsx src/hotels/clean-en-pratique-datagap.ts --apply --min-prose=80
 *
 * Skill: concierge-voice-pipeline, llm-output-robustness, content-enrichment-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

interface Section {
  readonly anchor?: unknown;
  readonly title_fr?: unknown;
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
 * Pure data-gap VALUES (FR + EN). Matched only as the whole value of a bullet
 * or as a trailing clause — never against free prose, so a legitimate
 * "non documenté depuis 1850" stays safe.
 */
const DATA_GAP_VALUE =
  /(?:non\s+renseign\w*|non\s+document\w*|non\s+pr[ée]cis\w*|non\s+communiqu\w*|not\s+specified|not\s+provided|not\s+documented|not\s+available|not\s+disclosed|undocumented|unspecified)/iu;

/** A full bullet line whose value (after the first colon) is only a data gap. */
const FULL_GAP_BULLET = new RegExp(
  String.raw`^[-*•\s]*.+?:\s*(?:${DATA_GAP_VALUE.source})\.?\s*$`,
  'iu',
);

/** A trailing "; … <data-gap>" clause glued onto an otherwise-real bullet. */
const TRAILING_GAP_CLAUSE = new RegExp(
  String.raw`\s*[;,]\s*[^;,]*?\b(?:${DATA_GAP_VALUE.source})\b[^;,]*?\.?\s*$`,
  'iu',
);

/**
 * Prose-leak supplement: the "available brief" / "the brief does not …" shapes
 * that `hasLeak()` misses because an adjective breaks its "the brief" adjacency
 * rule. High precision: requires the document-noun reading, never adjectival
 * "a brief stroll".
 */
const PROSE_BRIEF_LEAK =
  /\b(?:the|this)\s+(?:available|current|provided|present|supplied)\s+brief\b|\bbrief\b\s+(?:does\s+not|doesn['’]t|do\s+not|fails?\s+to)\s+(?:detail|describe|specify|mention|list|cover|provide)|\ble\s+brief\s+ne\b/iu;

function proseSentenceLeaks(sentence: string): boolean {
  return hasLeak(sentence) || PROSE_BRIEF_LEAK.test(sentence);
}

/** Strip the " dans ce brief" / "dans le brief" tail before any other pass. */
function stripBriefTail(line: string): string {
  return line.replace(/\s+dans\s+(?:ce|le)\s+brief\b/giu, '');
}

/** A body that looks like a structured bullet block (En pratique style). */
function isBulletBlock(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const bullets = lines.filter((l) => /^\s*[-*•]/u.test(l)).length;
  return bullets >= Math.ceil(lines.length / 2);
}

/** Clean a structured bullet block: drop pure-gap bullets, trim glued tails. */
function cleanBulletBlock(text: string): string {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = stripBriefTail(raw);
    if (line.trim() === '') {
      out.push(line);
      continue;
    }
    if (FULL_GAP_BULLET.test(line)) continue; // value is only a data gap → drop
    out.push(line.replace(TRAILING_GAP_CLAUSE, ''));
  }
  return out
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** Clean prose: drop only the leaking sentences, keep the rest. */
function cleanProse(text: string): string {
  return splitSentences(stripBriefTail(text))
    .filter((s) => !proseSentenceLeaks(s))
    .join(' ')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function cleanBody(text: string): string {
  if (text.trim().length === 0) return text;
  return isBulletBlock(text) ? cleanBulletBlock(text) : cleanProse(text);
}

/** Does this body carry any marker in scope for this cleaner? */
function bodyNeedsClean(text: string): boolean {
  if (text.trim().length === 0) return false;
  if (hasLeak(text) || PROSE_BRIEF_LEAK.test(text)) return true;
  // Bullet data-gaps are gate-clean; detect them line by line.
  return text.split(/\r?\n/).some((l) => FULL_GAP_BULLET.test(l) || TRAILING_GAP_CLAUSE.test(l));
}

interface SecPlan {
  readonly anchor: string;
  readonly frBefore: number;
  readonly frAfter: number;
  readonly enBefore: number;
  readonly enAfter: number;
  readonly frKept: boolean; // FR canonical preserved despite collapse
  readonly enBlanked: boolean; // EN dropped to FR fallback
}
interface RowPlan {
  readonly id: string;
  readonly slug: string;
  readonly sections: Section[];
  readonly secPlans: SecPlan[];
  readonly changed: boolean;
  readonly sectionCount: number;
}

function planRow(row: Row, minProse: number): RowPlan {
  const sections = row.long_description_sections ?? [];
  const out: Section[] = [];
  const secPlans: SecPlan[] = [];
  let changed = false;

  for (const sec of sections) {
    const anchor = asStr(sec.anchor) || '?';
    const frBody = asStr(sec.body_fr);
    const enBody = asStr(sec.body_en);
    const frNeeds = bodyNeedsClean(frBody);
    const enNeeds = bodyNeedsClean(enBody);

    if (!frNeeds && !enNeeds) {
      out.push(sec);
      continue;
    }

    const next: { -readonly [K in keyof Section]: Section[K] } = { ...sec };
    let frKept = false;
    let enBlanked = false;
    let frAfterLen = frBody.length;
    let enAfterLen = enBody.length;

    if (frNeeds) {
      const cleaned = cleanBody(frBody);
      const minKeep = isBulletBlock(frBody) ? 1 : minProse;
      if (cleaned.length >= minKeep && !proseSentenceLeaks(cleaned)) {
        next.body_fr = cleaned;
        frAfterLen = cleaned.length;
        changed = true;
      } else {
        // Never blank a canonical FR field — keep original, signal.
        frKept = true;
        frAfterLen = frBody.length;
      }
    }

    if (enNeeds) {
      const cleaned = cleanBody(enBody);
      const minKeep = isBulletBlock(enBody) ? 1 : minProse;
      if (cleaned.length >= minKeep && !proseSentenceLeaks(cleaned)) {
        next.body_en = cleaned;
        enAfterLen = cleaned.length;
        changed = true;
      } else {
        // EN is regenerable → omit the key so /en falls back to FR (an empty
        // string would fail the renderer's body_en min-length parse and hide
        // the whole story block — see remove-scaffold-sections.ts).
        delete (next as { body_en?: unknown }).body_en;
        enBlanked = true;
        enAfterLen = 0;
        changed = true;
      }
    }

    out.push(next);
    secPlans.push({
      anchor,
      frBefore: frBody.length,
      frAfter: frAfterLen,
      enBefore: enBody.length,
      enAfter: enAfterLen,
      frKept,
      enBlanked,
    });
  }

  return { id: row.id, slug: row.slug, sections: out, secPlans, changed, sectionCount: out.length };
}

function envCfg(): SupabaseRestConfig {
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
  const minProseArg = argv.find((a) => a.startsWith('--min-prose='));
  const limit = limitArg ? Math.max(0, Number.parseInt(limitArg.slice('--limit='.length), 10)) : 0;
  const minProse = minProseArg
    ? Math.max(0, Number.parseInt(minProseArg.slice('--min-prose='.length), 10))
    : 80;

  const cfg = envCfg();
  const rows = await selectHotels<Row>(cfg, {
    columns: 'id,slug,long_description_sections',
    filters: ['is_published=eq.true'],
    order: 'slug.asc',
  });

  const plans = rows.map((r) => planRow(r, minProse)).filter((p) => p.changed);
  const capped = limit > 0 ? plans.slice(0, limit) : plans;

  let frStripped = 0;
  let enBlanked = 0;
  let frKept = 0;
  let belowThree = 0;
  for (const p of capped) {
    for (const sp of p.secPlans) {
      if (sp.frAfter !== sp.frBefore && !sp.frKept) frStripped += 1;
      if (sp.enBlanked) enBlanked += 1;
      if (sp.frKept) frKept += 1;
    }
    if (p.sectionCount < 3) belowThree += 1;
    console.log(
      `${apply ? '[APPLY]' : '[DRY]'} ${p.slug} — sections=${p.sectionCount}` +
        (p.sectionCount < 3 ? ' ⚠<3sections' : ''),
    );
    for (const sp of p.secPlans) {
      const bits: string[] = [];
      if (sp.frAfter !== sp.frBefore && !sp.frKept) bits.push(`fr ${sp.frBefore}→${sp.frAfter}c`);
      if (sp.frKept) bits.push(`fr KEPT (would collapse)`);
      if (sp.enBlanked) bits.push(`en BLANKED (FR fallback)`);
      else if (sp.enAfter !== sp.enBefore) bits.push(`en ${sp.enBefore}→${sp.enAfter}c`);
      if (bits.length > 0) console.log(`    [${sp.anchor}] ${bits.join(' · ')}`);
    }
  }

  console.log(
    `\n[clean-en-pratique-datagap] ${apply ? 'APPLIED' : 'DRY-RUN'} — fiches=${capped.length} ` +
      `fr-stripped=${frStripped} en-blanked=${enBlanked} fr-kept(collapse-guard)=${frKept} fiches<3sections=${belowThree}`,
  );

  const RUNS = resolve(__dirname, '../../runs');
  mkdirSync(RUNS, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (capped.length > 0) {
    const backup = rows
      .filter((r) => capped.some((p) => p.id === r.id))
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        long_description_sections: r.long_description_sections,
      }));
    writeFileSync(
      resolve(RUNS, `en-pratique-datagap-backup-${ts}.json`),
      `${JSON.stringify(backup)}\n`,
    );
    console.log(`[backup] runs/en-pratique-datagap-backup-${ts}.json (${backup.length} rows)`);
  }

  if (!apply) {
    console.log('DRY-RUN — re-run with --apply to persist.');
    return;
  }

  let done = 0;
  for (const p of capped) {
    await patchHotelById(cfg, p.id, { long_description_sections: p.sections });
    done += 1;
    if (done % 25 === 0) console.log(`  …${done}/${capped.length}`);
  }
  console.log(`Done — wrote ${done} fiche(s).`);
}

main().catch((err: unknown) => {
  console.error(
    '[clean-en-pratique-datagap] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
