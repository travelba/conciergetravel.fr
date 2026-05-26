---
name: llm-output-robustness
description: Engineering rules for robust LLM-generated JSON in MyConciergeHotel.com — multi-call single-concern pipelines, Zod schema design for LLM drift, allowlist post-validation, retry strategy, concurrency. Use when designing or modifying any LLM pipeline that produces structured output (editorial guides, rankings, hotel fiches, AEO blocks).
---

# LLM output robustness — MyConciergeHotel.com

The editorial pipelines (`scripts/editorial-pilot/src/guides/*-v2.ts`, `scripts/editorial-pilot/src/rankings/*-v2.ts`) generate ≥ 3 500-word JSON payloads from GPT-4o. Naive single-prompt designs fail in production with truncation, enum drift, and hallucinated entities. This skill encodes the patterns that get the pipelines from 30 % success rate to ≥ 95 %.

## Triggers

Invoke when:

- Designing or refactoring any LLM pipeline that returns structured JSON.
- Adding a new LLM-generated field to an editorial collection (guide, ranking, hotel, FAQ, ranking entry, callout).
- Debugging Zod `schema-fail` errors from `callLlm`.
- Adding a new "list-of-things" output where the LLM must produce ≥ N items.
- Integrating a new GPT/Claude/Mistral provider.

## Rule 1 — One prompt, one concern

GPT-4o silently truncates large multi-faceted JSON outputs to stay within an internal budget. The fix is architectural, not promptable.

**Decompose the work into single-concern calls:**

```
Call M (Meta)        → summary + meta + plan of section TITLES (no body)
Calls S₁..Sₙ (parallel, concurrency 4) → ONE call per section, body only
Call B (Blocks)      → tables + glossary + callouts
Call F (FAQ)         → all FAQ pairs
Call X (Sources)     → external_sources (post-validated against allowlist)
```

A pipeline that previously asked for "12 sections × 500 words + 6 tables + 25 FAQ + 8 sources" in one go now runs 16 parallel-or-sequential calls, each producing one part. Total wall-time decreases (parallelism) and success rate jumps to ≥ 95 %.

**Reference implementation:** `scripts/editorial-pilot/src/guides/generate-guide-v2.ts` (look at `generateGuideV2` orchestration).

## Rule 2 — Sequential batches when items depend on previous items

For ordered outputs where each item must avoid duplicates from previous items (e.g. ranked hotel entries), use **sequential batches**, not full parallelism:

```ts
const BATCH = 4;
const all: Entry[] = [];
for (let i = 0; i < target.length; i += BATCH) {
  const slice = target.slice(i, i + BATCH);
  const previouslyPicked = all.map((e) => e.hotel_slug);
  const batch = await callLlm(client, SYSTEM, buildPrompt(slice, previouslyPicked), Schema);
  all.push(...batch.entries);
}
```

Each batch sees the slugs already picked → zero duplicate ranking entries.

**Reference:** `scripts/editorial-pilot/src/rankings/generate-ranking-v2.ts` `generateEntries()`.

## Rule 3 — Zod schemas designed for LLM drift

LLMs occasionally produce synonyms, slightly fewer items than the prompt asked, or omit optional fields. Bake tolerance into the schema:

### 3a. `z.preprocess` + alias maps for enums

```ts
const SECTION_TYPES = ['intro', 'history', 'when_to_visit', 'gastronomy', 'practical'] as const;

const SectionSchema = z.object({
  type: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const alias: Record<string, string> = {
      overview: 'intro',
      introduction: 'intro',
      when_to_go: 'when_to_visit',
      best_time: 'when_to_visit',
      food: 'gastronomy',
      cuisine: 'gastronomy',
    };
    return alias[v] ?? v;
  }, z.enum(SECTION_TYPES)),
  title_fr: z.string().min(3),
});
```

LLMs _will_ output `overview`, `food`, `cuisine` even when the prompt says `intro`, `gastronomy`. Map them in `preprocess`, don't fight them in the prompt.

### 3b. Generous `min/max` headroom on arrays

```ts
// Prompt asks for "10-12 sections".
section_plan: z.array(PlanSchema).min(8).max(14),

// Prompt asks for "exactly 6 tables".
tables: z.array(TableSchema).min(4).max(8),

// Prompt asks for "≥ 4 rows".
rows: z.array(...).min(1).max(20),  // tolerate single-row tables
```

A hard `min(6)` on a "produce exactly 6 tables" prompt fails ~10 % of the time. `min(4)` makes the entire pipeline 10× more reliable. Adjust the **prompt** to ask for the high end, the **schema** to accept the low end.

### 3c. Optional English fields — use the `EnString` helper, NEVER `.min(N).optional().default('')`

**CRITICAL Zod gotcha:** `z.string().min(N).optional().default('')` does **not** bypass `.min(N)`. The `.default('')` produces an empty string, which is then validated against `.min(N)` and rejected. The whole schema fails on _every_ guide where the LLM omits the EN field. This caused a 2026-05-18 regression where 8 of 16 destination guides failed Call M with errors like `summary_en: String must contain at least 40 character(s)`.

**Reusable helper — put it at the top of the schema file:**

```ts
// EN strings are intentionally lenient — the dedicated I18N pipeline
// (translate-hotels-en.ts pattern) re-translates EVERY guide FR → EN
// downstream, so we accept empty or short LLM output here.
const EnString = (maxLen: number) =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'string') return v;
    return v;
  }, z.string().max(maxLen).default(''));

const SectionSchema = z.object({
  title_fr: z.string().min(4).max(180),
  title_en: EnString(180), // ← accepts '', null, undefined, missing
  body_fr: z.string().min(350),
  body_en: EnString(8000),
});
```

The front-end falls back to the FR variant when EN is empty. The dedicated I18N pipeline backfills the EN content in a separate pass with full validation.

**Reference:** [`scripts/editorial-pilot/src/guides/generate-guide-v2.ts`](mdc:scripts/editorial-pilot/src/guides/generate-guide-v2.ts) (search for `EnString`).

### 3c-bis. URLs from LLM — preprocess empty / non-URL to undefined

LLMs emit `""` or `"TBD"` for missing URLs. `z.string().url().optional()` rejects empty strings (they're "present but invalid"). Preprocess:

```ts
url: z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (t.length === 0) return undefined;
    if (!/^https?:\/\//iu.test(t)) return undefined;
    return t;
  },
  z.string().url().optional().nullable(),
),
```

Real regression (2026-05-18): without this, `HighlightSchema.url` failed 50 % of guides because LLM emitted `url: ""` for highlights that don't have a canonical Wikipedia page.

### 3d. `nullish()` for soft optional anchors

```ts
section_anchor: z.string().nullish(),  // null | undefined | string
```

`nullish()` covers both `null` (Supabase JSON) and `undefined` (LLM omission).

### 3e. `z.preprocess` for optional enum where LLM emits `null`

`z.enum([...]).optional()` accepts the value or `undefined` — but the
LLM regularly emits an explicit `null`, which fails. Don't switch to
`.nullable().optional()` (that pollutes downstream type narrowing); use
a preprocess that coerces `null` and any out-of-range string to
`undefined`:

```ts
align: z.preprocess(
  (v) => {
    if (v === null) return undefined;
    if (typeof v === 'string' && ['left', 'right', 'center'].includes(v)) return v;
    return undefined;
  },
  z.enum(['left', 'right', 'center']).optional(),
);
```

Real-world example: `TableHeaderSchema.align` in
[`scripts/editorial-pilot/src/rankings/generate-ranking-v2.ts`](mdc:scripts/editorial-pilot/src/rankings/generate-ranking-v2.ts).
Without the preprocess, `gpt-4o` failed ~3 % of `call-B` rankings with
`align: Expected 'left' | 'right' | 'center', received null`.

### 3f. Lenient `min` floors paired with post-validation drop

When a "minimum length" field (e.g. glossary `definition_fr.min(40)`)
fails the pipeline once a single entry clocks in below the floor, the
fix is **not** to drop the floor — quality matters. Instead:

1. Lower the schema `min` aggressively (40 → 20).
2. Add a post-validator that **drops** entries below the editorial
   floor and logs a warning.

```ts
function postValidateRichBlocks(callB, slug) {
  const FLOOR = 40;
  const filtered = callB.glossary.filter((g) => g.definition_fr.trim().length >= FLOOR);
  const dropped = callB.glossary.length - filtered.length;
  if (dropped > 0) console.warn(`  ⚠ [${slug}] dropped ${dropped} glossary entries`);
  return { ...callB, glossary: filtered };
}
```

Net effect: the run no longer fails because of a single 35-char
definition; the published page still respects the editorial floor; the
runlog flags the drop for human review.

## Rule 4 — Allowlist post-validation, not prompt-only

Prompt instructions like _"only cite Wikipedia, Atout France, UNESCO, Michelin"_ fail ~30 % of the time. The LLM cites a press article, an aggregator, or a hallucinated URL. **Always post-validate**:

```ts
// scripts/editorial-pilot/src/guides/external-sources-allowlist.ts
export const ALLOWLIST: readonly AllowlistEntry[] = [
  { suffix: 'wikipedia.org', type: 'wikipedia' },
  { suffix: 'atout-france.fr', type: 'atout_france' },
  { suffix: 'whc.unesco.org', type: 'unesco' },
  { suffix: 'guide.michelin.com', type: 'michelin' },
  // …
];

export function matchAllowlist(url: string): AllowlistEntry | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWLIST.find((e) => host.endsWith(e.suffix)) ?? null;
  } catch {
    return null;
  }
}

function postValidateSources(raw: ExternalSource[]): ExternalSource[] {
  return raw
    .map((s) => ({ ...s, _match: matchAllowlist(s.url) }))
    .filter((s) => s._match !== null)
    .map(({ _match, ...rest }) => ({ ...rest, type: _match!.type }));
}
```

The schema accepts a `string` for `type`; the post-validator overwrites it with the _canonical_ type from the allowlist. No hallucinated source ever reaches the DB.

## Rule 5 — Re-validate referenced IDs against the catalog

For rankings, the LLM must pick from a known list of hotel slugs. It will occasionally hallucinate one. Re-validate:

```ts
function postValidateEntries(raw: Entry[], catalog: ReadonlyArray<HotelCatalogRow>): Entry[] {
  const valid = new Set(catalog.map((h) => h.slug));
  return raw.filter((e) => valid.has(e.hotel_slug)).map((e, i) => ({ ...e, rank: i + 1 })); // re-rank after filtering
}
```

## Rule 6 — Continue-on-failure at the runner level

A multi-target runner (e.g. "regenerate 11 guides") must never abort the whole batch because one item failed:

```ts
let ok = 0,
  fail = 0;
for (const target of targets) {
  try {
    await runOne(target);
    ok += 1;
  } catch (err) {
    fail += 1;
    console.error(`[${target.slug}] ✗ ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log(`Done — ${ok} OK / ${fail} failed.`);
```

The failed ones get retried separately after a schema tweak.

## Rule 7 — Concurrency with explicit cap

Use a `runWithConcurrency` helper, never `Promise.all` for `N > 6` items:

```ts
async function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: concurrency }).map(async () => {
      while (idx < items.length) {
        const i = idx++;
        results[i] = await fn(items[i]!);
      }
    }),
  );
  return results;
}
```

Default cap: **4** for OpenAI tier 1 (avoids 429 rate limits at ~10 k TPM gpt-4o).

## Rule 8 — `callLlm` with typed generic + JSON mode + auto-retry

The basic shape:

```ts
async function callLlm<S extends z.ZodTypeAny>(
  client: OpenAI,
  system: string,
  user: string,
  schema: S,
  tag: string,
): Promise<z.infer<S>> {
  // ... single attempt with safeParse → throw on schema-fail
}
```

The `<S extends z.ZodTypeAny>` generic gives perfect type inference at call sites. The `tag` prefix in errors makes log triage trivial (`[v2 paris call-B] schema-fail: tables.1.rows: …`).

### Rule 8a — Single-shot retry with schema-error feedback

In long pipelines (16-call guide generator, 7-pass editorial pipeline)
a single LLM hiccup throws away the whole sibling work. **Add one
in-loop retry that surfaces the Zod issues as feedback** before giving
up. This rescued ≥ 80 % of our v6 guide failures (`align: boolean`,
missing optional `_en` fields, null where enum expected) without
manual intervention:

```ts
async function callLlm<S extends z.ZodTypeAny>(
  client: LlmClient,
  sys: string,
  user: string,
  schema: S,
  tag: string,
): Promise<z.infer<S>> {
  const a1 = await callLlmOnce(client, sys, user, schema, tag, 0.55);
  if (a1.ok) return a1.data;

  const issuesText = a1.issues
    .slice(0, 25)
    .map((i) => `- ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  const retryPrompt = [
    user,
    '',
    '---',
    'TENTATIVE PRÉCÉDENTE INVALIDE — corrige STRICTEMENT ces erreurs Zod :',
    issuesText,
    '',
    'Règles de récupération :',
    '- `align` ∈ {"left","right","center"} ou absent. Jamais booléen/nombre.',
    '- Champs `_en` acceptent "" ou la traduction.',
    '- Champs `url` doivent être absents ou https://… valides.',
    '- Aucun champ enum ne peut être null — omets-le.',
    '- Retourne UNIQUEMENT le JSON corrigé.',
  ].join('\n');
  // 2nd attempt at lower temperature (more obedient).
  const a2 = await callLlmOnce(client, sys, retryPrompt, schema, tag, 0.2);
  if (a2.ok) return a2.data;

  const issues = a2.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`[${tag}] schema-fail after retry:\n${issues}`);
}
```

Two crucial subtleties:

- The retry prompt **echoes the original user prompt verbatim** before
  appending the issue list. The LLM otherwise loses all context and
  generates a stub.
- The retry temperature drops to `0.2`. A "be obedient" hint via
  temperature is more effective than another paragraph of rules.

Reference implementation:
`scripts/editorial-pilot/src/guides/generate-guide-v2.ts`
(`callLlm` + `callLlmOnce`). Use it any time you have a multi-call
pipeline where one schema-fail wastes meaningful budget.

### Rule 8b — Don't retry on non-JSON output

If `JSON.parse` fails on the model output, retrying rarely helps —
the model is in a different failure mode (truncation, refusal, prose
preamble). Surface the first 300 chars in the error and fail fast.
Retries are reserved for `safeParse` failures only.

## Rule 9 — Extraction is a different job (temperature 0, gpt-4o-mini)

Generation (4 000-word prose) and **extraction** (typed facts from web
markdown) are different LLM tasks. Use a separate code path:

| Concern            | Generation                  | Extraction                                     |
| ------------------ | --------------------------- | ---------------------------------------------- |
| Model              | `gpt-4o`                    | `gpt-4o-mini` (~10× cheaper)                   |
| Temperature        | `0.4` (creative variation)  | `0` (deterministic)                            |
| max_tokens         | up to 4 000                 | 1 500-2 000                                    |
| Prompt             | "Produce 500 words about X" | "Extract fields F, G from SOURCE_CONTENT"      |
| Anti-hallucination | Allowlist + post-validation | `evidence_quote` + "return null if not stated" |
| Failure mode       | Truncation, enum drift      | Wrong number, fabricated name                  |

Use the shared helper `llmExtract<Schema>` for any structured extraction
from Tavily markdown — see
[`content-enrichment-pipeline`](../content-enrichment-pipeline/SKILL.md).

The extraction system prompt MUST include:

```
1. Extract ONLY information explicitly stated in SOURCE_CONTENT.
2. If a field is not literally present → return null (never guess, never combine sources).
3. Numbers verbatim ("200+ rooms" → null because approximate).
4. For each non-null field, include the verbatim source phrase in an
   `evidence_quote` sibling when the schema asks for one.
```

## Rule 10 — `AUTO_DRAFT` sentinels for missing factual inputs

When the enrichment pipeline cannot fill a field, write the literal
string `'AUTO_DRAFT'` — never empty string, never invented placeholder.
The generation pipeline's prompts are taught to detect sentinels and:

- Skip the dependent sentence/section if too central.
- Use a generic phrasing ("informations à confirmer") if optional.
- Flag the output for fact-check pass review.

This pairs with the "evidence quote" extraction rule (Rule 9): every
fact reaches the generation LLM either with a verbatim source quote
**or** as a sentinel — the LLM is never asked to invent.

## Rule 11 — Pilot → validate → scale workflow

Never batch-generate before validating on a small pilot. The cost of
a corrupted scale run is ~50× the cost of a 3-item pilot.

```
1. Pilot — generate 3 items with `--slug=a,b,c` (PowerShell: quote the arg)
2. Inspect — open the page in dev, run `scripts/.../inspect-*.ts <slug>`
3. Audit — word counts, section coverage, allowlist matches, dead links
4. Iterate — relax schema mins, add z.preprocess aliases, fix prompts
5. Scale — run on full list with `runWithConcurrency` (cap 4)
6. Re-audit — re-run inspect on a random 10 % sample
```

Reference: `scripts/editorial-pilot/src/guides/{run-guides-v2,audit-v2-status,inspect-guide}.ts`.

Always run the runner with **continue-on-failure** (Rule 6) so a partial
scale run still leaves successfully-generated content in place.

## Rule 12-bis — Detect `finish_reason === 'length'` (silent truncation)

OpenAI returns `finish_reason: 'length'` when the model hit `max_tokens`
before completing the JSON. Without an explicit check, the truncated
JSON reaches `JSON.parse` → "Unexpected end of JSON input" → null
returned by `llmExtract` → silent data loss.

**Always add the check inside the extraction helper:**

```ts
const choice = response.choices[0];
if (!choice || !choice.message.content) return null;

if (choice.finish_reason === 'length') {
  console.warn(
    `[llm-extract] OUTPUT TRUNCATED (finish_reason=length) for context="${opts.context}". ` +
      `Bump maxOutputTokens above ${opts.maxOutputTokens ?? 2000}.`,
  );
  return null; // surface as a clear warning, never as a parse error
}

let json: unknown;
try {
  json = JSON.parse(choice.message.content);
} catch {
  console.warn(`[llm-extract] JSON parse failed for context="${opts.context}"`);
  return null;
}
```

**Sizing rule of thumb** (gpt-4o-mini, JSON-only output):

- 1 hotel entry with name+city+country+rank ≈ 60 chars JSON ≈ 18 tokens.
- 100 hotels list ≈ 1 800 tokens, but add 30 % overhead for braces +
  quotes + repeated field names → ≈ 2 400 tokens minimum.
- Default `max_tokens: 2000` is **too small** for any list extraction
  ≥ 50 items. Bump to 8 000 for "extract every hotel on this page"
  scenarios, 16 000 for "the entire 100-best ranking".

**Real regression (2026-05-19)**: T+L Top-100 hotels page returned only
10 entries because `max_tokens: 2000` truncated the JSON. Adding the
`finish_reason` check + raising to `maxOutputTokens: 16000` recovered
98 entries on the next run. CN Gold List and W50 (138 entries) followed
the same pattern.

**Reference**: `scripts/editorial-pilot/src/enrichment/llm-extract.ts`
(`maxOutputTokens` option, `finish_reason` check).

## Rule 12-ter — Anchor-trim huge web pages before LLM extraction

Editorial sites (Travel + Leisure, Condé Nast, NYT) prepend 25-40 k
chars of navigation, cookie banners, search forms, and "trending"
sidebars before the actual content. A 90 k-char Tavily extract therefore
contains < 60 k chars of useful body — the LLM either spends tokens on
junk or misses the list entirely.

**Pattern: define source-specific anchor strings + slice from the first
matching anchor:**

```ts
interface SourceConfig {
  readonly urls: readonly string[];
  /** First-occurrence anchors used to skip the prelude. */
  readonly anchors?: readonly string[];
}

// At extraction time:
let start = 0;
if (source.anchors) {
  for (const a of source.anchors) {
    const idx = content.indexOf(a);
    if (idx >= 0) {
      start = Math.max(0, idx - 200);
      break;
    }
  }
}
const trimmed = content.slice(start, start + 90_000);
```

Pick anchors that are **specific to the data section** (the first hotel
name, a numbered "1. " marker, or a section heading). Always keep a 200-
char lead so the LLM sees a bit of context before the list starts.

**Real regression (2026-05-19)**: T+L `worlds-best-awards-2025-top-100`
had "andBeyond Bateleur Camp" at offset 34 430. Without anchor-trim,
the default `slice(0, 36000)` left only 1 500 chars of actual list →
LLM saw 10 hotels, not 100.

## Rule 12-quater — Tavily can't render JS-only pages: keep editorial fallbacks

Some flagship sources (e.g. `theworlds50besthotels.com`) ship a
client-side-only rendering. Even `extract_depth: 'advanced'` returns
nothing but the navigation skeleton. Don't burn credits retrying.

**Pattern: declare 1-2 known-good third-party article URLs as
fallbacks for each award/list source:**

```ts
{
  key: 'w50',
  urls: [
    // Canonical (works as of 2026-05)
    'https://www.theworlds50best.com/hotels/list/1-50',
    'https://www.theworlds50best.com/hotels/list/51-100',
    // Editorial fallbacks — same data, plain HTML
    'https://thedotmagazine.com/the-worlds-50-best-hotels-2025-announced-...',
    'https://theluxurytravelexpert.com/the-worlds-50-best-hotels-list/',
    'https://robbreport.com/travel/hotels/lists/50-best-hotels-1236896449/',
  ],
}
```

The dedupe pass (Rule 4: post-validation) merges overlapping mentions
into one entity per key. Net win: zero data loss when the canonical site
breaks, no manual intervention needed.

### Sub-rule 12-quater-bis — Next.js SSR sites: `basic` fails, `advanced` works

Not every JS-rendered site is fatal to Tavily. Many modern Next.js sites
(R&C `relaischateaux.com`, several luxury hotel chains) ship a hybrid
SSR + hydration where:

- `extract_depth: 'basic'` → ~10 % success rate (intermittent: works for
  some pages, returns "Failed to fetch url" for others — depends on
  whether Tavily catches the SSR HTML before the JS hydrates).
- `extract_depth: 'advanced'` → ~99 % success rate (waits for hydration).

**Real regression (2026-05-25)**: extracting 476 R&C hotel pages with
`basic` → 280/300 (~93 %) failed. Switched to `advanced` → 474/476
(~99.6 %) succeeded. Cost difference: 2× credits (~$5 vs $2.40 on the
full run), tiny price for going from 6 % completion to 100 %.

**Anti-pattern** (cost optimisation gone wrong): "default to basic, let
the failed ones retry on advanced." This requires a second pass that
adds latency AND if the first pass burned through your daily quota,
the second pass is delayed by 24 h. Better to pick the right depth
up-front based on whether the target uses SPA hydration.

**Diagnostic shortcut**: if the homepage view-source is < 1 KB and
contains only a `<div id="__next"></div>` style root, default to
`advanced` immediately.

### Sub-rule 12-quater-ter — Vendor catalogues: sitemap is the source of truth

For any vendor catalogue (R&C members, Atout France palaces, Yonder
listings, etc.), the **canonical XML sitemap is more complete than any
"directory" listing page**. Reasons:

- Directory pages frequently lazy-load (R&C destination pages show
  ~10 cards before requiring a "Load more" click — Tavily captures 0).
- Sitemaps are designed for search engines, so they enumerate every
  indexable URL by definition.
- Sitemaps include the full `<lastmod>` timestamp → free freshness
  signal for incremental refresh.

**Recipe**:

```ts
// Step 1: fetch robots.txt → find Sitemap: line(s)
// Step 2: fetch sitemap.xml → parse <url><loc>...</loc></url>
// Step 3: filter URLs by pattern (e.g. /fr/hotel/<slug>)
// Step 4: Tavily-extract each filtered URL individually
// Step 5: LLM-extract per page → aggregate → diff vs internal catalogue
```

**Real win (2026-05-25)**: R&C destination listing pages exposed only
~115 URL slugs to Tavily via lazy-loaded cards. The sitemap exposed
476 hotel URLs. 4× more coverage, same Tavily cost.

See `scripts/editorial-pilot/src/global-sources/parse-rc-sitemap.ts`
for the reference implementation.

## Rule 12-quinquies — `gpt-4o-mini` invents enum values: relax + map

`gpt-4o-mini` constantly hallucinates "obviously correct" enum values
that aren't in the schema:

- `luxury_tier`: invents `ritz_carlton`, `kempinski`, `hilton`,
  `design_hotels`, `como`, `six_senses`, `waldorf_astoria`, `hyatt`,
  `bulgari`, `edition`, `one_only`, `oneandonly`, `anantara`, `raffles`,
  `peninsula`, `dorchester`.
- `section.type`: invents `overview`, `food`, `cuisine`, `when_to_go`.
- `country_code`: invents 3-letter ISO codes (`USA`, `GBR`) when the
  schema asks for alpha-2.

**Pattern: schema relaxes to `z.string()`, post-validation maps to
allowlist (Rule 4 generalised):**

```ts
const LUXURY_TIER_VALUES = ['aman', 'belmond', 'four_seasons' /* … */] as const;

const HotelMention = z.object({
  name: z.string().min(2),
  luxury_tier: z.string().nullable(), // ← relaxed
});

const TIER_SET = new Set<string>(LUXURY_TIER_VALUES);

function normaliseLuxuryTier(raw: string | null): (typeof LUXURY_TIER_VALUES)[number] | null {
  if (!raw) return null;
  const lc = raw.toLowerCase().trim();
  if (TIER_SET.has(lc)) return lc as (typeof LUXURY_TIER_VALUES)[number];
  const map: Record<string, (typeof LUXURY_TIER_VALUES)[number]> = {
    ritz_carlton: 'ritz_carlton_reserve',
    hyatt: 'park_hyatt',
    waldorf_astoria: 'lhw_member',
    six_senses: 'lhw_member',
    como: 'lhw_member',
    /* … */
  };
  return map[lc] ?? null; // lose the tier signal, never the hotel
}
```

**Real regression (2026-05-19)**: `extract-yonder-intl.ts` initially
used `z.enum(LUXURY_TIER_VALUES)` and rejected ~15 % of pages with
`Invalid enum value... received 'ritz_carlton'`. Relaxing to `z.string()`

- post-mapping recovered 74 additional hotels (382 → 456).

**Reference**: `scripts/editorial-pilot/src/yonder/extract-yonder-intl.ts`
(`HotelMention`, `LUXURY_TIER_SET`, `normaliseLuxuryTier`).

## Rule 13 — Never inline ≥ 10 KB of opaque content in an MCP tool call

The agent loop (Cursor / Claude / Codex) constructs tool-call args by
generating tokens. For natural-language content, regenerate-from-context
is reliable. For opaque payloads — base64, JWTs, large SQL with embedded
JSONB literals — the model **silently** drifts: it skips repetitive
sections, substitutes "obvious" simplifications, or hallucinates a
shorter variant.

**Real regression (2026-05-24)**: the agent had to apply 19 editorial
itinerary seeds (each ~25-33 KB of SQL with embedded JSONB strings) to
Supabase via the MCP `execute_sql` tool. On the very first sanity-check
call (the smallest file, reims, 23 KB), the agent silently substituted
`'[]'::jsonb` placeholders for the actual `sections` and `faq_content`
JSONB literals and converted the `do update set ...` upsert into a
`do nothing`. The corruption only surfaced because a verification
query showed `n_sections=0, n_faq=0` on a freshly-applied draft.

**Fix**: don't transport large opaque content through MCP args. Instead:

1. Push the content to git, then have the database fetch it back via
   `pg_net.http_get('https://raw.githubusercontent.com/<owner>/<repo>/main/<path>')`
   and apply it server-side. Each MCP call becomes ~150 chars (just the
   URL or slug), no drift possible. See `supabase-postgres-rls/SKILL.md`
   §"Async HTTP from Postgres" for the pg_net workflow gotchas.
2. Or run a Node script (`apply-seeds.ts`) outside the agent loop —
   it reads files from disk and POSTs to a server-side RPC with the
   service role key. No regenerate-from-context step.
3. Or, if you absolutely must inline, send ≤ 5 KB per call and verify
   each fragment against a known hash before EXECUTE.

The fact that base64 looks "boring enough" for the model to reproduce
is exactly what makes the failure mode silent: a corrupted INSERT
runs, persists, and looks plausible at first glance.

**Rule of thumb**: any tool-call arg > ~10 KB should be treated as
suspect. Verify post-execution invariants (row counts, length of
JSONB arrays, hash of the inserted content) on the FIRST item of a
batch before running the rest.

## Rule 12 — Word-count gates as warnings, not blockers

The generation pipeline computes word counts and warns under thresholds
(3 500 for guides/rankings, 600-1000 for hotel long descriptions). It
NEVER auto-truncates or auto-extends. Under-target → human re-runs
with a different prompt seed, or the runner is invoked with a higher
`maxSectionWords` target.

```ts
const total = words(body) + words(highlights) + words(faq);
if (total < 3500) console.warn(`${tag} ⚠ total ${total} < 3500 — consider re-running.`);
```

The rule prevents the worst pathology: a pipeline silently producing
1 200-word "long-reads" because a single section truncated.

## Rule 14 — Audit metric must mirror the production validator, not the CDC ideal

Every editorial field has two thresholds:

1. **Production envelope** — the `z.string().min(N).max(M)` baked into
   the generator's Zod schema. This is what gates publish. Example:
   `FACTUAL_SUMMARY_MIN_CHARS = 110` / `MAX = 165` in
   `scripts/editorial-pilot/src/hotels/factual-summary-generator.ts`.
2. **CDC ideal** — the spec-document target band, often tighter.
   Example: CDC §2.3 says `factual_summary` should be 130-150 chars.

These coexist on purpose: the envelope is what the team accepts to
ship; the ideal is what content reviewers chase post-launch. **But the
audit metric reported to roadmap-makers (`AGENTS.md` §4bis, dashboards,
status emails) MUST use the envelope band, not the CDC ideal.**

The 2026-05-25 session learned this the hard way. `AGENTS.md` §4bis
reported a "239 hotel gap" on `factual_summary`. The pipeline run found
only **1 NULL row** to backfill — the other 238 were already inside the
production envelope (110-165) but outside the CDC ideal (130-150).
Acting on the inflated gap would have re-generated 238 already-passing
rows at a cost of ~1 M tokens (~$5) with non-trivial regression risk.

```sql
-- ✅ Good — audit query mirrors the production Zod gate
select count(*) filter (
  where is_published
    and (factual_summary_fr is null
      or length(factual_summary_fr) not between 110 and 165)
) as envelope_failures
from public.hotels;

-- ❌ Bad — audit query uses the CDC ideal, inflates the gap
select count(*) filter (
  where is_published
    and length(factual_summary_fr) not between 130 and 150
) as ideal_misses
from public.hotels;
```

**Practical rules:**

- The Zod schema in the generator is the single source of truth for the
  envelope. Audit queries import or mirror its constants.
- If the team decides the CDC ideal must become a hard rule, **tighten
  the Zod gate first**, then re-audit. Never the other way around (gap
  reports without a corresponding gate change just generate make-work).
- When reporting a gap in a PR description, status update, or AGENTS.md
  table, always state which threshold you used. Default to envelope
  unless explicitly chasing CDC compliance.

This rule applies to every editorial text field (`factual_summary`,
`meta_desc`, `description_fr`, `concierge_advice.body`, ranking intros,
guide sections, FAQ answer length).

## Rule 15 — Banned-word gates must use word boundaries, not substrings

Empirical smoke test (description-extend pipeline, 2026-05-26): the
naive substring match `output.fr.toLowerCase().includes(bannedWord)`
flagged **legitimate proper nouns** as banned superlatives. Concrete
case: `Bulle d'Osier` (the restaurant of chef Valentin Loison at
`Le Clos Vauban`) was rejected as a "banned word `bulle` detected"
on three consecutive retries — the model kept the restaurant name
because it's a verifiable fact from the JSON payload, and the gate
kept rejecting it.

Same bug existed in `meta-desc-generator.ts` and
`factual-summary-generator.ts` — both shipped with `.toLowerCase()
.includes(word)`. The hotel catalogue contains many proper nouns
that overlap with banned-superlative lists: `L'Écrin` (restaurant
at Crillon), `Le Cocon` (suite category), `Bulle d'Osier`, `La
Magique` (boutique brand).

```ts
// ❌ Bad — substring + lowercase catches proper nouns
const bannedHits = banned.filter((w) => output.fr.toLowerCase().includes(w));

// ✅ Good — word-boundary, case-sensitive for single words.
// Multi-word phrases stay case-insensitive (rarely capitalised).
const matchesBanned = (text: string, word: string): boolean => {
  if (/\s/u.test(word)) {
    return new RegExp(`\\b${escapeRegex(word)}\\b`, 'iu').test(text);
  }
  return new RegExp(`\\b${escapeRegex(word)}\\b`, 'u').test(text);
};
const bannedHits = banned.filter((w) => matchesBanned(output.fr, w));

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

Why **case-sensitive** for single words: capitalised single-word
occurrences in French long-form text are almost always proper nouns
(restaurant, suite, chef, vineyard names). Lowercase `bulle` is the
banned metaphorical use ("une bulle de luxe"); uppercase `Bulle` is
a proper noun like `Bulle d'Osier`. The sentence-start case
(`Bulle.`) is a rare false negative the editor catches by hand.

Why **case-insensitive** for multi-word phrases: phrases like
`art de vivre` or `véritable joyau` are essentially never capitalised
even at sentence start, so the `i` flag does no harm and catches
the few title-cased occurrences.

Reference impls:
`scripts/editorial-pilot/src/hotels/{description-extend,meta-desc,
factual-summary}-generator.ts` § `gateXxxFormat`.

**When adding a new banned-word gate, mandatory checklist:**

1. ☐ Word-boundary anchors (`\b…\b`).
2. ☐ Case-sensitive for single words, case-insensitive for phrases.
3. ☐ `escapeRegex` helper for words containing `.` `'` etc.
4. ☐ Echo the offending word back in the corrective suffix
   (`REMOVE "bulle"`) — empirical: the model ignores generic "no
   superlatives" instructions when the previous output contained the
   word; quoting it fires edit-mode reliably.

## Rule 16 — "Literal translation" gates must skip the proper-noun prefix

Empirical smoke test (meta-desc pipeline, 2026-05-26): a gate that
compares the **first 30 characters** of FR vs EN after diacritic
stripping rejected ~30 % of international hotels (`Las Ventanas al
Paraíso`, `Four Seasons Hotel New York Downtown`, `Madeline Hotel &
Residences`, `The Inn at Mattei's Tavern`, `Château de L'île & Spa
Strasbourg`). Hotel names are proper nouns kept verbatim across
languages — by design the first ~30-50 chars overlap.

The gate is meant to catch *literal translations of the descriptor*,
not the proper noun. The prompt enforces `[Hotel Name], [descriptor]`
format, so the comma is a natural anchor:

```ts
// ❌ Bad — proper nouns in both languages dominate the comparison
const norm = (s: string): string =>
  s.slice(0, 30)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s,.;:'"`-]/g, '');
if (norm(output.fr) === norm(output.en)) failed.push('literal translation');

// ✅ Good — compare the descriptor segment after the first comma
const descriptor = (s: string): string => {
  const commaIdx = s.indexOf(',');
  const tail = commaIdx === -1 ? s : s.slice(commaIdx + 1);
  return tail
    .slice(0, 60)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s,.;:'"`-]/g, '');
};
if (descriptor(output.fr) === descriptor(output.en) && descriptor(output.fr).length > 0) {
  failed.push('literal translation (descriptor segment matches)');
}
```

Why a wider comparison window (60 chars) on the descriptor segment:
the proper noun is gone, so we now compare 60 chars of actual
language — which is enough signal to flag calques without flagging
distinct EN restructurings that happen to share the first 30 chars
of the descriptor.

**Companion improvement — reason-aware corrective suffix.** When the
last retry was rejected for length or calque, the corrective
suffix should include a specific remediation hint:

```ts
let lengthHint = '';
if (last) {
  if (last.reason.includes('too short')) {
    lengthHint = '\nAdd ONE concrete verifiable fact (a distance, a number of rooms, a named restaurant, an award year). Do NOT pad with vague adjectives.';
  } else if (last.reason.includes('too long')) {
    lengthHint = '\nRemove one secondary clause; keep the operational fact.';
  } else if (last.reason.includes('literal translation')) {
    lengthHint = '\nThe EN looked like a calque. Restructure the EN sentence — change clause order, swap synonyms, lead with a different fact. Same content, different shape.';
  }
}
```

Empirical: switching the meta-desc gate to descriptor-segment +
`MAX_RETRIES = 5` + reason-aware hints raised the **live success
rate from 56 % to 94 %** on the international hotel batch (15/16
vs 9/16). The remaining failure was a single hotel oscillating
between 138c and 175c — flagged for manual authoring.

Reference impl: `scripts/editorial-pilot/src/hotels/meta-desc-generator.ts`
§ `gateMetaDescFormat` and § `generateMetaDesc` retry loop.

**When adding a new "literal translation" gate, mandatory checklist:**

1. ☐ Skip the proper-noun prefix (anchor on the first comma or the
   first 50 chars).
2. ☐ Compare a window ≥ 50 chars *on the descriptor*, not 30 chars
   *on the whole string*.
3. ☐ Reason-aware corrective suffix that names the failure mode
   ("too short" / "too long" / "literal translation").
4. ☐ Bump `MAX_RETRIES` to 5 when length oscillation is a known
   mode — the cost is marginal (~$0.04/hotel) and clears the
   long tail.

## Anti-patterns

- ❌ Asking one prompt for "sections + tables + FAQ + sources + glossary + callouts" → token starvation → truncation.
- ❌ Hard `z.enum([…])` without `z.preprocess` alias → ~10 % schema failures per pipeline.
- ❌ `z.array(X).min(N)` matching the prompt's exact ask → fails when LLM produces N-1.
- ❌ Allowlist enforced only in the prompt → hallucinated sources reach the DB.
- ❌ `Promise.all(items.map(call))` for > 6 items → 429 from OpenAI.
- ❌ `as Foo` to silence a schema mismatch → bypasses Zod safety, defeats the point.
- ❌ `gpt-4o` for extraction → 10× cost, no quality gain.
- ❌ Generation pipeline that retries on schema-fail without changing input → wastes credits, hits same drift.
- ❌ Empty string `''` instead of `'AUTO_DRAFT'` for missing facts → invisible in DB, no fact-check signal.
- ❌ Scaling on 100 items before piloting on 3 → 100× the cost of any mistake.
- ❌ Calling `JSON.parse(choice.message.content)` without first checking `choice.finish_reason === 'length'` → silent truncation reported as a parse error, no fix until someone reads the raw output.
- ❌ Default `max_tokens: 2000` on any list-extraction call → catastrophic truncation at ≥ 50 items (gpt-4o-mini outputs ~25 tokens per JSON entry).
- ❌ Tavily-extract on a JS-rendered single-page-app without a known third-party article fallback → silent zero-hotel runs.
- ❌ Hard `z.enum(LUXURY_TIER_VALUES)` directly on LLM output (or any open-ended brand/category enum) → 10-15 % data loss per run from invented values.
- ❌ Reporting "X rows need re-generation" against the CDC ideal band instead of the production envelope → inflates roadmap, triggers wasted token spend on rows that already pass the publish gate.
- ❌ Banned-word substring match on lowercased text (`output.toLowerCase().includes(word)`) → false positives on proper nouns (`Bulle d'Osier`, `L'Écrin`, `Le Cocon`); 3 wasted retries per affected hotel before throwing. Use word-boundary + case-sensitive (Rule 15).
- ❌ "Literal translation" gate that compares the first 30 chars of FR vs EN → rejects ~30 % of international properties whose proper noun is identical in both languages (`Four Seasons Hotel New York Downtown`, `Las Ventanas al Paraíso`). Compare the descriptor segment after the first comma (Rule 16).
- ❌ Constant `MAX_RETRIES = 3` on a pipeline where length is the dominant failure mode → the model often needs one extra round to settle inside the envelope. Bump to 5 when the marginal LLM cost (~$0.04/hotel) buys you the long tail.

## References

- CDC §4 (qualité éditoriale 3 500+ mots).
- `typescript-strict-zod-interop` skill (Zod ↔ React props).
- `geo-llm-optimization` skill (allowlist EEAT signals).
- **`editorial-rankings-matrix`** — when to use a deterministic classifier (slugs structurés) vs an LLM classifier (titres libres), `LIEU_SLUG_ALIASES` pattern.
- **`content-enrichment-pipeline`** — the multi-source brief that feeds generation.
- **`editorial-long-read-rendering`** — how the generated JSON renders.
- **`concierge-voice-pipeline`** — pass 8 (Concierge voice), bloc ConciergeAdvice, shortener phrases > 25 mots, contraintes ADR-0011.
- Reference impls: `scripts/editorial-pilot/src/guides/generate-guide-v2.ts`, `…/rankings/generate-ranking-v2.ts`, `…/enrichment/llm-extract.ts`.
