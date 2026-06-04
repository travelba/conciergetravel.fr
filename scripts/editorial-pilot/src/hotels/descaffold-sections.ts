/**
 * CLI — strip leaked editorial "brief" scaffolding from published hotel prose.
 *
 * Problem
 * -------
 * An earlier editorial generation pass leaked its INTERNAL brief meta-commentary
 * into the live, rendered prose of ~1795 published fiches (81% of the catalogue).
 * The leak lives almost entirely in `long_description_sections[].body_fr` and
 * `signature_experiences[].summary_fr` (only 7 fiches in `description_fr`):
 *
 *   "le brief ne fournit aucune date historique exploitable, hormis une mention
 *    `AUTO_DRAFT`"  ·  "Wikidata, via l'entité Q111874352, ne livre aucun repère"
 *   ·  "avec un niveau de confiance `low`"  ·  "Le brief confirme le niveau 5
 *   étoiles. Aucune mention ... ne peut être retenue ici sans revalidation."
 *
 * Google + LLMs ingest this. It is an EEAT / SEO / GEO regression.
 *
 * Why an LLM rewrite (not a regex strip)
 * --------------------------------------
 * The meta-commentary is woven INTO sentences that also carry publishable facts
 * ("Accor apparaît dans le brief comme fondateur, avec une ouverture indiquée en
 * 2003 selon Wikidata" → keep "Accor", "2003", drop "dans le brief"/"selon
 * Wikidata"). A sentence-level regex strip would destroy real content. We rewrite
 * each affected chunk to REMOVE the scaffolding while preserving every fact, the
 * Concierge voice, and ≤ 25-word sentences (ADR-0011). Pattern = surgical
 * cleanup, not generation (Rule 9). Two validation gates protect the catalogue:
 *   1. the output MUST be leak-free (no marker survives);
 *   2. the output MUST NOT be longer than the input (we only remove);
 *   3. a near-empty result (pure-scaffolding chunk) is NOT written — flagged
 *      for manual review instead.
 *
 * Modes:
 *   --dry-run            rewrite + print before/after diffs, NO write (default safe)
 *   --slug=<s>           one fiche
 *   --slugs=a,b,c        explicit list (PowerShell: quote the arg)
 *   --limit=<n>          cap fiches processed
 *   --all                every published fiche carrying a leak marker
 *   --concurrency=<n>    LLM concurrency (default 3)
 *   --show               print full before/after text (else truncated)
 *
 * Skill: concierge-voice-pipeline, content-enrichment-pipeline,
 * llm-output-robustness (Rule 9), editorial-long-read-rendering.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import type { SupabaseRestConfig } from './supabase-hotels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

const TOLERANCE_WORDS = 32;

interface CliArgs {
  readonly dryRun: boolean;
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly limit: number | null;
  readonly all: boolean;
  readonly concurrency: number;
  readonly show: boolean;
  readonly mini: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let dryRun = false;
  let slug: string | null = null;
  let slugs: string[] = [];
  let limit: number | null = null;
  let all = false;
  let concurrency = 3;
  let show = false;
  let mini = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--all') all = true;
    else if (a === '--show') show = true;
    else if (a === '--mini') mini = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length) || null;
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length));
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = Math.floor(n);
    }
  }
  return { dryRun, slug, slugs, limit, all, concurrency, show, mini };
}

// ---------------------------------------------------------------------------
// Leak detection — shared by candidate selection AND post-validation.
// ---------------------------------------------------------------------------

/**
 * Markers of leaked brief / pipeline meta-commentary. A backtick in prose is
 * itself a strong signal (real descriptions never carry code-fenced tokens).
 */
const LEAK_MARKERS =
  /\ble brief\b|\bbrief\b(?=[^.]*\b(?:confirme|fournit|signale|indique|incomplet|notes?|mention)\b)|AUTO_DRAFT|niveau de confiance|\bconfidence\b|`[^`]*`|reste à (?:vérifier|revalider)|à revalider|sans revalidation|non vérifiée?s?|wikidata|entité\s+Q\d|\bQ\d{5,}\b|matière publiable|ne peut être retenue?|statut\s+pending|\bpending\b|selon les sources publiques|note interne/iu;

function hasLeak(text: string | null | undefined): boolean {
  return typeof text === 'string' && LEAK_MARKERS.test(text);
}

function wordCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function maxSentenceWords(text: string): number {
  let max = 0;
  for (const s of splitSentences(text)) max = Math.max(max, wordCount(s));
  return max;
}

// ---------------------------------------------------------------------------
// DB (Supabase REST — service-role; same pattern as extract-michelin / dedup).
// ---------------------------------------------------------------------------

const SupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

interface Section {
  readonly key?: string;
  readonly type?: string;
  readonly anchor?: string;
  readonly title_fr?: string;
  readonly title_en?: string;
  readonly body_fr?: string;
  readonly body_en?: string;
  readonly [k: string]: unknown;
}

interface Signature {
  readonly name?: string;
  readonly summary_fr?: string;
  readonly summary_en?: string;
  readonly [k: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly description_fr: string | null;
  readonly long_description_sections: Section[] | null;
  readonly signature_experiences: Signature[] | null;
}

const REST_COLUMNS = 'id,slug,description_fr,long_description_sections,signature_experiences';
const PAGE_SIZE = 300;

function rowHasLeak(row: HotelRow): boolean {
  if (hasLeak(row.description_fr)) return true;
  if (Array.isArray(row.long_description_sections)) {
    for (const s of row.long_description_sections) {
      if (s && typeof s === 'object' && hasLeak(s.body_fr)) return true;
    }
  }
  if (Array.isArray(row.signature_experiences)) {
    for (const sig of row.signature_experiences) {
      if (sig && typeof sig === 'object' && hasLeak(sig.summary_fr)) return true;
    }
  }
  return false;
}

async function fetchCandidates(
  cfg: SupabaseRestConfig,
  args: CliArgs,
): Promise<readonly HotelRow[]> {
  const headers = {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    Accept: 'application/json',
  };
  // Explicit slug list → direct fetch (no leak pre-filter, so callers can audit a fiche).
  if (args.slug !== null || args.slugs.length > 0) {
    const list = args.slug !== null ? [args.slug] : args.slugs;
    const params = new URLSearchParams();
    params.set('select', REST_COLUMNS);
    params.set('slug', `in.(${list.join(',')})`);
    const res = await fetch(`${cfg.url}/rest/v1/hotels?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`[descaffold] SELECT failed (${res.status}): ${await res.text()}`);
    return (await res.json()) as HotelRow[];
  }
  // Otherwise paginate all published fiches and filter leaks client-side
  // (PostgREST can't run the multi-column regex; same approach as michelin).
  const bySlug = new Map<string, HotelRow>();
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set('select', REST_COLUMNS);
    params.set('is_published', 'eq.true');
    params.set('order', 'slug.asc');
    params.set('limit', String(PAGE_SIZE));
    if (offset > 0) params.set('offset', String(offset));
    const res = await fetch(`${cfg.url}/rest/v1/hotels?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`[descaffold] SELECT failed (${res.status}): ${await res.text()}`);
    const page = (await res.json()) as HotelRow[];
    for (const row of page) if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
  }
  let out = [...bySlug.values()].filter(rowHasLeak);
  if (args.limit !== null) out = out.slice(0, args.limit);
  return out;
}

// ---------------------------------------------------------------------------
// LLM cleanup.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Tu es correcteur éditorial pour MyConciergeHotel.com (palaces 5★, Relais & Châteaux).

Le texte fourni contient du MÉTA-COMMENTAIRE de pipeline qui n'aurait jamais dû être publié : références au "brief", à des statuts techniques (\`AUTO_DRAFT\`, \`pending\`, \`low\`), à des "niveaux de confiance", à des identifiants Wikidata (Q123456), des mentions "selon les sources publiques", "reste à vérifier", "sans revalidation", "note interne", "matière publiable", ou un narrateur qui commente son propre travail ("Je resterais strict", "loin des fiches qui brodent", "Vous n'avez pas encore...").

Ta mission : RÉÉCRIRE le texte pour SUPPRIMER tout ce méta-commentaire, en gardant une prose naturelle et fluide.

Règles STRICTES :
1. SUPPRIME toute trace de : brief, AUTO_DRAFT, statuts techniques entre backticks, niveaux de confiance, Wikidata / identifiants Q, "selon les sources publiques", "reste à vérifier / à revalider / sans revalidation", "note interne", auto-commentaire du rédacteur. AUCUN backtick ne doit subsister.
2. PRÉSERVE tous les FAITS publiables noyés dans ces phrases : noms propres, marques, opérateurs (ex. "Accor"), chiffres, dates (ex. "ouverture en 2003"), lieux, coordonnées formulées en clair, distinctions. Reformule la phrase pour garder le fait SANS la source/le hedging. Ex : "ouverture indiquée en 2003 selon Wikidata" → "ouvert en 2003".
3. N'INVENTE RIEN. N'ajoute aucun fait, aucune date, aucune distinction absente du texte. Si une info n'est pas publiable une fois le méta-commentaire retiré, retire simplement la phrase.
4. Voix Concierge : expert complice, sobre, jamais commercial. Pas de superlatifs creux ("incroyable", "magnifique", "véritable écrin").
5. Toute phrase ≤ 25 mots. Coupe les phrases trop longues.
6. Le résultat doit être PLUS COURT ou égal à l'entrée (on retire, on n'ajoute pas).
7. Si, une fois le méta-commentaire retiré, il ne reste AUCUN contenu publiable, renvoie exactement la chaîne vide.

Format : renvoie UNIQUEMENT le texte nettoyé, sans préambule, sans markdown, sans guillemets englobants. Conserve les retours à la ligne utiles.`;

type LlmClient = {
  readonly model: string;
  call: (opts: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseFormat?: 'text' | 'json';
  }) => Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }>;
};

interface CleanOk {
  readonly ok: true;
  readonly cleaned: string;
  readonly emptied: boolean;
  readonly tokens: { input: number; output: number };
}
interface CleanFail {
  readonly ok: false;
  readonly reason: string;
  readonly tokens: { input: number; output: number };
}

/**
 * Key:value bullet sections ("En pratique") are structured data, not prose.
 * Free-form LLM rewrite mangles their bullet formatting. We strip leaks
 * deterministically instead: drop whole meta lines (Sources / confidence /
 * brief status), strip inline source qualifiers from values, preserve the
 * bullet prefix + "Key : value" shape verbatim.
 */
const BULLET_RE = /^(\s*[-•*]\s+)(.*)$/u;

function isListBody(text: string): boolean {
  return text.split(/\r?\n/u).filter((l) => BULLET_RE.test(l)).length >= 2;
}

// Inline "selon X" / "(confiance …)" / brief-status fragments inside a value.
const INLINE_QUALIFIERS =
  /\s*(?:,\s*)?(?:selon|d['’]après|via)\s+(?:wikidata|l['’]entité\s+Q\d+|la fiche[^,.;]*|le registre[^,.;]*|atout france|le site officiel[^,.;]*|le guide michelin|cvent|kayak|booking|les sources? publiques?)|[([]\s*(?:confiance|confidence)\s+\w+\s*[)\]]|\s*[-–]\s*(?:confiance|confidence)\s+\w+|`[^`]*`|\bAUTO_DRAFT\b|\bpending\b/giu;

// A bullet line whose KEY marks it as pure pipeline meta → drop the whole line.
const META_KEY_RE =
  /^(sources?\b|sources? principales?|statut|auto[_ ]?status|confiance|niveau de confiance|brief|note interne|vérification)/iu;
// A value that is nothing but a hedge → drop the line.
const HEDGE_VALUE_RE =
  /^(?:non vérifiée?s?|à (?:vérifier|revalider)|reste à vérifier|sans revalidation|pending|low|medium|high|\bn\/?a\b|—|-)?\s*$/iu;

function cleanListBodyDeterministic(text: string): CleanOk | CleanFail {
  const tokens = { input: 0, output: 0 };
  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/u)) {
    const m = BULLET_RE.exec(rawLine);
    if (m === null) {
      // Non-bullet line inside a list block — strip inline qualifiers, keep if it survives.
      const stripped = rawLine
        .replace(INLINE_QUALIFIERS, '')
        .replace(/\s{2,}/gu, ' ')
        .trimEnd();
      if (stripped.trim().length > 0 && !hasLeak(stripped)) out.push(stripped);
      continue;
    }
    const prefix = m[1] ?? '- ';
    const content = (m[2] ?? '').trim();
    const colon = content.indexOf(':');
    const rawKey = colon >= 0 ? content.slice(0, colon).trim() : content;
    // Normalise markdown emphasis (**Key**, _Key_, `Key`) before the meta test.
    const key = rawKey.replace(/[*_`]/gu, '').trim();
    if (META_KEY_RE.test(key)) continue; // drop "Sources principales : …" etc.

    let candidate: string;
    if (colon >= 0) {
      const value = content
        .slice(colon + 1)
        .replace(INLINE_QUALIFIERS, '')
        .replace(/\s*;\s*/gu, ' ; ')
        .replace(/\s{2,}/gu, ' ')
        .replace(/[;,]\s*$/u, '')
        .trim();
      if (value.length === 0 || HEDGE_VALUE_RE.test(value)) continue; // drop hedge-only line
      candidate = `${prefix}${rawKey} : ${value}`;
    } else {
      const cleanedContent = content
        .replace(INLINE_QUALIFIERS, '')
        .replace(/\s{2,}/gu, ' ')
        .trim();
      if (cleanedContent.length === 0) continue;
      candidate = `${prefix}${cleanedContent}`;
    }
    // Deterministic guarantee: any line still carrying a leak marker after
    // stripping is unsalvageable pipeline meta/hedge → drop it entirely.
    if (hasLeak(candidate)) continue;
    out.push(candidate);
  }
  const cleaned = out.join('\n').trim();
  if (wordCount(cleaned) < 3) return { ok: true, cleaned: '', emptied: true, tokens };
  // Should be unreachable now (every kept line is leak-checked), but keep as a
  // hard backstop so we never write a leaked list.
  if (hasLeak(cleaned))
    return { ok: false, reason: 'leak survived deterministic list strip', tokens };
  return { ok: true, cleaned, emptied: false, tokens };
}

/**
 * Robust single LLM cleanup call. gpt-5.x intermittently returns an empty body
 * (3 completion tokens, no reasoning) on ~30% of short chunks — and the OpenAI
 * client THROWS on empty content. We retry with a larger token budget + higher
 * temperature, and NEVER let the throw propagate (one bad chunk must not kill
 * the whole fiche). Returns null content only after all attempts fail.
 */
async function callCleanup(
  llm: LlmClient,
  text: string,
): Promise<
  | { content: string; input: number; output: number }
  | { content: null; input: number; output: number }
> {
  const baseTokens = Math.max(600, Math.floor(wordCount(text) * 5));
  let input = 0;
  let output = 0;
  // 2 attempts: only RETRY on genuine transient errors. An "Empty response"
  // is the model intentionally applying Rule 7 (no publishable content) — we
  // accept it immediately (content '') instead of burning 2-3 calls per
  // pure-scaffolding section across the whole catalogue.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await llm.call({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt:
          attempt === 0 ? text : `${text}\n\n[Réécris en appliquant les règles ci-dessus.]`,
        temperature: 0.2,
        maxOutputTokens: baseTokens * (attempt + 1),
        responseFormat: 'text',
      });
      input += res.usage.inputTokens;
      output += res.usage.outputTokens;
      return { content: res.content.trim(), input, output };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/empty response/iu.test(msg)) return { content: '', input, output };
      // transient (network/timeout/5xx) → retry once.
    }
  }
  return { content: null, input, output };
}

async function cleanChunk(llm: LlmClient, text: string): Promise<CleanOk | CleanFail> {
  const res = await callCleanup(llm, text);
  const tokens = { input: res.input, output: res.output };
  // A persistent empty body almost always means the model applied Rule 7 — the
  // chunk is pure scaffolding with nothing publishable left. (gpt-5.x emits an
  // empty completion, which the client surfaces as a throw → null here.) Bucket
  // it as "emptied" so we keep the original and flag it, never as a hard fail.
  if (res.content === null) {
    return { ok: true, cleaned: '', emptied: true, tokens };
  }
  const cleaned = res.content.replace(/^["'`]+|["'`]+$/g, '').trim();

  // Pure-scaffolding chunk → model returned (near) empty. Flag, never write junk.
  if (wordCount(cleaned) < 12) {
    return { ok: true, cleaned: '', emptied: true, tokens };
  }
  // Gate 0 — catastrophe over-deletion guard. A substantial section that
  // collapses to a fraction of its size almost always means the model nuked
  // legitimate facts (observed on the mechanical tier). Reject, keep original,
  // surface for manual review rather than silently shipping content loss.
  const origWords = wordCount(text);
  if (origWords >= 120 && wordCount(cleaned) < origWords * 0.4) {
    return {
      ok: false,
      reason: `over-deletion (${origWords}→${wordCount(cleaned)} words, <40%)`,
      tokens,
    };
  }
  // Gate 1 — must be leak-free.
  if (hasLeak(cleaned)) {
    return { ok: false, reason: 'leak marker survived rewrite', tokens };
  }
  // Gate 2 — we only remove; reject growth (LLM padding / invention).
  if (wordCount(cleaned) > Math.ceil(wordCount(text) * 1.05)) {
    return {
      ok: false,
      reason: `output longer than input (${wordCount(text)}→${wordCount(cleaned)} words)`,
      tokens,
    };
  }
  // Gate 3 — sentence-length sanity, but don't punish list-style sections that
  // were ALREADY long-form (colon-led enumerations read as one "sentence").
  // De-scaffolding's mission is leak removal; sentence-shortening is a separate
  // pass. Only reject if the cleanup INTRODUCED a longer sentence than existed.
  const allowedMax = Math.max(TOLERANCE_WORDS, maxSentenceWords(text));
  const worst = maxSentenceWords(cleaned);
  if (worst > allowedMax) {
    return {
      ok: false,
      reason: `cleanup introduced a ${worst}-word sentence (orig max ${maxSentenceWords(text)})`,
      tokens,
    };
  }
  return { ok: true, cleaned, emptied: false, tokens };
}

interface ChunkChange {
  readonly where: string;
  readonly before: string;
  readonly after: string;
  readonly emptied: boolean;
  readonly failed?: boolean;
  readonly failedReason?: string;
}

interface FicheResult {
  readonly slug: string;
  readonly id: string;
  readonly status: 'cleaned' | 'skipped' | 'partial' | 'review';
  readonly changes: readonly ChunkChange[];
  readonly emptiedChunks: number;
  readonly failures: number;
  readonly tokens: { input: number; output: number };
  readonly newDescription: string | null;
  readonly newSections: Section[] | null;
  readonly newSignatures: Signature[] | null;
  readonly reason?: string;
}

async function processFiche(llm: LlmClient, row: HotelRow): Promise<FicheResult> {
  const changes: ChunkChange[] = [];
  let tIn = 0;
  let tOut = 0;
  let failures = 0;
  let emptied = 0;

  let newDescription = row.description_fr;
  if (hasLeak(row.description_fr) && typeof row.description_fr === 'string') {
    const out = await cleanChunk(llm, row.description_fr);
    tIn += out.tokens.input;
    tOut += out.tokens.output;
    if (out.ok && !out.emptied) {
      newDescription = out.cleaned;
      changes.push({
        where: 'description_fr',
        before: row.description_fr,
        after: out.cleaned,
        emptied: false,
      });
    } else if (out.ok && out.emptied) {
      emptied += 1;
      changes.push({
        where: 'description_fr',
        before: row.description_fr,
        after: '',
        emptied: true,
      });
    } else if (!out.ok) {
      failures += 1;
      changes.push({
        where: 'description_fr',
        before: row.description_fr,
        after: row.description_fr,
        emptied: false,
        failed: true,
        failedReason: out.reason,
      });
    }
  }

  const sections = Array.isArray(row.long_description_sections)
    ? [...row.long_description_sections]
    : [];
  const newSections: Section[] = [];
  for (const s of sections) {
    if (s && typeof s === 'object' && typeof s.body_fr === 'string' && hasLeak(s.body_fr)) {
      const out = isListBody(s.body_fr)
        ? cleanListBodyDeterministic(s.body_fr)
        : await cleanChunk(llm, s.body_fr);
      tIn += out.tokens.input;
      tOut += out.tokens.output;
      const label = `section[${s.anchor ?? s.key ?? s.title_fr ?? '?'}].body_fr`;
      if (out.ok && !out.emptied) {
        newSections.push({ ...s, body_fr: out.cleaned });
        changes.push({ where: label, before: s.body_fr, after: out.cleaned, emptied: false });
        continue;
      }
      if (out.ok && out.emptied) {
        emptied += 1;
        changes.push({ where: label, before: s.body_fr, after: '', emptied: true });
        // Keep the original — emptied sections are surfaced for manual review,
        // never silently dropped (structural change needs human sign-off).
        newSections.push(s);
        continue;
      }
      if (!out.ok) {
        failures += 1;
        changes.push({
          where: label,
          before: s.body_fr,
          after: s.body_fr,
          emptied: false,
          failed: true,
          failedReason: out.reason,
        });
      }
    }
    newSections.push(s);
  }

  const signatures = Array.isArray(row.signature_experiences) ? [...row.signature_experiences] : [];
  const newSignatures: Signature[] = [];
  for (const sig of signatures) {
    if (
      sig &&
      typeof sig === 'object' &&
      typeof sig.summary_fr === 'string' &&
      hasLeak(sig.summary_fr)
    ) {
      const out = await cleanChunk(llm, sig.summary_fr);
      tIn += out.tokens.input;
      tOut += out.tokens.output;
      const label = `signature[${sig.name ?? '?'}].summary_fr`;
      if (out.ok && !out.emptied) {
        newSignatures.push({ ...sig, summary_fr: out.cleaned });
        changes.push({ where: label, before: sig.summary_fr, after: out.cleaned, emptied: false });
        continue;
      }
      if (out.ok && out.emptied) {
        emptied += 1;
        changes.push({ where: label, before: sig.summary_fr, after: '', emptied: true });
        newSignatures.push(sig);
        continue;
      }
      if (!out.ok) {
        failures += 1;
        changes.push({
          where: label,
          before: sig.summary_fr,
          after: sig.summary_fr,
          emptied: false,
          failed: true,
          failedReason: out.reason,
        });
      }
    }
    newSignatures.push(sig);
  }

  const cleanedChunks = changes.filter((c) => !c.emptied && c.failed !== true).length;
  let status: FicheResult['status'];
  if (changes.length === 0) status = 'skipped';
  else if (emptied > 0 && cleanedChunks === 0) status = 'review';
  else if (failures > 0) status = 'partial';
  else status = 'cleaned';

  return {
    slug: row.slug,
    id: row.id,
    status,
    changes,
    emptiedChunks: emptied,
    failures,
    tokens: { input: tIn, output: tOut },
    newDescription,
    newSections: sections.length > 0 ? newSections : null,
    newSignatures: signatures.length > 0 ? newSignatures : null,
    ...(emptied > 0
      ? { reason: `${emptied} chunk(s) became pure-scaffolding → manual review` }
      : {}),
  };
}

async function persist(cfg: SupabaseRestConfig, r: FicheResult): Promise<void> {
  const patch: Record<string, unknown> = {
    description_fr: r.newDescription,
    updated_at: new Date().toISOString(),
  };
  if (r.newSections !== null) patch['long_description_sections'] = r.newSections;
  if (r.newSignatures !== null) patch['signature_experiences'] = r.newSignatures;
  const res = await fetch(`${cfg.url}/rest/v1/hotels?id=eq.${r.id}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`[descaffold] PATCH failed (${res.status}): ${await res.text()}`);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

async function runWithConcurrency<T>(
  items: readonly HotelRow[],
  concurrency: number,
  worker: (row: HotelRow) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await worker(items[i]!);
      }
    }),
  );
  return results;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supaEnv = SupabaseEnvSchema.parse(process.env);
  const cfg: SupabaseRestConfig = {
    url: supaEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: supaEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  const env = loadEnv();
  const provider = resolveProvider(env);
  // Default to the FLAGSHIP model: de-scaffolding must distinguish "fact woven
  // into a hedge" (keep, reworded) from "pure hedge" (drop). The mechanical
  // tier over-deletes legitimate facts (EEAT regression), so the cheap model
  // is opt-in only via --mini (use for low-stakes bulk experiments).
  const llmEnv =
    provider === 'openai' && args.mini
      ? { ...env, EDITORIAL_PILOT_OPENAI_MODEL: env.EDITORIAL_PILOT_OPENAI_MODEL_MECHANICAL }
      : env;
  const llm = buildLlmClient(llmEnv, provider) as LlmClient;

  const candidates = await fetchCandidates(cfg, args);
  console.log(
    `[descaffold] ${candidates.length} candidate fiche(s) — model ${llm.model}, concurrency ${args.concurrency}, dryRun=${args.dryRun}\n`,
  );
  if (candidates.length === 0) {
    return;
  }

  const t0 = Date.now();
  const results = await runWithConcurrency(candidates, args.concurrency, async (row) => {
    try {
      const r = await processFiche(llm, row);
      console.log(
        `  [${r.status.toUpperCase()}] ${r.slug} — ${r.changes.filter((c) => !c.emptied && c.failed !== true).length} cleaned, ${r.emptiedChunks} emptied, ${r.failures} failed (${r.tokens.input}+${r.tokens.output}t)`,
      );
      if (!args.dryRun && (r.status === 'cleaned' || r.status === 'partial')) {
        await persist(cfg, r);
      }
      return r;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  [FAILED] ${row.slug} — ${reason}`);
      return {
        slug: row.slug,
        id: row.id,
        status: 'partial' as const,
        changes: [],
        emptiedChunks: 0,
        failures: 1,
        tokens: { input: 0, output: 0 },
        newDescription: row.description_fr,
        newSections: null,
        newSignatures: null,
        reason,
      } satisfies FicheResult;
    }
  });

  // Before/after preview (dry-run or --show).
  if (args.dryRun || args.show) {
    const withChanges = results.filter((r) => r.changes.length > 0);
    const preview = withChanges.slice(0, args.show ? withChanges.length : 10);
    console.log(`\n──────── BEFORE / AFTER (${preview.length} fiche(s)) ────────`);
    for (const r of preview) {
      console.log(`\n### ${r.slug}  [${r.status}]`);
      for (const c of r.changes) {
        const cap = args.show ? 100000 : 320;
        const tag =
          c.failed === true
            ? `  ✗ FAILED GATE → kept as-is (${c.failedReason ?? '?'})`
            : c.emptied
              ? '  ⚠ PURE SCAFFOLDING → review (kept as-is)'
              : '';
        console.log(`\n• ${c.where}${tag}`);
        console.log(`  BEFORE: ${truncate(c.before, cap)}`);
        console.log(
          `  AFTER : ${c.emptied ? '(empty — flagged)' : c.failed === true ? '(unchanged — failed gate)' : truncate(c.after, cap)}`,
        );
      }
    }
  }

  const tIn = results.reduce((s, r) => s + r.tokens.input, 0);
  const tOut = results.reduce((s, r) => s + r.tokens.output, 0);
  const by = (st: FicheResult['status']) => results.filter((r) => r.status === st).length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n──────── SUMMARY ────────`);
  console.log(
    `  cleaned=${by('cleaned')}  partial=${by('partial')}  review=${by('review')}  skipped=${by('skipped')}`,
  );
  console.log(
    `  tokens: ${tIn} in + ${tOut} out · ${elapsed}s${args.dryRun ? '  (DRY RUN — no write)' : ''}`,
  );
}

main().catch((err) => {
  console.error('[descaffold] FATAL', err);
  process.exit(1);
});
