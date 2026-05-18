/**
 * Schema.org `Place` subtype helpers for hotel-adjacent points of
 * interest (CDC §2 bloc 10).
 *
 * Two surfaces consume the helpers in this module:
 *
 *   1. **The hotel JSON-LD builder** (`hotel.ts`) — when emitting
 *      `nearbyAttractions[]`, it needs the correct `@type` for each
 *      POI so Google + LLM ingestion pipelines recognise the entity
 *      shape (Museum vs Pharmacy vs BakeryShop vs Restaurant…).
 *
 *   2. **The editorial sync script** (`scripts/editorial-pilot/.../sync-hotel-pois.ts`)
 *      — when persisting `points_of_interest[].schema_type` to
 *      Supabase, it must align with the URLs accepted by Schema.org
 *      so re-emitting the row later is a pass-through.
 *
 * We standardise on the **bare** Schema.org class name (`'Pharmacy'`,
 * not `'https://schema.org/Pharmacy'`) inside the JSON-LD tree because
 * the surrounding context (`@context: 'https://schema.org'`) already
 * scopes the namespace. The DB column stores the canonical full URL
 * — that's what `additionalType` expects per the spec.
 */

/**
 * Standard Schema.org class for the most common OSM `amenity` /
 * `shop` / `tourism` tag values encountered around French palaces.
 *
 * Ordering rationale (most-specific wins):
 *   - **Shops / utilities** map to their narrowest subtype
 *     (`Pharmacy`, `BakeryShop`, `GroceryStore`, `ConvenienceStore`,
 *     `BankOrCreditUnion`, `PostOffice`, `AutomatedTeller`,
 *     `LiquorStore`, `Bookstore`, `MovieRentalStore`).
 *   - **Tourism / heritage** map to `Museum`, `Park`,
 *     `LandmarksOrHistoricalBuildings`, `PerformingArtsTheater`,
 *     `PlaceOfWorship`, `Beach`, `Zoo`.
 *   - **F&B + nightlife** map to `Restaurant`, `BarOrPub`,
 *     `NightClub`, `CafeOrCoffeeShop`.
 *   - **Healthcare** maps to `Hospital` (broad) or `MedicalClinic`.
 *   - **Sports / outdoor** map to `SportsActivityLocation`.
 *
 * Anything unrecognised falls through to `TouristAttraction` — the
 * Google-recommended default for the "things tourists go to see"
 * generic case.
 */
const OSM_TO_SCHEMA: Readonly<Record<string, string>> = {
  // Heritage / culture
  monument: 'LandmarksOrHistoricalBuildings',
  landmark: 'LandmarksOrHistoricalBuildings',
  castle: 'LandmarksOrHistoricalBuildings',
  chateau: 'LandmarksOrHistoricalBuildings',
  heritage: 'LandmarksOrHistoricalBuildings',
  ruins: 'LandmarksOrHistoricalBuildings',
  memorial: 'LandmarksOrHistoricalBuildings',
  cultural: 'LandmarksOrHistoricalBuildings',
  museum: 'Museum',
  art_gallery: 'Museum',
  gallery: 'Museum',
  // Nature
  park: 'Park',
  garden: 'Park',
  nature: 'Park',
  nature_reserve: 'Park',
  beach: 'Beach',
  viewpoint: 'TouristAttraction',
  // Worship
  church: 'PlaceOfWorship',
  cathedral: 'PlaceOfWorship',
  chapel: 'PlaceOfWorship',
  synagogue: 'PlaceOfWorship',
  mosque: 'PlaceOfWorship',
  temple: 'PlaceOfWorship',
  religious: 'PlaceOfWorship',
  // Performing arts
  theater: 'PerformingArtsTheater',
  theatre: 'PerformingArtsTheater',
  opera_house: 'PerformingArtsTheater',
  cinema: 'MovieTheater',
  // Zoological
  zoo: 'Zoo',
  aquarium: 'Aquarium',
  // F&B + nightlife
  restaurant: 'Restaurant',
  cafe: 'CafeOrCoffeeShop',
  bar: 'BarOrPub',
  pub: 'BarOrPub',
  nightclub: 'NightClub',
  winery: 'Winery',
  // Lodging-adjacent (rarely a peer of the hotel, but we cover it for completeness)
  hotel: 'Hotel',
  // Shopping — broad
  shopping_centre: 'ShoppingCenter',
  shopping: 'ShoppingCenter',
  mall: 'ShoppingCenter',
  store: 'Store',
  marketplace: 'Store',
  // Shopping — narrow utilities (what travellers actually search for)
  pharmacy: 'Pharmacy',
  bakery: 'BakeryShop',
  supermarket: 'GroceryStore',
  convenience: 'ConvenienceStore',
  butcher: 'Store',
  cheese: 'Store',
  wine: 'LiquorStore',
  alcohol: 'LiquorStore',
  newsagent: 'Store',
  bookshop: 'BookStore',
  books: 'BookStore',
  florist: 'Store',
  // Banking + post
  atm: 'AutomatedTeller',
  bank: 'BankOrCreditUnion',
  post_office: 'PostOffice',
  // Healthcare (in-neighbourhood travel safety net)
  hospital: 'Hospital',
  clinic: 'MedicalClinic',
  doctors: 'MedicalClinic',
  dentist: 'Dentist',
  // Sports / outdoor
  sports_centre: 'SportsActivityLocation',
  fitness_centre: 'ExerciseGym',
  swimming_pool: 'SportsActivityLocation',
  // Transit (when a station is treated as a POI rather than as a transport entry)
  station: 'TrainStation',
  subway_entrance: 'SubwayStation',
};

/**
 * Returns the canonical Schema.org **class name** for the given OSM
 * tag value. Bare class name (no `https://schema.org/` prefix) so the
 * caller can drop it straight into a JSON-LD `@type` field.
 *
 * Falls back to `TouristAttraction` for unknown types — never returns
 * `Place` alone because Google's Hotel rich-result test penalises
 * overly generic Place nodes attached to a Hotel.
 */
export function osmToSchemaClass(rawType: string | null | undefined): string {
  if (typeof rawType !== 'string') return 'TouristAttraction';
  const key = rawType.toLowerCase().trim();
  return OSM_TO_SCHEMA[key] ?? 'TouristAttraction';
}

/**
 * Returns the full Schema.org URL form (e.g. `https://schema.org/Pharmacy`).
 * The sync script persists this URL into `points_of_interest[].schema_type`
 * so a future re-emit can read it back without recomputing.
 */
export function osmToSchemaUrl(rawType: string | null | undefined): string {
  return `https://schema.org/${osmToSchemaClass(rawType)}`;
}

/**
 * Schema.org `OpeningHoursSpecification` node (Google-supported on
 * `LocalBusiness`, `Place`, `Hotel`).
 *
 * We model each unique time range as a separate node carrying the set
 * of `dayOfWeek[]` entries it applies to — Google's parser accepts
 * either shape, but the multi-day variant is more compact.
 */
export interface OpeningHoursSpecificationNode {
  readonly '@type': 'OpeningHoursSpecification';
  readonly dayOfWeek: readonly string[];
  readonly opens: string;
  readonly closes: string;
}

/** Schema.org day-of-week URLs in OSM order so an OSM tag maps 1:1. */
const SCHEMA_DAY_OF_WEEK: Readonly<Record<string, string>> = {
  Mo: 'https://schema.org/Monday',
  Tu: 'https://schema.org/Tuesday',
  We: 'https://schema.org/Wednesday',
  Th: 'https://schema.org/Thursday',
  Fr: 'https://schema.org/Friday',
  Sa: 'https://schema.org/Saturday',
  Su: 'https://schema.org/Sunday',
};

const WEEKDAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
type WeekdayToken = (typeof WEEKDAY_ORDER)[number];

const OSM_RULE_REGEX =
  /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+([0-1]?\d|2[0-3]):([0-5]\d)-([0-1]?\d|2[0-3]):([0-5]\d)$/u;

function normaliseTime(h: string, m: string): string {
  return `${h.padStart(2, '0')}:${m}`;
}

function expandDayRange(start: WeekdayToken, end: WeekdayToken | null): readonly WeekdayToken[] {
  if (end === null) return [start];
  const s = WEEKDAY_ORDER.indexOf(start);
  const e = WEEKDAY_ORDER.indexOf(end);
  if (s < 0 || e < 0) return [];
  if (s <= e) return WEEKDAY_ORDER.slice(s, e + 1);
  // Wrap-around — uncommon in our data but legal in OSM.
  return [...WEEKDAY_ORDER.slice(s), ...WEEKDAY_ORDER.slice(0, e + 1)];
}

/**
 * Converts a raw OSM `opening_hours` tag into one or more
 * `OpeningHoursSpecification` nodes — exactly the shape Google's
 * Hotel + LocalBusiness rich-result documentation prescribes.
 *
 * Supported shapes (same subset as `apps/web/src/lib/poi-hours.ts`):
 *   - `24/7`                                  → all-week, 00:00–23:59
 *   - `Mo-Fr 09:00-19:00`                    → one node, 5 dayOfWeek
 *   - `Mo-Sa 08:00-20:00; Su closed`         → one node + Sunday dropped
 *   - `Mo-Fr 09:00-12:00, 14:00-19:00`       → two nodes (lunch break)
 *
 * Returns `[]` when the tag is empty / unparseable — the JSON-LD
 * builder then omits the property entirely (better signal than a
 * malformed node).
 */
export function buildOpeningHoursSpecification(
  raw: string | null | undefined,
): readonly OpeningHoursSpecificationNode[] {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  if (trimmed === '24/7') {
    return [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: WEEKDAY_ORDER.map((d) => SCHEMA_DAY_OF_WEEK[d] ?? d),
        opens: '00:00',
        closes: '23:59',
      },
    ];
  }

  // Build a per-day map of intervals so we can merge consecutive days
  // sharing the same time ranges into a compact `dayOfWeek[]`.
  const dayIntervals = new Map<WeekdayToken, Array<{ opens: string; closes: string }>>();
  for (const day of WEEKDAY_ORDER) dayIntervals.set(day, []);

  // Split on `;` for rules, `,` for parallel intervals inside one rule.
  const rules = trimmed
    .split(';')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  for (const rule of rules) {
    // Strip out explicit closures (drop the affected days).
    const closedMatch =
      /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(?:off|closed)$/iu.exec(rule);
    if (closedMatch !== null) {
      const start = closedMatch[1] as WeekdayToken;
      const end = (closedMatch[2] as WeekdayToken | undefined) ?? null;
      for (const day of expandDayRange(start, end)) {
        dayIntervals.set(day, []);
      }
      continue;
    }

    // Split parallel intervals — `Mo-Fr 09:00-12:00, 14:00-19:00`.
    const dayRangeMatch = /^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(.+)$/u.exec(rule);
    if (dayRangeMatch === null) continue;
    const start = dayRangeMatch[1] as WeekdayToken;
    const end = (dayRangeMatch[2] as WeekdayToken | undefined) ?? null;
    const tail = dayRangeMatch[3];
    if (tail === undefined) continue;
    const intervals: Array<{ opens: string; closes: string }> = [];
    for (const piece of tail.split(',').map((p) => p.trim())) {
      const full = `Mo ${piece}`;
      const m = OSM_RULE_REGEX.exec(full);
      if (m === null) continue;
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
      const opens = normaliseTime(fromH, fromM);
      const closes = normaliseTime(untilH, untilM);
      if (opens >= closes) continue;
      intervals.push({ opens, closes });
    }
    if (intervals.length === 0) continue;
    for (const day of expandDayRange(start, end)) {
      dayIntervals.set(day, intervals);
    }
  }

  // Group days that share the exact same interval set → compact output.
  const groupedByIntervals = new Map<
    string,
    { intervals: Array<{ opens: string; closes: string }>; days: WeekdayToken[] }
  >();
  for (const day of WEEKDAY_ORDER) {
    const intervals = dayIntervals.get(day) ?? [];
    if (intervals.length === 0) continue;
    const key = intervals.map((i) => `${i.opens}-${i.closes}`).join('|');
    const existing = groupedByIntervals.get(key);
    if (existing) {
      existing.days.push(day);
    } else {
      groupedByIntervals.set(key, { intervals, days: [day] });
    }
  }

  const out: OpeningHoursSpecificationNode[] = [];
  for (const { intervals, days } of groupedByIntervals.values()) {
    const dayOfWeek = days
      .map((d) => SCHEMA_DAY_OF_WEEK[d])
      .filter((s): s is string => typeof s === 'string');
    if (dayOfWeek.length === 0) continue;
    for (const interval of intervals) {
      out.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek,
        opens: interval.opens,
        closes: interval.closes,
      });
    }
  }
  return out;
}

/**
 * Schema.org `priceRange` is a free-form short string. We accept the
 * editorial conventions used across our briefs:
 *   - `'€'`, `'€€'`, `'€€€'`, `'€€€€'`  → standard symbol scale
 *   - `'€10-€20'`                       → explicit range
 *   - `'À partir de 12 €'`              → already display-formatted
 *
 * The DB CHECK constraint already caps the column at 32 chars; this
 * helper just trims and drops empties so the builder can stay terse.
 */
export function normalisePriceRange(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  return trimmed;
}
