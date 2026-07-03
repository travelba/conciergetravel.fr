/**
 * Deterministic ES/IT → FR/EN patcher for supplier-localized `hotel_rooms` text.
 *
 * RateHawk/Travelport room ingestion persisted localized room names + bed
 * configuration ("Habitación Doble con vistas al mar", "Camera Matrimoniale con
 * Vista Mare", "lit extragrande") into `name_fr/name_en/description_fr/
 * description_en`. This corrects the DATA at the source (not the render) using
 * a controlled-vocabulary glossary.
 *
 * SAFETY — clean-or-skip: a field is rewritten ONLY if the translated result
 * carries zero residual foreign marker (Spanish/Italian tokens + Spanish-only
 * accents). Any partial/unknown string is left untouched and reported for a
 * manual pass. Proper nouns (St. Regis, Signature, Four Seasons, Anjung…) are
 * never in the glossary, so they pass through verbatim.
 *
 * PostgREST only. Dry-run by default; --apply writes + per-row verifies and
 * snapshots a rollback backup under runs/.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');
const RUNS_DIR = resolve(PILOT_ROOT, 'runs');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

// ─── Foreign-language detection gate ─────────────────────────────────────────
// Distinctive ES/IT tokens with no French/English collision, plus Spanish-only
// accented characters (French uses à/â/é/è/ê/ë/î/ï/ô/û/ù/ç but NOT ñ/í/ó/á/ú).
const FOREIGN_MARKERS: readonly RegExp[] = [
  /[ñíóáú]/u,
  /\bhabitaci[óo]n\b/iu,
  /\bcama(s)?\b/iu,
  /\bextragrande\b/iu,
  /\bcon vistas?\b/iu,
  /\bvistas?\s+(?:al|a la|a los)\b/iu,
  /\bdormitorios?\b/iu,
  /\bba[ñn]o\b/iu,
  /\bmayordomo\b/iu,
  /\bdoble\b/iu,
  /\bedificio\b/iu,
  /\bdise[ñn]o\b/iu,
  /\bdosel\b/iu,
  // Italian — NOTE: bare `camera`/`camere` are NOT markers ("security camera"
  // is legitimate English). Only the unambiguous compounds are, plus the
  // co-occurrence check in hasForeignMarker below.
  /\bcamer[ae]\s+da\s+letto\b/iu,
  /\bletto\b/iu,
  /\bletti\b/iu,
  /\bmatrimoniale\b/iu,
  /\bdoppia\b/iu,
  /\bsingoli\b/iu,
  /\bcon vista\b/iu,
  /\bbalcone\b/iu,
  /\bterrazza\b/iu,
  /\bquadrupla\b/iu,
  /\btripla\b/iu,
  /\baccesso\b/iu,
  /\blivelli\b/iu,
];

// `camera`/`camere` are Italian room nouns AND legitimate English ("security
// camera", "CCTV camera"). Treat them as Italian ONLY when another Italian
// token co-occurs in the same text (letto, matrimoniale, doppia, vista…).
const ITALIAN_CONTEXT_RE =
  /\blett[oi]\b|\bmatrimoniale\b|\bdoppia\b|\bsingol[aei]\b|\btripla\b|\bquadrupla\b|\bcon vista\b|\bvista (?:mare|oceano|città|giardino|piscina)\b|\bterrazza\b|\bbalcone\b|\blivelli\b|\bcamer[ae]\s+da\s+letto\b/iu;

export function isItalianContext(text: string): boolean {
  return ITALIAN_CONTEXT_RE.test(text);
}

export function hasForeignMarker(text: string): boolean {
  if (FOREIGN_MARKERS.some((re) => re.test(text))) return true;
  return /\bcamer[ae]\b/iu.test(text) && isItalianContext(text);
}

// ─── Glossary (ordered: longest / most specific first) ───────────────────────
interface Rule {
  readonly re: RegExp;
  readonly fr: string;
  readonly en: string;
  /** Apply only when the ORIGINAL text carries unambiguous Italian tokens. */
  readonly italianContextOnly?: boolean;
}

/** Build a case-insensitive, unicode, global regex for a literal phrase. */
function phrase(literal: string): RegExp {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(escaped, 'giu');
}

const RULES: readonly Rule[] = [
  // ── View phrases (most specific first) ──
  {
    re: phrase('con vistas al centro de la ciudad'),
    fr: 'avec vue sur le centre-ville',
    en: 'with city-centre views',
  },
  {
    re: phrase('con vistas al puerto deportivo'),
    fr: 'avec vue sur la marina',
    en: 'with marina views',
  },
  {
    re: phrase('con vistas al campo de golf'),
    fr: 'avec vue sur le golf',
    en: 'with golf-course views',
  },
  {
    re: phrase('con vistas al parque natural'),
    fr: 'avec vue sur le parc naturel',
    en: 'with nature-park views',
  },
  {
    re: phrase('con vistas a la iglesia de'),
    fr: "avec vue sur l'église",
    en: 'with views of the church of',
  },
  {
    re: phrase('con vistas al gran canal'),
    fr: 'avec vue sur le Grand Canal',
    en: 'with Grand Canal views',
  },
  { re: phrase('con vistas a la ciudad'), fr: 'avec vue sur la ville', en: 'with city views' },
  { re: phrase('con vistas a la costa'), fr: 'avec vue sur la côte', en: 'with coast views' },
  { re: phrase('con vistas al mar'), fr: 'avec vue sur la mer', en: 'with sea views' },
  { re: phrase('con vistas al océano'), fr: "avec vue sur l'océan", en: 'with ocean views' },
  { re: phrase('con vistas al oceano'), fr: "avec vue sur l'océan", en: 'with ocean views' },
  { re: phrase('con vistas al canal'), fr: 'avec vue sur le canal', en: 'with canal views' },
  { re: phrase('con vistas al río'), fr: 'avec vue sur le fleuve', en: 'with river views' },
  { re: phrase('con vistas al rio'), fr: 'avec vue sur le fleuve', en: 'with river views' },
  { re: phrase('con vistas al jardín'), fr: 'avec vue sur le jardin', en: 'with garden views' },
  { re: phrase('con vistas al jardin'), fr: 'avec vue sur le jardin', en: 'with garden views' },
  { re: phrase('con vistas al parque'), fr: 'avec vue sur le parc', en: 'with park views' },
  { re: phrase('con vistas al complejo'), fr: 'avec vue sur le complexe', en: 'with resort views' },
  { re: phrase('con vistas parciales'), fr: 'avec vue partielle', en: 'with partial views' },
  // Generic "con vistas a/al/a la/a los" fallbacks (after the specific phrases,
  // before the bare "con vistas") — resolve any dangling Spanish preposition.
  { re: phrase('con vistas a los'), fr: 'avec vue sur les', en: 'with views of' },
  { re: phrase('con vistas a las'), fr: 'avec vue sur les', en: 'with views of' },
  { re: phrase('con vistas a la'), fr: 'avec vue sur la', en: 'with views of' },
  { re: phrase('con vistas al'), fr: 'avec vue sur le', en: 'with views of' },
  { re: phrase('con vistas a'), fr: 'avec vue sur', en: 'with views of' },
  { re: phrase('con vistas'), fr: 'avec vue', en: 'with views' },
  // Bare "vistas al <noun>" (no preceding "con" — e.g. after "y vistas al …").
  // These translate the noun so no Spanish token is stranded.
  {
    re: phrase('vistas al centro de la ciudad'),
    fr: 'vue sur le centre-ville',
    en: 'city-centre views',
  },
  { re: phrase('vistas al puerto deportivo'), fr: 'vue sur la marina', en: 'marina views' },
  { re: phrase('vistas a la ciudad'), fr: 'vue sur la ville', en: 'city views' },
  { re: phrase('vistas a la costa'), fr: 'vue sur la côte', en: 'coast views' },
  { re: phrase('vistas al complejo'), fr: 'vue sur le complexe', en: 'resort views' },
  { re: phrase('vistas al mar'), fr: 'vue sur la mer', en: 'sea views' },
  { re: phrase('vistas al océano'), fr: "vue sur l'océan", en: 'ocean views' },
  { re: phrase('vistas al oceano'), fr: "vue sur l'océan", en: 'ocean views' },
  { re: phrase('vistas al canal'), fr: 'vue sur le canal', en: 'canal views' },
  { re: phrase('vistas al río'), fr: 'vue sur le fleuve', en: 'river views' },
  { re: phrase('vistas al rio'), fr: 'vue sur le fleuve', en: 'river views' },
  { re: phrase('vistas al jardín'), fr: 'vue sur le jardin', en: 'garden views' },
  { re: phrase('vistas al jardin'), fr: 'vue sur le jardin', en: 'garden views' },
  { re: phrase('vistas al parque'), fr: 'vue sur le parc', en: 'park views' },
  { re: phrase('frente al océano'), fr: "face à l'océan", en: 'oceanfront' },
  { re: phrase('frente al oceano'), fr: "face à l'océan", en: 'oceanfront' },
  { re: phrase('frente al río'), fr: 'face au fleuve', en: 'riverfront' },
  { re: phrase('frente al rio'), fr: 'face au fleuve', en: 'riverfront' },
  { re: phrase('frente al mar'), fr: 'face à la mer', en: 'seafront' },
  // ── Italian view phrases ──
  { re: phrase('con vista mare'), fr: 'avec vue sur la mer', en: 'with sea view' },
  { re: phrase('con vista oceano'), fr: "avec vue sur l'océan", en: 'with ocean view' },
  { re: phrase('con vista piscina'), fr: 'avec vue sur la piscine', en: 'with pool view' },
  { re: phrase('con vista giardino'), fr: 'avec vue sur le jardin', en: 'with garden view' },
  { re: phrase('con vista città'), fr: 'avec vue sur la ville', en: 'with city view' },
  { re: phrase('con vista palme'), fr: 'avec vue sur les palmiers', en: 'with palm views' },
  { re: phrase('con vista spiaggia'), fr: 'avec vue sur la plage', en: 'with beach view' },
  { re: phrase('vista mare'), fr: 'vue mer', en: 'sea view' },
  { re: phrase('vista oceano'), fr: 'vue océan', en: 'ocean view' },
  { re: phrase('vista palme'), fr: 'vue palmiers', en: 'palm views' },
  { re: phrase('con vista'), fr: 'avec vue', en: 'with view' },
  // ── Bed configuration ──
  {
    re: phrase('1 cama extragrande o 2 camas individiduales'),
    fr: '1 lit king-size ou 2 lits simples',
    en: '1 king bed or 2 single beds',
  },
  {
    re: phrase('1 cama extragrande o 2 camas individuales'),
    fr: '1 lit king-size ou 2 lits simples',
    en: '1 king bed or 2 single beds',
  },
  { re: phrase('2 camas grandes'), fr: '2 grands lits', en: '2 large beds' },
  { re: phrase('1 cama extragrande'), fr: '1 lit king-size', en: '1 king-size bed' },
  { re: phrase('cama extragrande'), fr: 'lit king-size', en: 'king-size bed' },
  { re: phrase('1 cama grande'), fr: '1 grand lit', en: '1 large bed' },
  { re: phrase('cama grande'), fr: 'grand lit', en: 'large bed' },
  { re: phrase('cama con dosel'), fr: 'lit à baldaquin', en: 'four-poster bed' },
  { re: phrase('camas individuales'), fr: 'lits simples', en: 'single beds' },
  { re: phrase('2 camas'), fr: '2 lits', en: '2 beds' },
  { re: phrase('1 o 2 camas'), fr: '1 ou 2 lits', en: '1 or 2 beds' },
  { re: phrase('camas'), fr: 'lits', en: 'beds' },
  { re: phrase('cama'), fr: 'lit', en: 'bed' },
  { re: phrase('lit extragrande'), fr: 'lit king-size', en: 'king-size bed' },
  // ── Italian beds ──
  {
    re: phrase('matrimoniale/doppia con letti singoli'),
    fr: 'lit double ou lits jumeaux',
    en: 'double or twin',
  },
  { re: phrase('su 2 livelli'), fr: 'sur deux niveaux', en: 'split-level' },
  { re: phrase('su 3 livelli'), fr: 'sur trois niveaux', en: 'three-level' },
  { re: phrase('doppia con letti singoli'), fr: 'double à lits jumeaux', en: 'twin' },
  { re: phrase('con letti singoli'), fr: 'à lits jumeaux', en: 'with twin beds' },
  { re: phrase('letti singoli'), fr: 'lits simples', en: 'single beds' },
  { re: phrase('letto king-size'), fr: 'lit king-size', en: 'king-size bed' },
  { re: phrase('letto queen size'), fr: 'lit queen-size', en: 'queen-size bed' },
  // NOTE: the bare `letto`/`letti` → `lit`/`lits` rules live AFTER the
  // "camere da letto" compound rules below, otherwise they strand `Camere`.
  // ── Bedroom counts ──
  { re: phrase('de 2 dormitorios'), fr: 'de deux chambres', en: 'two-bedroom' },
  { re: phrase('de 3 dormitorios'), fr: 'de trois chambres', en: 'three-bedroom' },
  { re: phrase('de 1 dormitorio'), fr: "d'une chambre", en: 'one-bedroom' },
  { re: phrase('dormitorios'), fr: 'chambres', en: 'bedrooms' },
  { re: phrase('dormitorio'), fr: 'chambre', en: 'bedroom' },
  {
    re: phrase('con 3 camere da letto e vista spiaggia'),
    fr: 'à trois chambres avec vue sur la plage',
    en: 'three-bedroom with beach view',
  },
  { re: phrase('con 3 camere da letto'), fr: 'à trois chambres', en: 'three-bedroom' },
  {
    re: phrase('con 2 camere da letto e vista oceano'),
    fr: "à deux chambres avec vue sur l'océan",
    en: 'two-bedroom with ocean view',
  },
  { re: phrase('con 2 camere da letto'), fr: 'à deux chambres', en: 'two-bedroom' },
  {
    re: phrase('con 2 letti, piscina e vista oceano'),
    fr: "à 2 lits, piscine et vue sur l'océan",
    en: 'with 2 beds, pool and ocean view',
  },
  { re: phrase('con 1 camera da letto'), fr: 'à une chambre', en: 'one-bedroom' },
  { re: phrase('camere da letto'), fr: 'chambres', en: 'bedrooms' },
  { re: phrase('camera da letto'), fr: 'chambre', en: 'bedroom' },
  // Bare Italian bed nouns — AFTER the "camere da letto" compounds above.
  { re: phrase('letto'), fr: 'lit', en: 'bed' },
  { re: phrase('letti'), fr: 'lits', en: 'beds' },
  // ── Amenities / attributes ──
  { re: phrase('servicio de mayordomo'), fr: 'service de majordome', en: 'butler service' },
  { re: phrase('edificio independiente'), fr: 'bâtiment indépendant', en: 'separate building' },
  {
    re: phrase('con acceso al club lounge'),
    fr: 'avec accès au club lounge',
    en: 'with club lounge access',
  },
  { re: phrase('acceso al club lounge'), fr: 'accès au club lounge', en: 'club lounge access' },
  { re: phrase('con accesso disabili'), fr: 'accès PMR', en: 'wheelchair accessible' },
  { re: phrase('accesso lounge'), fr: 'accès lounge', en: 'lounge access' },
  { re: phrase('con piscina privada'), fr: 'avec piscine privée', en: 'with private pool' },
  { re: phrase('con terraza'), fr: 'avec terrasse', en: 'with terrace' },
  { re: phrase('con terrazza'), fr: 'avec terrasse', en: 'with terrace' },
  { re: phrase('con balcone'), fr: 'avec balcon', en: 'with balcony' },
  { re: phrase('con hammam'), fr: 'avec hammam', en: 'with hammam' },
  { re: phrase('con patio'), fr: 'avec patio', en: 'with patio' },
  { re: phrase('más amplia'), fr: 'plus spacieuse', en: 'larger' },
  { re: phrase('mas amplia'), fr: 'plus spacieuse', en: 'larger' },
  { re: phrase('con terraza'), fr: 'avec terrasse', en: 'with terrace' },
  { re: phrase('de diseño'), fr: 'design', en: 'designer' },
  { re: phrase('con terraza'), fr: 'avec terrasse', en: 'with terrace' },
  { re: phrase('terrazza'), fr: 'terrasse', en: 'terrace' },
  { re: phrase('balcone'), fr: 'balcon', en: 'balcony' },
  { re: phrase('accesso'), fr: 'accès', en: 'access' },
  // ── Room-type nouns / qualifiers ──
  { re: phrase('habitación'), fr: 'Chambre', en: 'Room' },
  { re: phrase('habitacion'), fr: 'Chambre', en: 'Room' },
  // "camera"/"camere" are also legitimate English ("security camera") —
  // rewrite them only when the source text is unambiguously Italian.
  { re: phrase('camere'), fr: 'Chambres', en: 'Rooms', italianContextOnly: true },
  { re: phrase('camera'), fr: 'Chambre', en: 'Room', italianContextOnly: true },
  { re: phrase('quadrupla'), fr: 'Quadruple', en: 'Quadruple' },
  { re: phrase('tripla'), fr: 'Triple', en: 'Triple' },
  { re: phrase('matrimoniale'), fr: 'Double', en: 'Double' },
  { re: phrase('doppia'), fr: 'Double', en: 'Double' },
  { re: phrase('doble'), fr: 'Double', en: 'Double' },
  { re: phrase('familiar'), fr: 'Familiale', en: 'Family' },
  { re: phrase('estándar'), fr: 'Standard', en: 'Standard' },
  { re: phrase('estandar'), fr: 'Standard', en: 'Standard' },
  { re: phrase('exclusiva'), fr: 'Exclusive', en: 'Exclusive' },
  { re: phrase('principal'), fr: 'Principale', en: 'Main' },
  { re: phrase('ático'), fr: 'Penthouse', en: 'Penthouse' },
  { re: phrase('atico'), fr: 'Penthouse', en: 'Penthouse' },
  { re: phrase('comunicante'), fr: 'communicante', en: 'connecting' },
  // ── Connectors (last) ──
  { re: /\s+y\s+/giu, fr: ' et ', en: ' and ' },
  { re: /\s+o\s+/giu, fr: ' ou ', en: ' or ' },
  { re: /\s+e\s+/giu, fr: ' et ', en: ' and ' },
  { re: /\bcon\b/giu, fr: 'avec', en: 'with' },
];

type Locale = 'fr' | 'en';

export function translateRoomText(input: string, locale: Locale): string {
  const italian = isItalianContext(input);
  let out = input;
  for (const rule of RULES) {
    if (rule.italianContextOnly === true && !italian) continue;
    out = out.replace(rule.re, locale === 'fr' ? rule.fr : rule.en);
  }
  // Tidy separators + whitespace introduced by replacements.
  out = out
    .replace(/\s{2,}/gu, ' ')
    .replace(/\s+([,.])/gu, '$1')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .replace(/\s+-\s+-\s+/gu, ' - ')
    .trim();
  return out;
}

// ─── DB ──────────────────────────────────────────────────────────────────────
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
});

const RoomSchema = z.object({
  id: z.string(),
  hotel_id: z.string(),
  slug: z.string().nullable(),
  name_fr: z.string().nullable(),
  name_en: z.string().nullable(),
  description_fr: z.string().nullable(),
  description_en: z.string().nullable(),
});
type Room = z.infer<typeof RoomSchema>;

const FIELDS = ['name_fr', 'name_en', 'description_fr', 'description_en'] as const;
type Field = (typeof FIELDS)[number];

interface FieldChange {
  readonly field: Field;
  readonly before: string;
  readonly after: string;
}
interface RoomPlan {
  readonly room: Room;
  readonly changes: FieldChange[];
  readonly skipped: { readonly field: Field; readonly value: string }[];
}

function localeOf(field: Field): Locale {
  return field.endsWith('_en') ? 'en' : 'fr';
}

export function buildRoomPlan(room: Room): RoomPlan {
  const changes: FieldChange[] = [];
  const skipped: { field: Field; value: string }[] = [];
  for (const field of FIELDS) {
    const value = room[field];
    if (value === null || value.trim() === '' || !hasForeignMarker(value)) continue;
    const translated = translateRoomText(value, localeOf(field));
    if (translated === value) {
      skipped.push({ field, value });
      continue;
    }
    if (hasForeignMarker(translated)) {
      skipped.push({ field, value });
      continue; // clean-or-skip: incomplete translation, leave for manual pass
    }
    changes.push({ field, before: value, after: translated });
  }
  return { room, changes, skipped };
}

async function fetchAllRooms(url: string, key: string): Promise<Room[]> {
  const rows: Room[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const endpoint = new URL('/rest/v1/hotel_rooms', url);
    endpoint.searchParams.set(
      'select',
      'id,hotel_id,slug,name_fr,name_en,description_fr,description_en',
    );
    endpoint.searchParams.set('order', 'id.asc');
    endpoint.searchParams.set('limit', String(pageSize));
    endpoint.searchParams.set('offset', String(offset));
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok)
      throw new Error(
        `SELECT hotel_rooms failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    const page = z.array(RoomSchema).parse(await res.json());
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function patchRoom(url: string, key: string, plan: RoomPlan): Promise<void> {
  const body: Record<string, string> = {};
  for (const c of plan.changes) body[c.field] = c.after;
  const endpoint = new URL('/rest/v1/hotel_rooms', url);
  endpoint.searchParams.set('id', `eq.${plan.room.id}`);
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(
      `PATCH ${plan.room.id} failed (${res.status}): ${(await res.text()).slice(0, 300)}`,
    );
}

async function verifyRoom(url: string, key: string, plan: RoomPlan): Promise<boolean> {
  const endpoint = new URL('/rest/v1/hotel_rooms', url);
  endpoint.searchParams.set('select', FIELDS.join(','));
  endpoint.searchParams.set('id', `eq.${plan.room.id}`);
  const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const [row] = (await res.json()) as Record<Field, string | null>[];
  if (!row) return false;
  return plan.changes.every((c) => row[c.field] === c.after);
}

interface Args {
  readonly apply: boolean;
  readonly limit: number | null;
}
function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : null;
  return { apply, limit: limit !== null && Number.isFinite(limit) ? limit : null };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const env = EnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const rooms = await fetchAllRooms(url, env.SUPABASE_SERVICE_ROLE_KEY);

  const allPlans = rooms.map(buildRoomPlan);
  let planned = allPlans.filter((p) => p.changes.length > 0);
  if (args.limit !== null) planned = planned.slice(0, args.limit);
  const skippedRooms = allPlans.filter((p) => p.changes.length === 0 && p.skipped.length > 0);

  const fieldCounts: Record<Field, number> = {
    name_fr: 0,
    name_en: 0,
    description_fr: 0,
    description_en: 0,
  };
  for (const p of planned) for (const c of p.changes) fieldCounts[c.field] += 1;

  console.log(
    `[patch-rooms-foreign-lang] rooms=${rooms.length} planned=${planned.length} skipped=${skippedRooms.length} apply=${args.apply}`,
  );
  console.log(`  field changes: ${JSON.stringify(fieldCounts)}`);
  for (const p of planned.slice(0, 12)) {
    for (const c of p.changes) {
      console.log(`  · ${p.room.slug ?? p.room.id} [${c.field}]`);
      console.log(`      - ${c.before.slice(0, 110)}`);
      console.log(`      + ${c.after.slice(0, 110)}`);
    }
  }
  if (skippedRooms.length > 0) {
    console.log(
      `\n  ${skippedRooms.length} room(s) skipped (incomplete/unknown glossary → manual):`,
    );
    for (const p of skippedRooms.slice(0, 15)) {
      for (const s of p.skipped)
        console.log(`    ! ${p.room.slug ?? p.room.id} [${s.field}] ${s.value.slice(0, 90)}`);
    }
  }

  const generatedAt = new Date().toISOString();
  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = generatedAt.replace(/[:.]/gu, '-');
  await writeFile(
    resolve(RUNS_DIR, `rooms-foreign-lang-${args.apply ? 'apply' : 'dry'}-${stamp}.json`),
    JSON.stringify(
      {
        generatedAt,
        apply: args.apply,
        fieldCounts,
        planned: planned.map((p) => ({ id: p.room.id, slug: p.room.slug, changes: p.changes })),
        skipped: skippedRooms.map((p) => ({
          id: p.room.id,
          slug: p.room.slug,
          skipped: p.skipped,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!args.apply) return;

  let applied = 0;
  let verified = 0;
  for (const plan of planned) {
    await patchRoom(url, env.SUPABASE_SERVICE_ROLE_KEY, plan);
    applied += 1;
    if (await verifyRoom(url, env.SUPABASE_SERVICE_ROLE_KEY, plan)) verified += 1;
    else console.error(`  VERIFY FAILED ${plan.room.slug ?? plan.room.id}`);
  }
  console.log(`[patch-rooms-foreign-lang] applied=${applied} verified=${verified}`);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().catch((err: unknown) => {
    console.error('[patch-rooms-foreign-lang] FATAL', err);
    process.exit(1);
  });
}
