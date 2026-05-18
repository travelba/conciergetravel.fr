/**
 * llm-describe-events.ts — batch LLM describer for upcoming events.
 *
 * Generates a 1-2 sentence French + English description per event
 * given the bare facts (name, category, dates, venue, optional raw
 * description). Same EEAT contract as `llm-describe-pois.ts`:
 *
 *   - No fabricated facts (no headliners, no inventory of works, no
 *     attendance numbers, no critical acclaim).
 *   - No superlatives ("incontournable", "ne pas manquer").
 *   - No first-person, no injunctive verbs.
 *   - If the only fact we have is `name + category`, the description
 *     stays factual: "Concert au Théâtre du Châtelet, programmation
 *     symphonique."
 *
 * Single-call per event, bounded concurrency (skill:
 * llm-output-robustness §rule-1). gpt-4o-mini, ~140 in / 80 out
 * tokens per event. For 109 hotels × ~3 events ≈ 327 calls ≈ $0.04.
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
      '[llm-describe-events] OPENAI_API_KEY missing — required for event descriptions. Run with --no-llm to skip.',
    );
  }
  return new OpenAI({ apiKey: OPENAI_KEY });
}

const DescribeEventOutputSchema = z.object({
  description_fr: z.string().min(20).max(280),
  description_en: z.string().min(20).max(280),
});

export type EventCategory = 'concert' | 'expo' | 'festival' | 'sport' | 'theater' | 'other';

export interface DescribeEventInput {
  readonly name: string;
  readonly category: EventCategory;
  readonly city: string;
  readonly venueName: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  /** Optional raw short description from DT — fact anchor when present. */
  readonly factAnchor: string | null;
}

export interface DescribeEventOutput {
  readonly descriptionFr: string;
  readonly descriptionEn: string;
}

const SYSTEM_PROMPT = `Tu es un concierge digital pour MyConciergeHotel.com — agence de voyages française spécialisée Palaces & 5 étoiles.

Pour chaque évènement fourni, tu rédiges UNE description en français et UNE en anglais, destinées à figurer sous le nom de l'évènement dans le bloc "Évènements à proximité" d'une fiche d'hôtel de luxe.

RÈGLES STRICTES (anti-hallucination) :
1. Tu N'INVENTES JAMAIS de fait : pas de tête d'affiche, pas de programme précis, pas de récompense, pas d'historique.
2. Tu N'INVENTES JAMAIS de nom propre supplémentaire (artiste, commissaire, metteur en scène, sponsor).
3. Si tu ne sais que dire d'utile et sourcé, tu te limites à une reformulation neutre du \`category\` + \`venueName\`.
4. Tu T'INTERDIS les superlatifs ("incontournable", "à ne pas manquer", "événement majeur", "édition culte").
5. Tu T'INTERDIS la première personne ("nous", "notre").
6. Tu T'INTERDIS toute phrase commerciale ou injonctive ("réservez", "découvrez", "vivez l'expérience").
7. Tu N'INVENTES JAMAIS de durée : si seules les dates de début/fin sont données, tu ne dis pas "X heures de spectacle".
8. Tu ne mentionnes pas la distance — elle est affichée par l'UI ailleurs.
9. Tu réponds en JSON strict : {"description_fr": "…", "description_en": "…"}.

Longueur :
- description_fr : 1 ou 2 phrases, 60 à 220 caractères.
- description_en : 1 ou 2 phrases, 60 à 220 caractères.

EXEMPLES SOURCÉS (à imiter, pas à recopier) :

Exemple 1 (concert, factAnchor null) :
  Input  : { name: "Récital de piano — Lang Lang", category: "concert", city: "Paris", venueName: "Philharmonie de Paris", startDate: "2026-06-15", endDate: null }
  Output : {
    "description_fr": "Récital de piano programmé à la Philharmonie de Paris le 15 juin 2026, dans la grande salle Pierre-Boulez.",
    "description_en": "Piano recital scheduled at the Philharmonie de Paris on 15 June 2026, in the Pierre-Boulez main hall."
  }

Exemple 2 (expo, factAnchor fourni) :
  Input  : { name: "Matisse en majesté", category: "expo", city: "Paris", venueName: "Musée du Luxembourg", startDate: "2026-06-12", endDate: "2026-09-15", factAnchor: "Exposition consacrée à Matisse, en collaboration avec le Centre Pompidou." }
  Output : {
    "description_fr": "Exposition Matisse présentée au Musée du Luxembourg du 12 juin au 15 septembre 2026, organisée avec le Centre Pompidou.",
    "description_en": "Matisse exhibition staged at the Musée du Luxembourg from 12 June to 15 September 2026, organised with the Centre Pompidou."
  }

Exemple 3 (festival, factAnchor null) :
  Input  : { name: "Festival d'Aix-en-Provence", category: "festival", city: "Aix-en-Provence", venueName: null, startDate: "2026-07-04", endDate: "2026-07-24" }
  Output : {
    "description_fr": "Festival d'art lyrique programmé à Aix-en-Provence du 4 au 24 juillet 2026.",
    "description_en": "Opera festival scheduled in Aix-en-Provence from 4 to 24 July 2026."
  }`;

function userPromptForEvent(input: DescribeEventInput): string {
  const dateLine =
    input.endDate !== null && input.endDate !== input.startDate
      ? `Dates : du ${input.startDate} au ${input.endDate}`
      : `Date : ${input.startDate}`;
  const lines = [
    `Évènement à proximité d'un hôtel — ville : ${input.city}`,
    `Nom : ${input.name}`,
    `Catégorie : ${input.category}`,
    input.venueName !== null ? `Lieu : ${input.venueName}` : 'Lieu : non renseigné',
    dateLine,
    input.factAnchor !== null && input.factAnchor.length > 0
      ? `factAnchor (description officielle, à reformuler sans inventer) : "${input.factAnchor.slice(0, 320)}"`
      : 'factAnchor : null (tu te limites à une phrase neutre dérivée de la catégorie + lieu + date)',
    '',
    'Rends UNIQUEMENT le JSON, sans markdown, sans commentaire.',
  ].filter((s): s is string => s !== null);
  return lines.join('\n');
}

async function describeOne(
  client: OpenAI,
  input: DescribeEventInput,
): Promise<DescribeEventOutput | null> {
  const res = await client.chat.completions.create({
    model: DESCRIBER_MODEL,
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPromptForEvent(input) },
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
  const parsed = DescribeEventOutputSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    descriptionFr: parsed.data.description_fr.trim(),
    descriptionEn: parsed.data.description_en.trim(),
  };
}

export async function describeEventsBatch(
  inputs: readonly DescribeEventInput[],
  opts: { readonly concurrency?: number } = {},
): Promise<readonly (DescribeEventOutput | null)[]> {
  if (inputs.length === 0) return [];
  const client = requireOpenai();
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const results: (DescribeEventOutput | null)[] = new Array(inputs.length).fill(null);

  const queue = inputs.map((input, i) => ({ input, i }));
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        results[item.i] = await describeOne(client, item.input);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`  [llm-describe-events] failed for "${item.input.name}": ${msg.slice(0, 200)}`);
        results[item.i] = null;
      }
    }
  };
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}
