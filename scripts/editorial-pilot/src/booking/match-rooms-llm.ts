/**
 * match-rooms-llm.ts — fully automated, supplier-agnostic room matcher.
 *
 * Resolves the hard case that deterministic token-overlap cannot: a branded
 * editorial room ("Suite Mosaïque") vs a generic supplier label ("Junior Suite
 * With Terrace"). The two share no name token, but they DO share attributes
 * (junior tier, private terrace, ~45 m²). An LLM reading both sides by ATTRIBUTE
 * (size, bed, view, tier, description) resolves the link with no human in the
 * loop.
 *
 * Robustness contract (skill `llm-output-robustness`):
 *   - Rule 5  : every returned `hotel_room_id` is re-validated against the
 *               provided editorial allowlist; hallucinated ids → coerced to null.
 *   - Rule 9  : extraction job → gpt-4o-mini, temperature 0, deterministic.
 *   - Rule 3  : enum drift on `confidence` absorbed by a preprocess alias map.
 *   - Graceful: a null match (or a dropped low-confidence match) is NOT an error
 *               — the runtime orchestrator surfaces the supplier room as-is.
 *
 * NEVER throws on a model hiccup: returns `null` so the caller falls back to the
 * deterministic-only mapping (which itself degrades to a graceful supplier-label
 * display). No step ever requires a human.
 */
import OpenAI from 'openai';
import { z } from 'zod';

const DEFAULT_MODEL = 'gpt-4o-mini-2024-07-18';

export type MatchConfidence = 'auto_high' | 'auto_medium' | 'auto_low';

/** Editorial room (canonical side) with the attributes that drive matching. */
export interface EditorialRoomForMatch {
  readonly id: string;
  readonly nameFr: string | null;
  readonly nameEn: string | null;
  readonly roomCode: string;
  readonly bedType: string | null;
  readonly sizeSqm: number | null;
  readonly maxOccupancy: number | null;
  readonly description: string | null;
}

/** Supplier room candidate (one distinct bookable label). */
export interface SupplierRoomForMatch {
  /** Stable index used to correlate the model answer back to the candidate. */
  readonly index: number;
  readonly label: string;
}

export interface RoomMatch {
  readonly supplierIndex: number;
  /** `hotel_rooms.id` when a confident editorial room is found, else null. */
  readonly hotelRoomId: string | null;
  readonly confidence: MatchConfidence;
  /** One short sentence citing the deciding attribute (for the runlog/audit). */
  readonly reasoning: string;
}

export interface MatchRoomsInput {
  readonly hotelName: string;
  readonly editorialRooms: readonly EditorialRoomForMatch[];
  readonly supplierRooms: readonly SupplierRoomForMatch[];
  readonly apiKey: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

const ConfidenceSchema = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const alias: Record<string, MatchConfidence> = {
      high: 'auto_high',
      medium: 'auto_medium',
      med: 'auto_medium',
      low: 'auto_low',
      auto_high: 'auto_high',
      auto_medium: 'auto_medium',
      auto_low: 'auto_low',
    };
    return alias[v.toLowerCase().trim()] ?? v;
  },
  z.enum(['auto_high', 'auto_medium', 'auto_low']),
);

const MatchRowSchema = z.object({
  supplier_index: z.number().int(),
  hotel_room_id: z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length === 0 || t.toLowerCase() === 'null' || t.toLowerCase() === 'none') return null;
      return t;
    }
    return null;
  }, z.string().nullable()),
  confidence: ConfidenceSchema,
  reasoning: z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().max(400).default('')),
});

const ResponseSchema = z.object({
  matches: z.array(MatchRowSchema).max(200),
});

function describeEditorialRoom(room: EditorialRoomForMatch): string {
  const parts: string[] = [`id=${room.id}`];
  const name = room.nameFr ?? room.nameEn ?? room.roomCode;
  parts.push(`name="${name}"`);
  if (room.nameEn !== null && room.nameEn !== room.nameFr) parts.push(`name_en="${room.nameEn}"`);
  if (room.sizeSqm !== null) parts.push(`size=${room.sizeSqm}m2`);
  if (room.bedType !== null) parts.push(`bed="${room.bedType}"`);
  if (room.maxOccupancy !== null) parts.push(`sleeps=${room.maxOccupancy}`);
  if (room.description !== null && room.description.trim().length > 0) {
    parts.push(`desc="${room.description.replace(/\s+/gu, ' ').trim().slice(0, 320)}"`);
  }
  return parts.join(' | ');
}

const SYSTEM_PROMPT = [
  'You map a hotel SUPPLIER room label to the best matching EDITORIAL room of the same hotel.',
  'Match by ATTRIBUTES (size in m², bed type, max occupancy, view/terrace, room tier:',
  'classic < superior < deluxe < junior suite < suite < signature/presidential),',
  'NOT by literal name. Branded editorial names (e.g. "Suite Mosaïque") rarely share a',
  'word with generic supplier labels (e.g. "Junior Suite With Terrace") yet describe the',
  'same physical room.',
  '',
  'For EACH supplier room, output exactly one object:',
  '- supplier_index: the integer index of the supplier room.',
  '- hotel_room_id: the editorial room id (copied VERBATIM from the provided list), or',
  '  null when no editorial room is a confident attribute match.',
  '- confidence: "high" (tier + at least one strong attribute agree, e.g. terrace/size/view),',
  '  "medium" (tier agrees, weak/uncertain secondary attributes),',
  '  "low" (only a vague tier guess) — use low or null rather than forcing a wrong match.',
  '- reasoning: ONE short sentence naming the deciding attribute(s).',
  '',
  'Hard rules:',
  '- NEVER invent an id. Copy an id from the list or use null.',
  '- Two different supplier rooms MAY map to the same editorial room (rate variants).',
  '- A generic label that could equally fit several distinct branded suites → null (ambiguous).',
  '- Output a single JSON object: { "matches": [ ... ] }. No prose, no markdown fences.',
].join('\n');

/**
 * Returns one {@link RoomMatch} per supplier room, or `null` on any model/parse
 * failure (caller falls back to deterministic-only mapping). Hallucinated ids
 * are coerced to null; confidence is normalised.
 */
export async function matchSupplierRoomsToEditorial(
  input: MatchRoomsInput,
): Promise<readonly RoomMatch[] | null> {
  if (input.supplierRooms.length === 0 || input.editorialRooms.length === 0) return [];

  const client = new OpenAI({
    apiKey: input.apiKey,
    timeout: input.timeoutMs ?? 120_000,
    maxRetries: 2,
  });

  const editorialBlock = input.editorialRooms
    .map((r) => `  - ${describeEditorialRoom(r)}`)
    .join('\n');
  const supplierBlock = input.supplierRooms
    .map((s) => `  - supplier_index=${s.index} label="${s.label}"`)
    .join('\n');

  const userPrompt = [
    `HOTEL: ${input.hotelName}`,
    '',
    'EDITORIAL ROOMS (canonical — copy ids verbatim):',
    editorialBlock,
    '',
    'SUPPLIER ROOMS (map each one):',
    supplierBlock,
    '',
    'Return ONLY the JSON object now.',
  ].join('\n');

  let raw: string | null = null;
  try {
    const response = await client.chat.completions.create({
      model: input.model ?? DEFAULT_MODEL,
      temperature: 0,
      max_tokens: Math.min(8000, 400 + input.supplierRooms.length * 120),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    const choice = response.choices[0];
    if (!choice || !choice.message.content) return null;
    if (choice.finish_reason === 'length') {
      console.warn(`[match-rooms] OUTPUT TRUNCATED for "${input.hotelName}" — bump max_tokens.`);
      return null;
    }
    raw = choice.message.content;
  } catch (err) {
    console.warn(
      `[match-rooms] LLM call failed for "${input.hotelName}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn(`[match-rooms] JSON parse failed for "${input.hotelName}".`);
    return null;
  }

  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.warn(
      `[match-rooms] schema invalid for "${input.hotelName}": ` +
        parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
    );
    return null;
  }

  // Rule 5 — re-validate ids against the allowlist; coerce hallucinations to null.
  const allowed = new Set(input.editorialRooms.map((r) => r.id));
  const validSupplierIndices = new Set(input.supplierRooms.map((s) => s.index));
  const seen = new Set<number>();
  const out: RoomMatch[] = [];
  for (const m of parsed.data.matches) {
    if (!validSupplierIndices.has(m.supplier_index) || seen.has(m.supplier_index)) continue;
    seen.add(m.supplier_index);
    const id = m.hotel_room_id !== null && allowed.has(m.hotel_room_id) ? m.hotel_room_id : null;
    out.push({
      supplierIndex: m.supplier_index,
      hotelRoomId: id,
      confidence: m.confidence,
      reasoning: m.reasoning,
    });
  }
  return out;
}
