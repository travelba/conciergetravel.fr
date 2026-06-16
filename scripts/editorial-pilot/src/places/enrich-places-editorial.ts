/**
 * enrich-places-editorial.ts — LLM editorial pass for place scaffolds.
 *
 * For each unpublished place missing its factual summary, generate the
 * editorial envelope (factual summary FR/EN + short description FR/EN +
 * a Concierge tip + a starter FAQ) in the brand "voix du Concierge"
 * (EDITORIAL_VOICE.md / ADR-0011). Output is validated against a Zod
 * schema and PATCHed onto the row. The place stays `is_published=false`
 * — a human / the publish gate flips it once the envelope clears the
 * Payload validators.
 *
 * Can be run directly:
 *
 *   npx tsx src/places/enrich-places-editorial.ts --city=paris --limit=5 --dry-run
 *   npx tsx src/places/enrich-places-editorial.ts --city=paris --kind=museum --limit=20
 *
 * The runner never flips `is_published` to true.
 */
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import { lintConciergeSummary } from '../linter.js';
import { loadPhotoEnv } from '../photos/env-photos.js';

import { patchById, selectTable, type SupabaseRestConfig } from './supabase-places.js';

interface PlaceRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly kind: string;
  readonly bucket: string;
  readonly address: string | null;
  readonly source_ref: string | null;
  readonly factual_summary_fr: string | null;
}

const FaqEntrySchema = z.object({
  q_fr: z.string().min(8).max(180),
  a_fr: z.string().min(80).max(520),
  q_en: z.string().min(8).max(180),
  a_en: z.string().min(80).max(560),
});

function normalizeAdviceLocale(v: unknown): unknown {
  if (typeof v === 'string') {
    return { title: 'Le Conseil du Concierge', body: v };
  }
  return v;
}

const AdviceLocaleSchema = z.preprocess(
  normalizeAdviceLocale,
  z.object({ title: z.string().min(3).max(80), body: z.string().min(240).max(820) }),
);

const PlaceEditorialSchema = z.object({
  factual_summary_fr: z.string().min(110).max(165),
  factual_summary_en: z.string().min(110).max(180),
  description_fr: z.string().min(700).max(2800),
  description_en: z.string().min(700).max(3000),
  concierge_advice: z.object({
    fr: AdviceLocaleSchema,
    en: AdviceLocaleSchema,
  }),
  faq: z.array(FaqEntrySchema).min(6).max(10),
});

type PlaceEditorial = z.infer<typeof PlaceEditorialSchema>;

interface EnrichOptions {
  readonly limit?: number;
  readonly kind?: string;
  readonly slug?: string;
  readonly sourcePrefix?: string;
  readonly dryRun?: boolean;
}

interface CliArgs extends EnrichOptions {
  readonly city: string;
}

interface GenerationAttempt {
  readonly ok: boolean;
  readonly data?: PlaceEditorial;
  readonly issues: readonly string[];
  readonly tokens: { readonly input: number; readonly output: number };
}

const SYSTEM_PROMPT = `Tu es le Concierge de MyConciergeHotel.com.
Tu écris une fiche courte de lieu à visiter, en français et en anglais.

Posture :
- Expert complice, jamais commercial.
- Précis, sobre, utile à un client d'hôtel haut de gamme.
- Tu ne promets jamais une réservation ni une disponibilité.

Règles dures :
- Phrases courtes : aucune phrase ne dépasse 25 mots.
- Pas de superlatifs vides : incroyable, magnifique, exceptionnel, magique, sublime.
- Pas de tics : n'hésitez pas à, il est à noter que, véritable joyau, incontournable.
- N'invente pas de dates, d'horaires, de prix, d'architectes ou de collections spécifiques.
- Si tu n'as pas un fait certain, reste sur une formulation prudente et opérationnelle.
- L'anglais est réécrit naturellement, jamais traduit mot à mot.
- Le conseil EN doit être légèrement plus développé que le FR : ajoute une précision saisonnière ou une alternative concrète.

Retourne uniquement un JSON valide.`;

const OUTPUT_SHAPE = `{
  "factual_summary_fr": "une phrase de 110 à 165 caractères",
  "factual_summary_en": "one sentence, 110 to 180 characters",
  "description_fr": "150 à 230 mots, paragraphes courts",
  "description_en": "150 à 230 words, short paragraphs",
  "concierge_advice": {
    "fr": { "title": "Le Conseil du Concierge", "body": "60 à 90 mots" },
    "en": { "title": "The Concierge's Tip", "body": "60 to 90 words" }
  },
  "faq": [
    { "q_fr": "...", "a_fr": "...", "q_en": "...", "a_en": "..." }
  ]
}`;

function parseArgs(argv: readonly string[]): CliArgs {
  let city = 'paris';
  let limit: number | undefined;
  let kind: string | undefined;
  let slug: string | undefined;
  let sourcePrefix: string | undefined;
  let dryRun = false;

  for (const arg of argv) {
    if (arg.startsWith('--city=')) city = arg.slice('--city='.length);
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (arg.startsWith('--kind=')) kind = arg.slice('--kind='.length);
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length);
    else if (arg.startsWith('--source-prefix='))
      sourcePrefix = arg.slice('--source-prefix='.length);
    else if (arg === '--dry-run') dryRun = true;
  }

  return {
    city,
    dryRun,
    ...(limit !== undefined ? { limit } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(sourcePrefix !== undefined ? { sourcePrefix } : {}),
  };
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/u);
  const inner = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(inner);
  } catch {
    const first = inner.indexOf('{');
    const last = inner.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(inner.slice(first, last + 1));
    throw new Error('Place editorial response is not valid JSON.');
  }
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0).length;
}

function hasLongSentence(text: string, maxWords = 25): boolean {
  const sentences = text
    .split(/(?<=[.!?…])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.some((s) => countWords(s) > maxWords);
}

function validateEditorialEnvelope(value: PlaceEditorial): readonly string[] {
  const failures: string[] = [];
  const texts = [
    value.factual_summary_fr,
    value.factual_summary_en,
    value.description_fr,
    value.description_en,
    value.concierge_advice.fr.body,
    value.concierge_advice.en.body,
    ...value.faq.flatMap((f) => [f.a_fr, f.a_en]),
  ];
  for (const text of texts) {
    if (hasLongSentence(text)) failures.push('phrase > 25 mots');
    const lint = lintConciergeSummary(text);
    if (!lint.clean) failures.push(`linter: ${String(lint.blocker)} blocker(s)`);
  }
  const frWords = countWords(value.concierge_advice.fr.body);
  const enWords = countWords(value.concierge_advice.en.body);
  if (frWords < 50 || frWords > 110) failures.push(`concierge_advice.fr ${String(frWords)} mots`);
  if (enWords < 50 || enWords > 120) failures.push(`concierge_advice.en ${String(enWords)} mots`);
  return failures;
}

function isActivityRouteMisclassified(place: PlaceRow): boolean {
  if (place.kind === 'outdoor') return false;
  return /\b(parcours|circuit|itin[eé]raire|balade|randonn[eé]e|v[eé]lo|cyclable)\b/iu.test(
    place.name,
  );
}

function buildUserPrompt(place: PlaceRow): string {
  return JSON.stringify(
    {
      task: 'Generate the editorial envelope for this place page.',
      place: {
        name: place.name,
        city: place.city,
        kind: place.kind,
        bucket: place.bucket,
        address: place.address,
        source_ref: place.source_ref,
      },
      output_contract: {
        json_shape: OUTPUT_SHAPE,
        factual_summary_fr: '110-165 caractères. Une phrase factuelle, utile en SERP.',
        factual_summary_en: '110-180 characters. Same facts, natural English.',
        description_fr:
          '150-230 mots. 3-5 paragraphes courts. Explique pourquoi ce lieu compte et comment le visiter intelligemment.',
        description_en: '150-230 words. Natural English, same facts, no literal translation.',
        concierge_advice:
          'FR + EN. 65-90 mots chacun. Commence par un conseil opérationnel concret : horaire, accès, ordre de visite, météo ou affluence. EN doit faire au moins 55 mots.',
        faq: '6 à 8 questions/réponses bilingues. Réponses 40-80 mots. Orientées AEO : durée, accès, meilleur moment, hôtel proche, réservation, famille.',
      },
      hard_constraints: [
        'Never invent exact opening hours, ticket prices, dates, named collections, architects or Michelin/Atout France claims.',
        'If the place is obscure, be honest and operational instead of decorative.',
        'Do not publish call-to-action copy. Do not mention GetYourGuide unless a product is provided.',
        'All sentences <= 25 words.',
      ],
    },
    null,
    2,
  );
}

function buildRetryPrompt(place: PlaceRow, issues: readonly string[]): string {
  return [
    buildUserPrompt(place),
    '',
    '---',
    'TENTATIVE PRECEDENTE REFUSEE.',
    'Corrige uniquement ces problemes, sans perdre les faits ni raccourcir le conseil EN :',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Regles de recuperation :',
    '- Decoupe toute phrase longue en deux phrases courtes.',
    '- Remplace tout mot interdit par un fait concret.',
    '- Garde concierge_advice.fr et concierge_advice.en entre 65 et 90 mots.',
    '- Si factual_summary_fr depasse 165 caracteres, retire une proposition secondaire.',
    '- Retourne uniquement le JSON corrige, avec la meme forme.',
  ].join('\n');
}

function buildFixPrompt(place: PlaceRow, draft: PlaceEditorial, issues: readonly string[]): string {
  return [
    'Tu dois corriger une fiche lieu deja generee.',
    'Ne regenere pas depuis zero : conserve les faits, les questions FAQ et la structure JSON.',
    '',
    'Lieu :',
    JSON.stringify(
      {
        name: place.name,
        city: place.city,
        kind: place.kind,
        bucket: place.bucket,
        address: place.address,
      },
      null,
      2,
    ),
    '',
    'Problemes a corriger :',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Regles de correction :',
    '- Toute phrase de plus de 25 mots doit etre decoupee en deux phrases courtes.',
    '- Remplace les mots interdits par un fait ou une formulation neutre.',
    '- Ne supprime pas la substance editoriale.',
    '- Garde les summaries dans leurs limites de caracteres.',
    '- Garde les conseils FR/EN entre 65 et 90 mots.',
    '- Retourne uniquement le JSON corrige, sans markdown.',
    '',
    'JSON a corriger :',
    JSON.stringify(draft, null, 2),
  ].join('\n');
}

function validateAttemptResult(result: {
  readonly content: string;
  readonly usage: { readonly inputTokens: number; readonly outputTokens: number };
}): GenerationAttempt {
  const raw = extractJsonObject(result.content);
  const parsed = PlaceEditorialSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues
        .slice(0, 10)
        .map((i) => `schema ${i.path.join('.')}: ${i.message}`),
      tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
    };
  }
  const failures = validateEditorialEnvelope(parsed.data);
  if (failures.length > 0) {
    return {
      ok: false,
      data: parsed.data,
      issues: [...new Set(failures)],
      tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
    };
  }
  return {
    ok: true,
    data: parsed.data,
    issues: [],
    tokens: { input: result.usage.inputTokens, output: result.usage.outputTokens },
  };
}

async function generatePlaceEditorial(
  llm: LlmClient,
  provider: string,
  place: PlaceRow,
  retryIssues: readonly string[] = [],
): Promise<GenerationAttempt> {
  const result = await llm.call({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt:
      retryIssues.length > 0 ? buildRetryPrompt(place, retryIssues) : buildUserPrompt(place),
    temperature: retryIssues.length > 0 ? 0.25 : 0.45,
    maxOutputTokens: 5500,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  return validateAttemptResult(result);
}

async function fixPlaceEditorial(
  llm: LlmClient,
  provider: string,
  place: PlaceRow,
  draft: PlaceEditorial,
  issues: readonly string[],
): Promise<GenerationAttempt> {
  const result = await llm.call({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildFixPrompt(place, draft, issues),
    temperature: 0.15,
    maxOutputTokens: 5500,
    responseFormat: provider === 'openai' ? 'json' : 'text',
  });
  return validateAttemptResult(result);
}

async function applyFixPasses(
  llm: LlmClient,
  provider: string,
  place: PlaceRow,
  attempt: GenerationAttempt,
): Promise<GenerationAttempt> {
  let current = attempt;
  for (let i = 0; i < 2; i += 1) {
    if (current.ok || current.data === undefined) return current;
    current = await fixPlaceEditorial(llm, provider, place, current.data, current.issues);
  }
  return current;
}

/**
 * Enrich every unpublished place of a city missing its factual summary.
 * Returns the number of rows enriched.
 */
export async function enrichPlacesEditorial(
  cfg: SupabaseRestConfig,
  cityKey: string,
  options: EnrichOptions = {},
): Promise<number> {
  const filters = [`city_key=eq.${cityKey}`, 'is_published=eq.false', 'factual_summary_fr=is.null'];
  if (options.kind !== undefined) filters.push(`kind=eq.${encodeURIComponent(options.kind)}`);
  if (options.slug !== undefined) filters.push(`slug=eq.${encodeURIComponent(options.slug)}`);
  if (options.sourcePrefix !== undefined) {
    filters.push(`source_ref=like.${encodeURIComponent(`${options.sourcePrefix}%`)}`);
  }

  const places = await selectTable<PlaceRow>(cfg, 'places', {
    columns: 'id,slug,name,city,kind,bucket,address,source_ref,factual_summary_fr',
    filters,
    order: 'id.asc',
    ...(options.limit !== undefined ? { limit: options.limit } : {}),
  });

  console.log(
    `[enrich] ${String(places.length)} places to enrich in ${cityKey}` +
      `${options.dryRun === true ? ' (DRY-RUN)' : ''}.`,
  );
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  let enriched = 0;

  for (const place of places) {
    if (isActivityRouteMisclassified(place)) {
      console.warn(
        `  [enrich] ${place.name}: skipped — activity route needs outdoor reclassification.`,
      );
      continue;
    }

    let attempt = await generatePlaceEditorial(llm, provider, place);
    attempt = await applyFixPasses(llm, provider, place, attempt);
    if (!attempt.ok) {
      attempt = await generatePlaceEditorial(llm, provider, place, attempt.issues);
      attempt = await applyFixPasses(llm, provider, place, attempt);
    }
    if (!attempt.ok || attempt.data === undefined) {
      console.warn(`  [enrich] ${place.name}: rejected - ${attempt.issues.join(', ')}`);
      continue;
    }
    const e = attempt.data;
    if (options.dryRun === true) {
      console.log(
        `  [enrich] ${place.name} ok DRY ` +
          `summary=${String(e.factual_summary_fr.length)}c faq=${String(e.faq.length)} ` +
          `tokens=${String(attempt.tokens.input)}/${String(attempt.tokens.output)}`,
      );
    } else {
      await patchById(cfg, 'places', place.id, {
        factual_summary_fr: e.factual_summary_fr,
        factual_summary_en: e.factual_summary_en,
        description_fr: e.description_fr,
        description_en: e.description_en,
        concierge_advice: e.concierge_advice,
        faq: e.faq,
      });
      console.log(
        `  [enrich] ${place.name} ok ` +
          `faq=${String(e.faq.length)} tokens=${String(attempt.tokens.input)}/${String(
            attempt.tokens.output,
          )}`,
      );
    }
    enriched += 1;
  }

  console.log(`[enrich] done - ${String(enriched)}/${String(places.length)} enriched.`);
  return enriched;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
  await enrichPlacesEditorial(cfg, args.city, args);
}

if (process.argv[1]?.endsWith('enrich-places-editorial.ts') === true) {
  main().catch((e: unknown) => {
    console.error('[enrich] fatal:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
