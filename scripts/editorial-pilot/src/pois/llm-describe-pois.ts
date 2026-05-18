/**
 * llm-describe-pois.ts — batch LLM describer for POIs.
 *
 * Generates a 1-2 sentence French + English description per POI given
 * the bare facts (name, type, bucket, distance, optional category +
 * raw DT description). The output is constrained to be **EEAT-safe**:
 * we forbid invented facts, prices, opening hours or superlatives.
 *
 * Single-concern, single-call per POI (skill: llm-output-robustness §rule-1).
 * Concurrency is bounded so we don't trip OpenAI's TPM limits.
 *
 * Cost — gpt-4o-mini, ~120 in / 80 out tokens per POI:
 *   - 109 hotels × ~25 POIs ≈ 2 725 calls
 *   - ≈ 0.5 M input + 0.2 M output tokens
 *   - ≈ $0.20 input + $0.12 output ≈ ~$0.32 total
 */

import OpenAI from 'openai';
import { z } from 'zod';

import { loadEnv } from '../env.js';

const env = loadEnv();
const OPENAI_KEY = env.OPENAI_API_KEY;

const DESCRIBER_MODEL = 'gpt-4o-mini-2024-07-18';

function requireOpenai(): OpenAI {
  if (OPENAI_KEY === undefined || OPENAI_KEY.length === 0) {
    throw new Error(
      '[llm-describe-pois] OPENAI_API_KEY missing — required for POI descriptions. Run with --no-llm to skip.',
    );
  }
  return new OpenAI({ apiKey: OPENAI_KEY });
}

const DescribeOutputSchema = z.object({
  description_fr: z.string().min(20).max(280),
  description_en: z.string().min(20).max(280),
});

export interface DescribePoiInput {
  readonly name: string;
  readonly type: string;
  readonly bucket: 'visit' | 'do' | 'shop';
  readonly category: string | null;
  readonly city: string;
  readonly distanceMeters: number;
  readonly walkMinutes: number | null;
  /** Optional raw description from DT — used as a fact anchor when present. */
  readonly factAnchor: string | null;
}

export interface DescribePoiOutput {
  readonly descriptionFr: string;
  readonly descriptionEn: string;
}

const SYSTEM_PROMPT = `Tu es un concierge digital pour MyConciergeHotel.com — agence de voyages française spécialisée Palaces & 5 étoiles.

Pour chaque POI fourni, tu rédiges UNE description en français et UNE en anglais, destinées à figurer sous la carte d'un POI sur la fiche d'un hôtel de luxe.

RÈGLES STRICTES (anti-hallucination) :
1. Tu N'INVENTES JAMAIS de fait : pas de prix, pas d'horaires, pas de surface, pas d'année, pas de récompense.
2. Tu N'INVENTES JAMAIS de nom propre supplémentaire (chef, fondateur, architecte, époque).
3. Si tu ne sais que dire d'utile et sourcé, tu te limites à une reformulation neutre du \`type\` et de l'\`bucket\`.
4. Tu T'INTERDIS les superlatifs ("incontournable", "mythique", "légendaire", "le meilleur").
5. Tu T'INTERDIS la première personne ("nous", "notre").
6. Tu T'INTERDIS toute phrase commerciale ou injonctive ("à ne pas manquer", "réservez", "découvrez").
7. Tu cites la distance au lieu donné UNIQUEMENT si elle est < 800 m ET tu utilises "à X minutes à pied" (jamais "tout proche", "à deux pas").
8. Pour les "shop" (pharmacie, boulangerie…), tu décris l'utilité pratique en 1 phrase, factuelle.
9. Pour les "visit" et "do", tu te bases sur le type + le factAnchor si fourni — sinon une description très courte (1 phrase) qui ne dit que ce qui est garanti par le type.
10. Tu réponds en JSON strict : {"description_fr": "…", "description_en": "…"}.

Longueur :
- description_fr : 1 ou 2 phrases, 60 à 220 caractères.
- description_en : 1 ou 2 phrases, 60 à 220 caractères.

EXEMPLES SOURCÉS (à imiter, pas à recopier) :

Exemple 1 (shop, factAnchor null) :
  Input  : { name: "Pharmacie de la Madeleine", type: "pharmacy", bucket: "shop", city: "Paris", distanceMeters: 180, walkMinutes: 3 }
  Output : {
    "description_fr": "Pharmacie de quartier à 3 minutes à pied, utile pour les premiers soins et les ordonnances en voyage.",
    "description_en": "Neighbourhood pharmacy three minutes' walk away, useful for over-the-counter needs and prescriptions while travelling."
  }

Exemple 2 (visit, factAnchor fourni) :
  Input  : { name: "Musée du Louvre", type: "museum", bucket: "visit", city: "Paris", distanceMeters: 650, walkMinutes: 8, factAnchor: "Plus grand musée d'art au monde, abritant la Joconde et la Vénus de Milo." }
  Output : {
    "description_fr": "Musée d'art à 8 minutes à pied, dont les collections couvrent l'Antiquité jusqu'au XIXᵉ siècle.",
    "description_en": "Art museum an eight-minute walk away, with collections spanning antiquity to the nineteenth century."
  }

Exemple 3 (do, factAnchor null, distance > 800 m) :
  Input  : { name: "Plage de Pampelonne", type: "beach", bucket: "do", city: "Ramatuelle", distanceMeters: 2400, walkMinutes: null }
  Output : {
    "description_fr": "Plage de Pampelonne, frange sablonneuse classée Natura 2000 sur la côte tropézienne.",
    "description_en": "Pampelonne beach, a Natura 2000-classified sandy stretch on the Saint-Tropez coastline."
  }`;

function userPromptForPoi(input: DescribePoiInput): string {
  const distance =
    input.distanceMeters < 800 && input.walkMinutes !== null
      ? `${input.distanceMeters} m (≈ ${input.walkMinutes} min à pied)`
      : `${input.distanceMeters} m`;
  const lines = [
    `Hôtel à proximité — ville : ${input.city}`,
    `POI : ${input.name}`,
    `Type : ${input.type}`,
    `Bucket : ${input.bucket}`,
    input.category !== null ? `Catégorie : ${input.category}` : null,
    `Distance depuis l'hôtel : ${distance}`,
    input.factAnchor !== null && input.factAnchor.length > 0
      ? `factAnchor (description officielle, à reformuler sans inventer) : "${input.factAnchor.slice(0, 320)}"`
      : 'factAnchor : null (tu te limites à une phrase neutre dérivée du type)',
    '',
    'Rends UNIQUEMENT le JSON, sans markdown, sans commentaire.',
  ].filter((s): s is string => s !== null);
  return lines.join('\n');
}

async function describeOne(
  client: OpenAI,
  input: DescribePoiInput,
): Promise<DescribePoiOutput | null> {
  const res = await client.chat.completions.create({
    model: DESCRIBER_MODEL,
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPromptForPoi(input) },
    ],
  });
  const content = res.choices[0]?.message.content;
  if (content === undefined || content === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = DescribeOutputSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    descriptionFr: parsed.data.description_fr.trim(),
    descriptionEn: parsed.data.description_en.trim(),
  };
}

/**
 * Describe a batch of POIs with bounded concurrency. Failures are
 * returned as `null` per slot — the caller decides whether to retry,
 * skip, or fall back to no description (the schema marks the field
 * optional so a `null` is safe to drop on the floor).
 */
export async function describePoisBatch(
  inputs: readonly DescribePoiInput[],
  opts: { readonly concurrency?: number } = {},
): Promise<readonly (DescribePoiOutput | null)[]> {
  if (inputs.length === 0) return [];
  const client = requireOpenai();
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const results: (DescribePoiOutput | null)[] = new Array(inputs.length).fill(null);

  // Index-aware queue so we preserve input order in the output array.
  const queue = inputs.map((input, i) => ({ input, i }));
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        results[item.i] = await describeOne(client, item.input);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`  [llm-describe] failed for "${item.input.name}": ${msg.slice(0, 200)}`);
        results[item.i] = null;
      }
    }
  };
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}
