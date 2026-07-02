/**
 * Audit — duplicate hotel_rooms rows across ingestion waves.
 *
 * Pattern found on `les-airelles-gordes` (2026-07-02): a first wave
 * (supplier/scrape) inserted rooms with ENGLISH names in `name_fr`
 * (name_fr === name_en, no size/occupancy/bed) and long descriptions;
 * a second wave (kit rollout) inserted the FR-canonical rows with
 * size/bed but no long description. Both render on the fiche and both
 * expose an indexable `/chambres/<slug>` sub-page → duplicate content.
 *
 * Detection: within a hotel, an "EN-orphan" row (name_fr === name_en,
 * size_sqm IS NULL) whose significant-token set matches another row's
 * name_en (exact set match after dropping filler tokens, else unique
 * superset match). Read-only — prints a report.
 *
 * Usage: node scripts/editorial-pilot/src/hotels/audit-room-duplicates.mjs
 */
import fs from 'node:fs';

const env = fs.readFileSync('apps/web/.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^"|"$/g, '') : null;
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
const headers = { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' };

// Page through all rooms (PostgREST caps at 1000 per request).
const rooms = [];
for (let offset = 0; ; offset += 1000) {
  const r = await fetch(
    `${url}/rest/v1/hotel_rooms?select=id,hotel_id,slug,room_code,name_fr,name_en,size_sqm,max_occupancy,bed_type,created_at,long_description_fr,long_description_en,description_fr,description_en,images,hero_image&order=hotel_id,created_at&limit=1000&offset=${offset}`,
    { headers },
  );
  const page = await r.json();
  rooms.push(...page);
  if (page.length < 1000) break;
}
console.log(`total hotel_rooms rows: ${rooms.length}`);

const FILLER = new Set(['side', 'the', 'a', 'an', 'with', 'and']);
const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((t) => t.length > 0 && !FILLER.has(t)));
const setEq = (a, b) => a.size === b.size && [...a].every((t) => b.has(t));
const isSubset = (a, b) => [...a].every((t) => b.has(t));

const byHotel = new Map();
for (const r of rooms) {
  const arr = byHotel.get(r.hotel_id) ?? [];
  arr.push(r);
  byHotel.set(r.hotel_id, arr);
}
console.log(`hotels with rooms: ${byHotel.size}`);

const report = [];
for (const [hotelId, list] of byHotel) {
  if (list.length < 2) continue;
  const orphans = list.filter(
    (r) => norm(r.name_fr) === norm(r.name_en) && r.size_sqm === null,
  );
  const canonicals = list.filter((r) => !orphans.includes(r));
  if (orphans.length === 0 || canonicals.length === 0) continue;

  const pairs = [];
  const claimed = new Set();
  // Pass 1: exact token-set equality against canonical name_en or name_fr.
  for (const o of orphans) {
    const ot = tokens(o.name_fr);
    const hit = canonicals.find(
      (c) => !claimed.has(c.id) && (setEq(ot, tokens(c.name_en)) || setEq(ot, tokens(c.name_fr))),
    );
    if (hit) {
      pairs.push({ orphan: o, canonical: hit, match: 'exact' });
      claimed.add(hit.id);
      claimed.add(o.id);
    }
  }
  // Pass 2: unique superset (orphan tokens ⊇ canonical EN tokens, only 1 candidate).
  for (const o of orphans) {
    if (claimed.has(o.id)) continue;
    const ot = tokens(o.name_fr);
    const cands = canonicals.filter(
      (c) => !claimed.has(c.id) && isSubset(tokens(c.name_en), ot) && tokens(c.name_en).size >= 2,
    );
    if (cands.length === 1) {
      pairs.push({ orphan: o, canonical: cands[0], match: 'superset' });
      claimed.add(cands[0].id);
      claimed.add(o.id);
    }
  }
  const unmatched = orphans.filter((o) => !claimed.has(o.id));
  if (pairs.length > 0 || unmatched.length > 0) {
    report.push({ hotelId, total: list.length, pairs, unmatched });
  }
}

// Resolve hotel slugs for readability.
const ids = report.map((r) => r.hotelId);
const slugById = new Map();
for (let i = 0; i < ids.length; i += 50) {
  const chunk = ids.slice(i, i + 50);
  const r = await fetch(
    `${url}/rest/v1/hotels?id=in.(${chunk.join(',')})&select=id,slug`,
    { headers },
  );
  for (const h of await r.json()) slugById.set(h.id, h.slug);
}

let totalPairs = 0;
let totalUnmatched = 0;
for (const h of report) {
  const slug = slugById.get(h.hotelId) ?? h.hotelId;
  console.log(`\n=== ${slug} (${h.total} rooms) ===`);
  for (const p of h.pairs) {
    totalPairs++;
    console.log(
      `  [${p.match}] DUPE "${p.orphan.name_fr}" (${p.orphan.slug}) -> KEEP "${p.canonical.name_fr}" (${p.canonical.slug})`,
    );
  }
  for (const u of h.unmatched) {
    totalUnmatched++;
    console.log(`  [?] EN-orphan no match: "${u.name_fr}" (${u.slug})`);
  }
}
console.log(`\nSUMMARY: ${report.length} hotels affected, ${totalPairs} mergeable pairs, ${totalUnmatched} unmatched EN-orphans`);
