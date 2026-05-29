/**
 * hotel-policies-builder.ts — pure mapping from grounded policy facts to
 * the `hotels.policies` jsonb shape (CDC §2 bloc 9), replacing the 357
 * synthetic defaults (`_synthetic: true`, migration 0055) with real data.
 *
 * Shapes mirror the web reader `PoliciesSchema`
 * (`apps/web/src/server/hotels/get-hotel-by-slug.ts`):
 *   - check_in:  { from: HH:MM, until?: HH:MM }
 *   - check_out: { until: HH:MM }
 *   - cancellation: { summary_fr?, summary_en?, free_until_hours?, … }
 *   - pets: { allowed: boolean, fee_eur?, notes_fr?, notes_en? }
 *   - wifi: { included: boolean, scope?, notes_fr?, notes_en? }
 *
 * Anti-fabrication: we only emit a block when the corresponding fact was
 * grounded. We NEVER carry `_synthetic: true` into the output, and we
 * preserve any already-real (non-synthetic) block from the existing row.
 *
 * Skill: editorial-pilot, content-enrichment-pipeline.
 */

import { z } from 'zod';

/** Facts extracted from the official site / Tavily — all optional. */
export const PolicyFactsSchema = z.object({
  check_in_from: z.string().nullable().optional(),
  check_in_until: z.string().nullable().optional(),
  check_out_until: z.string().nullable().optional(),
  pets_allowed: z.boolean().nullable().optional(),
  pet_fee_eur: z.number().nonnegative().nullable().optional(),
  pet_notes_fr: z.string().nullable().optional(),
  pet_notes_en: z.string().nullable().optional(),
  wifi_included: z.boolean().nullable().optional(),
  wifi_scope: z.enum(['whole_property', 'public_areas', 'rooms']).nullable().optional(),
  cancellation_summary_fr: z.string().nullable().optional(),
  cancellation_summary_en: z.string().nullable().optional(),
  cancellation_free_until_hours: z.number().int().nonnegative().nullable().optional(),
});

export type PolicyFacts = z.infer<typeof PolicyFactsSchema>;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/u;

/**
 * Normalise a free-text time ("3pm", "15:00", "à partir de 15h", "noon")
 * into a strict `HH:MM` string, or return null when it can't be parsed
 * confidently (never guess).
 */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim().toLowerCase();
  if (s.length === 0) return null;
  if (TIME_RE.test(s)) return s;
  if (s === 'noon' || s === 'midi') return '12:00';
  if (s === 'midnight' || s === 'minuit') return '00:00';

  // 12-hour: "3pm", "3:30 pm", "3 p.m."
  const ampm = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/u.exec(s);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = ampm[2] !== undefined ? Number(ampm[2]) : 0;
    const isPm = ampm[3]?.startsWith('p') === true;
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }

  // 24-hour French: "15h", "15h30", "15 h 30"
  const fr = /^(\d{1,2})\s*h\s*(\d{2})?$/u.exec(s);
  if (fr) {
    const h = Number(fr[1]);
    const m = fr[2] !== undefined ? Number(fr[2]) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Strip scraping artifacts that aggregators (Booking-style) prepend to
 * amenity strings, e.g. "Free!Pets are allowed…". Returns null when the
 * note is empty after cleaning.
 */
export function cleanNote(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.trim();
  // Drop a leading "Free!" / "Free !" / "Gratuit !" artifact (with or
  // without the following space) that aggregators glue onto the sentence.
  s = s.replace(/^\s*(free|gratuit)\s*!\s*/iu, '').trim();
  return s.length > 0 ? s.slice(0, 280) : null;
}

/**
 * Heuristic: does the text read as French? Used to reject English that an
 * extractor dumped into a `notes_fr` field. Looks for French diacritics or
 * common French function words.
 */
function looksFrench(s: string): boolean {
  if (/[àâçéèêëîïôûùüœ]/iu.test(s)) return true;
  return /\b(les?|des?|une?|sur|avec|sont|peuvent|animaux|gratuit|chambre|nuit|frais)\b/iu.test(s);
}

/** A non-synthetic block already present on the row is real — keep it. */
function existingBlock(
  existing: unknown,
  key: string,
  isSynthetic: boolean,
): Record<string, unknown> | null {
  if (isSynthetic) return null;
  if (!isRecord(existing)) return null;
  const block = existing[key];
  return isRecord(block) ? block : null;
}

export interface BuildPoliciesResult {
  readonly policies: Record<string, unknown> | null;
  /** True when all 5 CDC core blocks (check_in/out/cancel/pets/wifi) are present. */
  readonly coreComplete: boolean;
  /** Count of blocks grounded from extraction (vs preserved/absent). */
  readonly grounded: number;
}

/**
 * Build the policies jsonb from extracted facts + the existing row.
 * Returns `policies: null` when nothing could be grounded AND the
 * existing data is synthetic (caller then skips the write — never
 * downgrades synthetic to nothing).
 */
export function buildPolicies(facts: PolicyFacts, existing: unknown): BuildPoliciesResult {
  const isSynthetic = isRecord(existing) && existing['_synthetic'] === true;
  const out: Record<string, unknown> = {};
  let grounded = 0;

  // check_in
  const checkInFrom = normalizeTime(facts.check_in_from);
  const checkInUntil = normalizeTime(facts.check_in_until);
  if (checkInFrom !== null) {
    out['check_in'] =
      checkInUntil !== null ? { from: checkInFrom, until: checkInUntil } : { from: checkInFrom };
    grounded++;
  } else {
    const kept = existingBlock(existing, 'check_in', isSynthetic);
    if (kept !== null) out['check_in'] = kept;
  }

  // check_out
  const checkOutUntil = normalizeTime(facts.check_out_until);
  if (checkOutUntil !== null) {
    out['check_out'] = { until: checkOutUntil };
    grounded++;
  } else {
    const kept = existingBlock(existing, 'check_out', isSynthetic);
    if (kept !== null) out['check_out'] = kept;
  }

  // pets
  if (typeof facts.pets_allowed === 'boolean') {
    const pets: Record<string, unknown> = { allowed: facts.pets_allowed };
    if (typeof facts.pet_fee_eur === 'number') pets['fee_eur'] = facts.pet_fee_eur;
    let noteFr = cleanNote(facts.pet_notes_fr);
    let noteEn = cleanNote(facts.pet_notes_en);
    // When FR and EN are byte-identical the FR field is almost certainly
    // untranslated English — keep it only if it actually reads French.
    if (noteFr !== null && noteEn !== null && noteFr === noteEn) {
      if (!looksFrench(noteFr)) noteFr = null;
    }
    if (noteFr !== null && !looksFrench(noteFr)) noteFr = null;
    if (noteFr !== null) pets['notes_fr'] = noteFr;
    if (noteEn !== null) pets['notes_en'] = noteEn;
    out['pets'] = pets;
    grounded++;
  } else {
    const kept = existingBlock(existing, 'pets', isSynthetic);
    if (kept !== null) out['pets'] = kept;
  }

  // wifi
  if (typeof facts.wifi_included === 'boolean') {
    const wifi: Record<string, unknown> = { included: facts.wifi_included };
    if (facts.wifi_scope !== null && facts.wifi_scope !== undefined)
      wifi['scope'] = facts.wifi_scope;
    out['wifi'] = wifi;
    grounded++;
  } else {
    const kept = existingBlock(existing, 'wifi', isSynthetic);
    if (kept !== null) out['wifi'] = kept;
  }

  // cancellation
  const cancellation: Record<string, unknown> = {};
  if (
    typeof facts.cancellation_summary_fr === 'string' &&
    facts.cancellation_summary_fr.trim().length > 0
  ) {
    cancellation['summary_fr'] = facts.cancellation_summary_fr.trim().slice(0, 400);
  }
  if (
    typeof facts.cancellation_summary_en === 'string' &&
    facts.cancellation_summary_en.trim().length > 0
  ) {
    cancellation['summary_en'] = facts.cancellation_summary_en.trim().slice(0, 400);
  }
  if (typeof facts.cancellation_free_until_hours === 'number') {
    cancellation['free_until_hours'] = facts.cancellation_free_until_hours;
  }
  if (Object.keys(cancellation).length > 0) {
    out['cancellation'] = cancellation;
    grounded++;
  } else {
    const kept = existingBlock(existing, 'cancellation', isSynthetic);
    if (kept !== null) out['cancellation'] = kept;
  }

  if (grounded === 0) {
    return { policies: null, coreComplete: false, grounded: 0 };
  }

  const coreKeys = ['check_in', 'check_out', 'cancellation', 'pets', 'wifi'];
  const coreComplete = coreKeys.every((k) => isRecord(out[k]));

  return { policies: out, coreComplete, grounded };
}
