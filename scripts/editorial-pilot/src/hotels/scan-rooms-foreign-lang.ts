/**
 * Read-only scanner for residual Spanish/Italian supplier text in `hotel_rooms`.
 *
 * RateHawk/Travelport room ingestion occasionally persists localized bed
 * configuration strings ("1 cama extragrande", "letto matrimoniale") straight
 * into `name_fr/name_en/description_fr/description_en`. This scanner locates
 * every affected row so a deterministic patch can fix the DATA (not the render).
 *
 * PostgREST only (no pg). Read-only — never writes.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PILOT_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PILOT_ROOT, '../..');

loadDotenv({ path: resolve(REPO_ROOT, '.env.local') });
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

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

/**
 * Distinctive Spanish/Italian tokens that do NOT collide with French room
 * vocabulary. Deliberately conservative — `grande`, `suite`, `junior` are
 * shared across FR/ES/IT and excluded to avoid false positives.
 */
const FOREIGN_MARKERS: readonly { readonly lang: 'es' | 'it'; readonly re: RegExp }[] = [
  // Spanish
  { lang: 'es', re: /\bcama(s)?\b/iu },
  { lang: 'es', re: /\bextragrande\b/iu },
  { lang: 'es', re: /\bhabitaci[óo]n\b/iu },
  { lang: 'es', re: /\bba[ñn]o\b/iu },
  { lang: 'es', re: /\bcon vistas?\b/iu },
  { lang: 'es', re: /\bmatrimonial\b/iu },
  // NOTE: "individual" is a legitimate English word (individual design/décor/
  // suites) — NOT a reliable Spanish marker. Excluded to avoid false positives.
  { lang: 'es', re: /\bdoble\b/iu },
  { lang: 'es', re: /\bpies cuadrados\b/iu },
  // Italian
  { lang: 'it', re: /\bletto\b/iu },
  { lang: 'it', re: /\bmatrimoniale\b/iu },
  { lang: 'it', re: /\bcon vista\b/iu },
  { lang: 'it', re: /\bbagno\b/iu },
  // NOTE: bare "camera" is legitimate English ("security camera") — only the
  // unambiguous compound is a marker; real Italian names trip letto/doppia/
  // matrimoniale anyway. Mirrors patch-rooms-foreign-lang.ts.
  { lang: 'it', re: /\bcamer[ae]\s+da\s+letto\b/iu },
  { lang: 'it', re: /\bdoppia\b/iu },
  { lang: 'it', re: /\bletti\b/iu },
];

interface Hit {
  readonly roomId: string;
  readonly hotelId: string;
  readonly field: 'name_fr' | 'name_en' | 'description_fr' | 'description_en';
  readonly lang: 'es' | 'it';
  readonly marker: string;
  readonly value: string;
}

function scanRoom(room: Room): Hit[] {
  const hits: Hit[] = [];
  const fields: (keyof Pick<Room, 'name_fr' | 'name_en' | 'description_fr' | 'description_en'>)[] =
    ['name_fr', 'name_en', 'description_fr', 'description_en'];
  for (const field of fields) {
    const value = room[field];
    if (value === null || value.trim() === '') continue;
    for (const { lang, re } of FOREIGN_MARKERS) {
      const m = re.exec(value);
      if (m) {
        hits.push({
          roomId: room.id,
          hotelId: room.hotel_id,
          field,
          lang,
          marker: m[0],
          value,
        });
        break; // one hit per field is enough to flag it
      }
    }
  }
  return hits;
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
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SELECT hotel_rooms failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const page = z.array(RoomSchema).parse(await res.json());
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function resolveHotelSlugs(
  url: string,
  key: string,
  hotelIds: readonly string[],
): Promise<Map<string, { slug: string; name: string; country: string | null }>> {
  const map = new Map<string, { slug: string; name: string; country: string | null }>();
  const chunkSize = 50;
  for (let i = 0; i < hotelIds.length; i += chunkSize) {
    const chunk = hotelIds.slice(i, i + chunkSize);
    const endpoint = new URL('/rest/v1/hotels', url);
    endpoint.searchParams.set('select', 'id,slug,name,country_code');
    endpoint.searchParams.set('id', `in.(${chunk.join(',')})`);
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) continue;
    const parsed = z
      .array(
        z.object({
          id: z.string(),
          slug: z.string(),
          name: z.string(),
          country_code: z.string().nullable(),
        }),
      )
      .parse(await res.json());
    for (const h of parsed) map.set(h.id, { slug: h.slug, name: h.name, country: h.country_code });
  }
  return map;
}

async function main(): Promise<void> {
  const env = EnvSchema.parse(process.env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/u, '');
  const rooms = await fetchAllRooms(url, env.SUPABASE_SERVICE_ROLE_KEY);
  console.log(`[scan-rooms] fetched ${rooms.length} hotel_rooms rows`);

  const allHits = rooms.flatMap(scanRoom);
  const affectedHotelIds = [...new Set(allHits.map((h) => h.hotelId))];
  const hotelMap = await resolveHotelSlugs(url, env.SUPABASE_SERVICE_ROLE_KEY, affectedHotelIds);

  const byHotel = new Map<string, Hit[]>();
  for (const hit of allHits) {
    const list = byHotel.get(hit.hotelId) ?? [];
    list.push(hit);
    byHotel.set(hit.hotelId, list);
  }

  console.log(
    `[scan-rooms] ${allHits.length} field-hits across ${byHotel.size} hotels / ${new Set(allHits.map((h) => h.roomId)).size} rooms\n`,
  );

  const sorted = [...byHotel.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [hotelId, hits] of sorted) {
    const meta = hotelMap.get(hotelId);
    const label = meta ? `${meta.slug} (${meta.country ?? '??'})` : hotelId;
    console.log(`── ${label} — ${hits.length} hit(s)`);
    for (const h of hits.slice(0, 8)) {
      console.log(`   [${h.lang}] ${h.field} «${h.marker}» → ${h.value.slice(0, 90)}`);
    }
  }

  if (process.argv.includes('--dump')) {
    const distinct = [...new Set(allHits.map((h) => h.value))].sort();
    const { writeFile } = await import('node:fs/promises');
    const out = resolve(PILOT_ROOT, 'runs', `rooms-foreign-lang-distinct-${Date.now()}.json`);
    await writeFile(out, JSON.stringify(distinct, null, 2), 'utf8');
    console.log(`\n[scan-rooms] ${distinct.length} distinct foreign strings → ${out}`);
  }
}

main().catch((err: unknown) => {
  console.error('[scan-rooms] FATAL', err);
  process.exit(1);
});
