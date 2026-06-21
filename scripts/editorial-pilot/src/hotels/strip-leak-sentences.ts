/**
 * strip-leak-sentences.ts — STAGE 3b: deterministic, sentence-level removal of
 * residual scaffolding leaks that survive `descaffold-sections.ts` (LLM rewrite)
 * AND that `remove-scaffold-sections.ts` would over-correct.
 *
 * Why this exists (2026-06-21 audit)
 * ---------------------------------
 * After two `descaffold` passes, ~63 published fiches still carried a leak
 * marker. The surprise: the residual is NOT pure-scaffolding stubs — it is
 * mostly LONG, rich "services"/"chambres" sections (3 000-4 000 chars, e.g.
 * Fairmont Hanoi, Mandarin Oriental Wangfujing, Ritz-Carlton Amelia Island)
 * that contain ONE leaked sentence buried in otherwise-publishable prose
 * ("Les équipements connus du brief dessinent le portrait d'un hôtel attentif").
 * Two failure modes converge here:
 *   - `descaffold` (whole-chunk LLM rewrite) fails its "no longer than input"
 *     gate because the model can't faithfully reproduce a 3 900-char chunk, so
 *     the section is left UNCHANGED (still leaking).
 *   - `remove-scaffold-sections` would DROP the entire 3 900-char section
 *     because `body_fr` matches a marker → catastrophic content loss.
 *
 * The correct surgery is sentence-level: split body_fr into sentences, drop
 * ONLY the sentence(s) that carry a marker, keep the rest. If every sentence
 * leaks (a genuine pure-scaffolding stub) the section collapses to empty and is
 * dropped — same honest outcome as remove-scaffold, but only when warranted.
 *
 * Deterministic (no LLM): faster, free, and idempotent. FR is canonical; when a
 * section's body_fr changes, its body_en is blanked so `translate-sections-en`
 * regenerates a faithful EN.
 *
 * Scope: long_description_sections[].{title_fr,body_fr} + signature_experiences[]
 * .{title_fr,summary_fr}. (description_fr residual is handled by descaffold.)
 *
 * CLI:
 *   --apply         persist (default = dry-run, prints the plan)
 *   --limit=N       cap fiches processed
 *   --min-keep=120  min chars a stripped body must retain to survive (else drop)
 *
 * Skill: concierge-voice-pipeline, llm-output-robustness, content-enrichment-pipeline.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate.js';

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
interface Signature {
  readonly title_fr?: unknown;
  readonly summary_fr?: unknown;
  readonly summary_en?: unknown;
  readonly [k: string]: unknown;
}
interface Row {
  readonly id: string;
  readonly slug: string;
  readonly long_description_sections: Section[] | null;
  readonly signature_experiences: Signature[] | null;
}

function envCfg(): { base: string; key: string } {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { base: `${url.replace(/\/+$/u, '')}/rest/v1`, key };
}
function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Phrase-level pre-clean of scaffolding TAILS that attach to otherwise-real
 * data (chiefly the `en-pratique` structured bullet block). Removing the tail
 * in place preserves the address / GPS / classification on the same line —
 * far better than dropping the whole bullet. Order matters: longest tails
 * first. (2026-06-21 data-gap surgery.)
 */
function phrasePreClean(text: string): string {
  return text
    .replace(/\s*,?\s*sous r[ée]serve de confirmer[^.\n]*/giu, '')
    .replace(/\s+dans ce brief\b/giu, '')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+([;,.])/gu, '$1');
}

/**
 * Remove leaking content while preserving everything legitimate:
 *   1. phrase pre-clean (strip meta tails in place);
 *   2. if the result no longer leaks, keep it verbatim (structured blocks);
 *   3. else, for multi-line (bullet) bodies, drop ONLY the leaking lines;
 *   4. else, for single-line prose, drop ONLY the leaking sentences.
 * May return an empty string (a genuine pure-scaffolding stub → caller drops).
 */
function sentenceStrip(line: string): string {
  return splitSentences(line)
    .filter((s) => !hasLeak(s))
    .join(' ')
    .trim();
}

function cleanLeakBody(text: string): string {
  const pre = phrasePreClean(text);
  if (!hasLeak(pre)) return pre.trim();
  // Process line/paragraph by line: a leaking paragraph is sentence-stripped
  // in place (keep its clean sentences) — never dropped wholesale. Empty lines
  // are preserved to keep the paragraph/bullet structure intact.
  const out: string[] = [];
  for (const line of pre.split(/\r?\n/)) {
    if (line.trim() === '' || !hasLeak(line)) {
      out.push(line);
      continue;
    }
    const cleaned = sentenceStrip(line);
    if (cleaned.length > 0 && !hasLeak(cleaned)) out.push(cleaned);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

interface SecPlan {
  readonly anchor: string;
  readonly action: 'strip-body' | 'drop-section' | 'unchanged';
  readonly beforeLen: number;
  readonly afterLen: number;
}
interface RowPlan {
  readonly id: string;
  readonly slug: string;
  readonly sections: Section[];
  readonly signatures: Signature[];
  readonly secPlans: SecPlan[];
  readonly changed: boolean;
  readonly sectionCountAfter: number;
}

function planRow(row: Row, minKeep: number): RowPlan {
  const secPlans: SecPlan[] = [];
  const outSections: Section[] = [];
  for (const sec of row.long_description_sections ?? []) {
    const anchor = asStr(sec.anchor) || '?';
    const titleFr = asStr(sec.title_fr);
    const bodyFr = asStr(sec.body_fr);
    const titleLeaks = hasLeak(titleFr);
    const bodyLeaks = hasLeak(bodyFr);
    if (!titleLeaks && !bodyLeaks) {
      outSections.push(sec);
      secPlans.push({
        anchor,
        action: 'unchanged',
        beforeLen: bodyFr.length,
        afterLen: bodyFr.length,
      });
      continue;
    }
    // A leaking title = meta header → the section is scaffolding, drop it.
    if (titleLeaks) {
      secPlans.push({ anchor, action: 'drop-section', beforeLen: bodyFr.length, afterLen: 0 });
      continue;
    }
    const cleaned = cleanLeakBody(bodyFr);
    if (cleaned.length >= minKeep && !hasLeak(cleaned)) {
      // Surgery succeeded: keep the rich remainder, force EN re-translation.
      outSections.push({ ...sec, body_fr: cleaned, body_en: '' });
      secPlans.push({
        anchor,
        action: 'strip-body',
        beforeLen: bodyFr.length,
        afterLen: cleaned.length,
      });
    } else {
      // Whole section was scaffolding (or collapsed too far) → drop it.
      secPlans.push({
        anchor,
        action: 'drop-section',
        beforeLen: bodyFr.length,
        afterLen: cleaned.length,
      });
    }
  }

  const outSignatures: Signature[] = [];
  for (const sig of row.signature_experiences ?? []) {
    const titleFr = asStr(sig.title_fr);
    const summaryFr = asStr(sig.summary_fr);
    if (!hasLeak(titleFr) && !hasLeak(summaryFr)) {
      outSignatures.push(sig);
      continue;
    }
    if (hasLeak(titleFr)) continue; // drop the experience entirely
    const cleaned = cleanLeakBody(summaryFr);
    if (cleaned.length >= 40 && !hasLeak(cleaned))
      outSignatures.push({ ...sig, summary_fr: cleaned, summary_en: '' });
    // else drop the experience
  }

  const changed =
    outSections.length !== (row.long_description_sections ?? []).length ||
    outSignatures.length !== (row.signature_experiences ?? []).length ||
    secPlans.some((p) => p.action === 'strip-body');

  return {
    id: row.id,
    slug: row.slug,
    sections: outSections,
    signatures: outSignatures,
    secPlans,
    changed,
    sectionCountAfter: outSections.length,
  };
}

async function fetchAll(base: string, key: string): Promise<Row[]> {
  const PAGE = 400;
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const url = `${base}/hotels?is_published=eq.true&select=id,slug,long_description_sections,signature_experiences&order=slug.asc`;
    const res = await fetch(url, {
      headers: headers(key, { Range: `${from}-${from + PAGE - 1}` }),
    });
    if (!res.ok) throw new Error(`GET hotels ${res.status}`);
    const batch = (await res.json()) as Row[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

async function patch(
  base: string,
  key: string,
  id: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${base}/hotels?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(key, { Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${id} ${res.status} ${(await res.text()).slice(0, 160)}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const minKeepArg = argv.find((a) => a.startsWith('--min-keep='));
  const limit = limitArg ? Math.max(0, Number.parseInt(limitArg.slice('--limit='.length), 10)) : 0;
  const minKeep = minKeepArg
    ? Math.max(0, Number.parseInt(minKeepArg.slice('--min-keep='.length), 10))
    : 120;

  const { base, key } = envCfg();
  const rows = await fetchAll(base, key);

  const plans = rows.map((r) => planRow(r, minKeep)).filter((p) => p.changed);
  const capped = limit > 0 ? plans.slice(0, limit) : plans;

  let stripped = 0;
  let dropped = 0;
  let belowThree = 0;
  for (const p of capped) {
    for (const sp of p.secPlans) {
      if (sp.action === 'strip-body') stripped += 1;
      if (sp.action === 'drop-section') dropped += 1;
    }
    if (p.sectionCountAfter < 3) belowThree += 1;
    const tag = p.sectionCountAfter < 3 ? ' ⚠<3sections' : '';
    console.log(
      `${apply ? '[APPLY]' : '[DRY]'} ${p.slug} — sections ${(rows.find((r) => r.id === p.id)?.long_description_sections ?? []).length}→${p.sectionCountAfter}${tag}`,
    );
    for (const sp of p.secPlans.filter((x) => x.action !== 'unchanged')) {
      console.log(`    ${sp.action} [${sp.anchor}] ${sp.beforeLen}→${sp.afterLen}c`);
    }
    if (apply) {
      await patch(base, key, p.id, {
        long_description_sections: p.sections,
        signature_experiences: p.signatures,
      });
    }
  }

  console.log(
    `\n[strip-leak-sentences] ${apply ? 'APPLIED' : 'DRY-RUN'} — fiches=${capped.length} sentences-stripped=${stripped} sections-dropped=${dropped} fiches<3sections=${belowThree}`,
  );

  const RUNS = resolve(__dirname, '../../runs');
  mkdirSync(RUNS, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNS, `strip-leak-sentences-${ts}.json`),
    `${JSON.stringify({ apply, minKeep, fiches: capped.map((p) => ({ slug: p.slug, after: p.sectionCountAfter, plans: p.secPlans.filter((x) => x.action !== 'unchanged') })) }, null, 2)}\n`,
  );
}

main().catch((err: unknown) => {
  console.error('[strip-leak-sentences] FATAL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
