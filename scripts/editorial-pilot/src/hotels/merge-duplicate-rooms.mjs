/**
 * Merge verified duplicate `hotel_rooms` rows (audit 2026-07-02).
 *
 * Two ingestion waves created duplicate room rows on a handful of
 * hotels: a supplier/scrape wave with ENGLISH names in `name_fr`
 * (carrying long_description_fr/en + extra images, but no size/bed)
 * and the kit-rollout wave with FR-canonical names (size/bed/occupancy
 * but no long description). Both render on the fiche AND both expose an
 * indexable `/chambres/<slug>` sub-page (ADR-0009 self-canonical) →
 * duplicate content.
 *
 * Merge contract, per verified pair:
 *   1. canonical row inherits `long_description_fr/en` from the dupe
 *      when the canonical has none — with the dupe's room name replaced
 *      by the canonical name inside the text (the generators name the
 *      room verbatim in the prose);
 *   2. `images` = canonical ∪ dupe (dedup by public_id);
 *   3. dupe row is DELETED (its sub-page 404s; sitemaps read the DB).
 *
 * ONLY the hand-verified pairs below are touched. The broad heuristic
 * audit (`audit-room-duplicates.mjs`) has heavy false positives
 * ("Deluxe Junior Suite" vs "Junior Suite" are DIFFERENT categories) —
 * do not feed its raw output into this script.
 *
 * Usage:
 *   node scripts/editorial-pilot/src/hotels/merge-duplicate-rooms.mjs [--apply]
 *
 * Default is dry-run. `--apply` writes a rollback snapshot to
 * scripts/editorial-pilot/runs/ before mutating.
 */
import fs from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');

// Load the ROOT .env.local first — on this machine apps/web/.env.local
// carries an `sb_publishable_…` key under the SUPABASE_SERVICE_ROLE_KEY
// name (anon-equivalent). Writes through it are silently swallowed by
// RLS: PostgREST returns 2xx with 0 rows affected. The real service
// role JWT lives in the repo-root .env.local.
const readEnv = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const envs = [readEnv('.env.local'), readEnv('apps/web/.env.local')];
const get = (k) => {
  for (const env of envs) {
    const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
    if (m) return m[1].trim().replace(/^"|"$/g, '');
  }
  return null;
};
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
if (!key || !key.startsWith('eyJ')) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not a service-role JWT — refusing to run writes');
}
const baseHeaders = { apikey: key, Authorization: `Bearer ${key}` };

/** Hand-verified duplicate pairs: [hotelSlug, dupeRoomSlug, canonicalRoomSlug] */
const PAIRS = [
  ['les-airelles-gordes', 'superior-room-village-side', 'chambre-superieure-village'],
  ['les-airelles-gordes', 'superior-room-valley-side', 'chambre-superieure-vallee'],
  ['les-airelles-gordes', 'deluxe-room-village-side', 'chambre-deluxe-village'],
  ['les-airelles-gordes', 'deluxe-room-valley-side', 'chambre-deluxe-vallee'],
  ['les-airelles-gordes', 'junior-suite-valley-side', 'junior-suite'],
  ['les-airelles-gordes', 'prestige-junior-suite-valley-side', 'junior-suite-prestige'],
  ['les-airelles-gordes', 'one-bedroom-suite-valley-side', 'suite-a-une-chambre'],
  ['le-tikehau', 'overwater-suite', 'suite-sur-pilotis'],
  // EAST Hong Kong: same room ("Queen, harbour view") ingested twice.
  // The kept row is the English-named one — the other carries an
  // Indonesian supplier label in name_fr ("Kamar Queen Pemandangan
  // Pelabuhan"), worse than English for the FR audience.
  ['east-hong-kong', 'kamar-queen-pemandangan-pelabuhan', 'harbour-view-queen-room'],
];

const hotelIds = new Map();
async function hotelId(slug) {
  if (hotelIds.has(slug)) return hotelIds.get(slug);
  const r = await fetch(`${url}/rest/v1/hotels?slug=eq.${slug}&select=id`, {
    headers: baseHeaders,
  });
  const rows = await r.json();
  if (rows.length !== 1) throw new Error(`hotel not found: ${slug}`);
  hotelIds.set(slug, rows[0].id);
  return rows[0].id;
}

async function fetchRoom(hid, slug) {
  const r = await fetch(
    `${url}/rest/v1/hotel_rooms?hotel_id=eq.${hid}&slug=eq.${slug}&select=*`,
    { headers: baseHeaders },
  );
  const rows = await r.json();
  if (rows.length !== 1) throw new Error(`room not found: ${slug} (hotel ${hid})`);
  return rows[0];
}

function renameInText(text, fromNames, toName) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const from of fromNames) {
    if (typeof from === 'string' && from.length > 0) {
      out = out.split(from).join(toName);
    }
  }
  return out;
}

const snapshot = [];
const actions = [];

for (const [hSlug, dupeSlug, canonSlug] of PAIRS) {
  const hid = await hotelId(hSlug);
  const dupe = await fetchRoom(hid, dupeSlug);
  const canon = await fetchRoom(hid, canonSlug);
  snapshot.push({ hotel: hSlug, dupe, canonical: canon });

  const patch = {};
  if ((canon.long_description_fr ?? '').length === 0 && (dupe.long_description_fr ?? '').length > 0) {
    patch.long_description_fr = renameInText(
      dupe.long_description_fr,
      [dupe.name_fr, dupe.name_en],
      canon.name_fr,
    );
  }
  if ((canon.long_description_en ?? '').length === 0 && (dupe.long_description_en ?? '').length > 0) {
    patch.long_description_en = renameInText(
      dupe.long_description_en,
      [dupe.name_en, dupe.name_fr],
      canon.name_en ?? canon.name_fr,
    );
  }
  const canonImgs = Array.isArray(canon.images) ? canon.images : [];
  const dupeImgs = Array.isArray(dupe.images) ? dupe.images : [];
  const seen = new Set(canonImgs.map((i) => i.public_id));
  const added = dupeImgs.filter((i) => !seen.has(i.public_id));
  if (added.length > 0) patch.images = [...canonImgs, ...added];

  actions.push({ hSlug, hid, dupeSlug, canonSlug, dupeId: dupe.id, canonId: canon.id, patch });
  console.log(
    `${hSlug} :: DELETE ${dupeSlug} -> MERGE into ${canonSlug} | patch keys: ${Object.keys(patch).join(', ') || '(none)'}${patch.images ? ` (+${added.length} img)` : ''}`,
  );
}

if (!APPLY) {
  console.log(`\nDRY-RUN — ${actions.length} pairs ready. Re-run with --apply.`);
  process.exit(0);
}

const runsDir = path.join('scripts', 'editorial-pilot', 'runs');
fs.mkdirSync(runsDir, { recursive: true });
const snapPath = path.join(runsDir, `room-duplicates-backup-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
console.log(`\nSnapshot written: ${snapPath}`);

// `Prefer: return=representation` so an RLS-swallowed write (2xx with
// zero affected rows) fails loudly instead of reporting success.
for (const a of actions) {
  if (Object.keys(a.patch).length > 0) {
    const pr = await fetch(`${url}/rest/v1/hotel_rooms?id=eq.${a.canonId}&select=id`, {
      method: 'PATCH',
      headers: { ...baseHeaders, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(a.patch),
    });
    const patched = pr.ok ? await pr.json() : [];
    if (!pr.ok || patched.length !== 1) {
      throw new Error(`PATCH affected ${patched.length} rows for ${a.canonSlug}: ${pr.status}`);
    }
  }
  const dr = await fetch(`${url}/rest/v1/hotel_rooms?id=eq.${a.dupeId}&select=id`, {
    method: 'DELETE',
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const deleted = dr.ok ? await dr.json() : [];
  if (!dr.ok || deleted.length !== 1) {
    throw new Error(`DELETE affected ${deleted.length} rows for ${a.dupeSlug}: ${dr.status}`);
  }
  console.log(`APPLIED ${a.hSlug} :: ${a.dupeSlug} merged into ${a.canonSlug}`);
}
console.log(`\nDone — ${actions.length} duplicates merged.`);
