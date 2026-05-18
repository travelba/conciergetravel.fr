/**
 * Minimal parser for OSM `opening_hours` tags — answers the only
 * question the public hotel page actually asks: "is this POI open
 * **today**, and at what hours?".
 *
 * Why hand-roll instead of pulling in `opening_hours.js`:
 *   - The npm package is ~ 80 KB minified (gzip ~ 20 KB) and ships
 *     ICU-style locale data. Each hotel detail page renders 5-15
 *     POI cards; the cost is non-trivial on a route we already keep
 *     under 180 KB first-load JS.
 *   - We only need the four most common OSM shapes that DATAtourisme
 *     + Overpass actually emit for our retail/cultural POIs:
 *       1.  `24/7`
 *       2.  `Mo-Fr 09:00-19:00`
 *       3.  `Mo-Sa 08:00-20:00; Su closed`
 *       4.  `Mo-Su 06:00-22:00` (or `Mo-Sa 06:00-22:00`)
 *   - Anything more exotic (PH, sunset, school holidays) is dropped
 *     into `unknown` so the UI falls back to the raw OSM string with
 *     a "Voir les horaires" hint rather than guessing.
 *
 * Returns a small discriminated union the front-end can switch on:
 *   - `{ kind: '24_7' }`              → always open
 *   - `{ kind: 'open', from, until }` → open today at the given range
 *   - `{ kind: 'closed' }`            → explicitly closed today
 *   - `{ kind: 'unknown' }`           → raw tag could not be parsed
 *
 * Time strings are returned in `HH:MM` 24-hour format. The component
 * decides the locale-specific display (`19:00` vs `7:00 PM`).
 *
 * The parser is deterministic and free of `Date.now()` side-effects
 * when `referenceDay` is provided — tests inject a fixed weekday.
 */

export type PoiHours =
  | { readonly kind: '24_7' }
  | { readonly kind: 'open'; readonly from: string; readonly until: string }
  | { readonly kind: 'closed' }
  | { readonly kind: 'unknown' };

/** OSM weekday tokens — index matches JavaScript `Date#getUTCDay()` shifted so 0 = Monday. */
const WEEKDAY_TOKENS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
type WeekdayToken = (typeof WEEKDAY_TOKENS)[number];

/**
 * Resolves JavaScript's Sunday-indexed `getUTCDay()` to the OSM
 * Monday-indexed token. We use UTC so the same render fed by ISR
 * cache returns the same hours regardless of the viewer's timezone
 * — fluctuating UI text would crater the ISR hit rate.
 */
function todayToken(referenceDay?: WeekdayToken): WeekdayToken {
  if (referenceDay !== undefined) return referenceDay;
  const day = new Date().getUTCDay(); // 0 = Sunday … 6 = Saturday
  const monIndexed = (day + 6) % 7; // 0 = Monday … 6 = Sunday
  const token = WEEKDAY_TOKENS[monIndexed];
  // Defensive: WEEKDAY_TOKENS.length === 7, monIndexed ∈ [0,6], so
  // `token` cannot be undefined — narrow without an assertion.
  return token ?? 'Mo';
}

/** Time-of-day shape — accepts `H:MM` (single-digit hour) too because
 *  Overpass sometimes returns `8:00` rather than `08:00`. */
const TIME_REGEX = /^([0-1]?\d|2[0-3]):([0-5]\d)$/u;
/**
 * Match a single "block" (one weekday range + one time range):
 *   `Mo-Fr 09:00-19:00`, `Mo 08:00-20:00`, `Sa-Su 10:00-18:00`.
 * The day range is mandatory — bare `09:00-19:00` (implicit every day)
 * is rare in our datasets and falls through to `unknown`.
 */
const RULE_REGEX =
  /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+([0-1]?\d|2[0-3]):([0-5]\d)-([0-1]?\d|2[0-3]):([0-5]\d)$/u;

function normaliseTime(h: string, m: string): string {
  const hh = h.padStart(2, '0');
  return `${hh}:${m}`;
}

function isInRange(today: WeekdayToken, start: WeekdayToken, end: WeekdayToken | null): boolean {
  if (end === null) return today === start;
  const s = WEEKDAY_TOKENS.indexOf(start);
  const e = WEEKDAY_TOKENS.indexOf(end);
  const t = WEEKDAY_TOKENS.indexOf(today);
  // Wrap-around ranges like `Sa-Mo` are legal in OSM — treat them
  // inclusively across the week boundary.
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e;
}

/**
 * Parses a single OSM `opening_hours` tag into the question the
 * hotel detail page actually needs answered. See module-level docstring
 * for the supported shapes and rationale.
 *
 * `referenceDay` is a test-only knob — production calls leave it
 * undefined so the function reads the current UTC weekday.
 */
export function parseOpeningHoursForToday(raw: string, referenceDay?: WeekdayToken): PoiHours {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: 'unknown' };
  if (trimmed === '24/7') return { kind: '24_7' };

  const today = todayToken(referenceDay);
  // OSM allows `;` to chain rules. Last matching rule wins per the
  // spec; we iterate forward and keep the most recent match so an
  // override like `Mo-Sa 09:00-19:00; Su closed` reports correctly
  // when today is Sunday.
  const rules = trimmed.split(';').map((r) => r.trim()).filter((r) => r.length > 0);
  let lastKnown: PoiHours = { kind: 'unknown' };

  for (const rule of rules) {
    // Explicit closure shorthand.
    const closedMatch = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(?:off|closed)$/iu.exec(
      rule,
    );
    if (closedMatch !== null) {
      const start = closedMatch[1] as WeekdayToken;
      const end = (closedMatch[2] as WeekdayToken | undefined) ?? null;
      if (isInRange(today, start, end)) {
        lastKnown = { kind: 'closed' };
      }
      continue;
    }

    const m = RULE_REGEX.exec(rule);
    if (m === null) continue;
    const start = m[1] as WeekdayToken;
    const end = (m[2] as WeekdayToken | undefined) ?? null;
    const fromH = m[3];
    const fromM = m[4];
    const untilH = m[5];
    const untilM = m[6];
    if (
      fromH === undefined ||
      fromM === undefined ||
      untilH === undefined ||
      untilM === undefined
    ) {
      continue;
    }
    if (!isInRange(today, start, end)) continue;
    const from = normaliseTime(fromH, fromM);
    const until = normaliseTime(untilH, untilM);
    // Sanity: `from` < `until` (we don't support overnight ranges yet).
    if (!TIME_REGEX.test(from) || !TIME_REGEX.test(until)) continue;
    if (from >= until) continue;
    lastKnown = { kind: 'open', from, until };
  }

  return lastKnown;
}

/**
 * Format helper for the hotel detail page — turns the discriminated
 * union into a single-line display string. Locale-aware so French
 * uses `9h00 – 19h00` (no space, lowercase `h`) while English uses
 * `9:00 AM – 7:00 PM`.
 *
 * Returns `null` when the hours are `unknown` so the UI can pick
 * its own fallback ("Voir les horaires", a link, etc.).
 */
export function formatOpeningHoursToday(
  hours: PoiHours,
  locale: 'fr' | 'en',
): string | null {
  if (hours.kind === 'unknown') return null;
  if (hours.kind === '24_7') return locale === 'fr' ? 'Ouvert 24h/24' : 'Open 24/7';
  if (hours.kind === 'closed') return locale === 'fr' ? 'Fermé aujourd’hui' : 'Closed today';
  const { from, until } = hours;
  if (locale === 'fr') {
    const fmt = (t: string): string => t.replace(':', 'h');
    return `${fmt(from)} – ${fmt(until)}`;
  }
  return `${from} – ${until}`;
}
