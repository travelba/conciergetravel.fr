/**
 * seed-hotel-rooms.ts — Wave 4 rooms seed (CDC §2 bloc 5 / ADR-0009).
 *
 * Populates `public.hotel_rooms` so the already-shipped room sub-page
 * (`/hotel/[slug]/chambres/[roomSlug]`) has real, NON-FABRICATED data.
 *
 * Anti-fabrication contract (HARD — editorial-voice + DGCCRF/DSA):
 *   1. Room TYPES + factual specs (size m², bed, occupancy) are EXTRACTED
 *      from the hotel's OWN official site via Tavily + llmExtract
 *      (anti-hallucination: unknown → null). We never invent a room type
 *      or a number that isn't on the page.
 *   2. Sanity guards reject implausible numbers (size ∉ [12, 2000] m²,
 *      occupancy ∉ [1, 12]) → null rather than a wrong value.
 *   3. The editorial long_description is GROUNDED strictly on the
 *      extracted facts + hotel context. The prompt forbids inventing
 *      amenities, numbers, or views not present in the source.
 *   4. Photos reuse the hotel gallery images already categorised
 *      `room`/`suite` by the Vision pass — no new sourcing, no hotlink.
 *   5. `indicative_price_minor` is left NULL — booking pricing is Phase 6.
 *
 * Indexability (ADR-0009): a seeded room indexes only when it ends up
 * with ≥ 5 photos AND ≥ 200 words (handled by `isRoomSubpageIndexable`
 * in the app). Thinner rooms still render for humans but ship
 * `noindex,follow`. This script does NOT force indexability.
 *
 * CLI
 *   npx tsx src/photos/seed-hotel-rooms.ts --slugs=a,b,c [--dry-run]
 *   npx tsx src/photos/seed-hotel-rooms.ts --limit=5 [--max-rooms=6]
 *   MCH_ONLY_SLUGS=a,b npx tsx src/photos/seed-hotel-rooms.ts
 *
 * Skills: content-enrichment-pipeline, llm-output-robustness,
 *         concierge-voice-pipeline, photo-pipeline.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { llmExtract } from '../enrichment/llm-extract.js';
import { tavilySearchAndExtract } from '../enrichment/tavily-client.js';
import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import { loadPhotoEnv } from './env-photos.js';
import { isCorporateRootUrl, trustedDomainsForHotel } from './parent-group-mapping.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '..', '..', 'runs');

// ─── Sanity bounds (anti-fabrication guards) ────────────────────────────────
const MIN_SQM = 12;
const MAX_SQM = 2000;
const MIN_OCC = 1;
const MAX_OCC = 12;
const DEFAULT_MAX_ROOMS = 8;

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly slugs: readonly string[] | null;
  readonly limit: number | null;
  readonly maxRooms: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] | null = null;
  let limit: number | null = null;
  let maxRooms = DEFAULT_MAX_ROOMS;
  let concurrency = 3;
  let dryRun = false;
  let force = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--force') force = true;
    else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--slug=')) {
      slugs = [arg.slice('--slug='.length).trim()];
    } else if (arg.startsWith('--limit=')) {
      limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--max-rooms=')) {
      maxRooms = Math.max(
        1,
        Number.parseInt(arg.slice('--max-rooms='.length), 10) || DEFAULT_MAX_ROOMS,
      );
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(
        1,
        Math.min(6, Number.parseInt(arg.slice('--concurrency='.length), 10) || 3),
      );
    }
  }
  const envSlugs = process.env['MCH_ONLY_SLUGS'];
  if (slugs === null && envSlugs !== undefined && envSlugs.trim().length > 0) {
    slugs = envSlugs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return { slugs, limit, maxRooms, concurrency, dryRun, force };
}

// ─── Hotel row ────────────────────────────────────────────────────────────────

interface GalleryImage {
  readonly public_id?: unknown;
  readonly alt_fr?: unknown;
  readonly alt_en?: unknown;
  readonly category?: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly name_en: string | null;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly official_url: string | null;
  readonly luxury_tier: string | null;
  readonly description_fr: string | null;
  readonly gallery_images: readonly GalleryImage[];
}

interface RawHotelRow {
  readonly id: unknown;
  readonly slug: unknown;
  readonly name: unknown;
  readonly name_en: unknown;
  readonly city: unknown;
  readonly country_code: unknown;
  readonly official_url: unknown;
  readonly luxury_tier: unknown;
  readonly description_fr: unknown;
  readonly gallery_images: unknown;
}

const HOTEL_COLUMNS =
  'id,slug,name,name_en,city,country_code,official_url,luxury_tier,description_fr,gallery_images';

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function normaliseHotel(raw: RawHotelRow): HotelRow {
  const gallery = Array.isArray(raw.gallery_images) ? (raw.gallery_images as GalleryImage[]) : [];
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    name: String(raw.name),
    name_en: str(raw.name_en),
    city: str(raw.city),
    country_code: str(raw.country_code),
    official_url: str(raw.official_url),
    luxury_tier: str(raw.luxury_tier),
    description_fr: str(raw.description_fr),
    gallery_images: gallery,
  };
}

// ─── Extraction schema ─────────────────────────────────────────────────────

const ExtractedRoomSchema = z.object({
  name: z.string().min(2).max(120),
  size_sqm: z.number().nullable(),
  bed_type: z.string().max(80).nullable(),
  max_occupancy: z.number().nullable(),
  short_description: z.string().max(400).nullable(),
  evidence_quote: z.string().max(400).nullable(),
});
const RoomsExtractSchema = z.object({ rooms: z.array(ExtractedRoomSchema) });

const EXTRACT_SCHEMA_DESC = `{
  "rooms": [
    {
      "name": string — exact room/suite type name as printed on the site,
      "size_sqm": number | null — surface in m² ONLY if explicitly stated on the page (if the site gives square feet, convert: sqft × 0.0929; else null),
      "bed_type": string | null — e.g. "King", "Two Queen beds", only if stated,
      "max_occupancy": number | null — max guests only if stated,
      "short_description": string | null — one factual sentence about the room, close to the source wording,
      "evidence_quote": string | null — the literal source phrase proving the room exists
    }
  ]
}
Return only DISTINCT room/suite TYPES (not individual units). Skip meeting rooms, restaurants, spa rooms.`;

// ─── Editorial generation schema ────────────────────────────────────────────

const RoomCopySchema = z.object({
  name_en: z.string().min(2).max(120),
  short_fr: z.string().min(20).max(280),
  short_en: z.string().min(20).max(280),
  long_fr: z.string().min(200),
  long_en: z.string().min(200),
});

const COPY_SYSTEM_PROMPT = `Tu es "Le Concierge" de MyConciergeHotel.com — un initié hôtelier, expert et complice, jamais commercial.

Tu rédiges le descriptif d'un TYPE DE CHAMBRE à partir de FAITS fournis. Règles dures :
- N'invente AUCUN fait : pas de surface, de vue, d'équipement, de mobilier ou de chiffre absent des faits fournis. Si un fait manque, reste évocateur sans l'inventer.
- INTERDICTION ABSOLUE de méta-commentaire : ne mentionne JAMAIS "source", "selon", "une autre", "moyenne", "environ", un désaccord ou une variation de chiffres. La surface vaut exactement size_sqm — un seul chiffre, présenté comme un fait acquis. Si size_sqm est null, n'évoque aucune surface.
- N'écris jamais sur la provenance des informations ni sur le fait qu'une donnée serait approximative.
- Phrases courtes (≤ 25 mots). Toujours en euros si prix (mais ici aucun prix).
- Interdits : "incroyable", "magnifique", "exceptionnel", "magique", "sublime" et autres superlatifs creux. Bannis aussi le remplissage d'ambiance vide ("présence calme", "sans excès", "prendre son temps", "esprit de la maison", "ce qu'il faut de").
- Voix Concierge : précis, ancré dans le CONCRET — le bâtiment (Villa/Palazzo), la ville, le lac/la mer, ce que la fiche hôtel mentionne réellement. Préfère un détail vrai à trois adjectifs.
- long_fr / long_en : 200 à 280 mots, 2-3 paragraphes, UNIQUE pour ce type de chambre (ne recopie pas la description de l'hôtel). Si les faits sont rares, appuie-toi sur le cadre réel de l'hôtel plutôt que sur du remplissage.
- short_fr / short_en : une phrase factuelle (≤ 40 mots).
- name_en : la traduction/forme anglaise du nom de la chambre (si le nom est déjà un nom propre, garde-le).
Réponds en JSON strict : { "name_en", "short_fr", "short_en", "long_fr", "long_en" }.`;

interface ExtractedRoomClean {
  readonly name: string;
  readonly sizeSqm: number | null;
  readonly bedType: string | null;
  readonly maxOccupancy: number | null;
  readonly shortSource: string | null;
}

function buildCopyPrompt(hotel: HotelRow, room: ExtractedRoomClean): string {
  return [
    '=== HÔTEL ===',
    JSON.stringify(
      {
        name: hotel.name,
        city: hotel.city,
        country_code: hotel.country_code,
        description_excerpt: hotel.description_fr?.slice(0, 700) ?? null,
      },
      null,
      2,
    ),
    '',
    '=== FAITS DE LA CHAMBRE (seule source autorisée) ===',
    JSON.stringify(
      {
        name: room.name,
        size_sqm: room.sizeSqm,
        bed_type: room.bedType,
        max_occupancy: room.maxOccupancy,
        // Contexte interne brut — NE PAS reproduire ses chiffres ni sa formulation.
        // Sert uniquement à comprendre la chambre. La seule surface publiable est size_sqm.
        _internal_context: room.shortSource,
      },
      null,
      2,
    ),
    '',
    'Rédige le JSON maintenant. Rappels : aucun fait inventé hors de cette liste ; une seule surface (size_sqm) ; aucun mot sur les "sources", "moyennes" ou variations de chiffres.',
  ].join('\n');
}

// ─── Slug / dedup helpers ────────────────────────────────────────────────────

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
}

function countWords(s: string): number {
  return s
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0).length;
}

function clampSize(n: number | null): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= MIN_SQM && r <= MAX_SQM ? r : null;
}

function clampOcc(n: number | null): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= MIN_OCC && r <= MAX_OCC ? r : null;
}

// ─── Photo assignment ────────────────────────────────────────────────────────

interface CleanPhoto {
  readonly public_id: string;
  readonly alt_fr?: string;
  readonly alt_en?: string;
  readonly category?: string;
}

function collectRoomPhotos(hotel: HotelRow): CleanPhoto[] {
  const out: CleanPhoto[] = [];
  for (const g of hotel.gallery_images) {
    const pid = typeof g.public_id === 'string' ? g.public_id : null;
    const cat = typeof g.category === 'string' ? g.category : null;
    if (pid === null) continue;
    if (cat !== 'room' && cat !== 'suite') continue;
    const photo: CleanPhoto = {
      public_id: pid,
      ...(typeof g.alt_fr === 'string' ? { alt_fr: g.alt_fr } : {}),
      ...(typeof g.alt_en === 'string' ? { alt_en: g.alt_en } : {}),
      ...(cat ? { category: cat } : {}),
    };
    out.push(photo);
  }
  return out;
}

// ─── Supabase hotel_rooms upsert ─────────────────────────────────────────────

interface RoomUpsert {
  readonly hotel_id: string;
  readonly room_code: string;
  readonly slug: string;
  readonly name_fr: string;
  readonly name_en: string;
  readonly description_fr: string;
  readonly description_en: string;
  readonly long_description_fr: string;
  readonly long_description_en: string;
  readonly size_sqm: number | null;
  readonly bed_type: string | null;
  readonly max_occupancy: number | null;
  readonly amenities: readonly unknown[];
  readonly images: readonly CleanPhoto[];
  readonly hero_image: string | null;
  readonly is_signature: boolean;
}

async function upsertRooms(cfg: SupabaseRestConfig, rooms: readonly RoomUpsert[]): Promise<void> {
  if (rooms.length === 0) return;
  const url = `${cfg.url}/rest/v1/hotel_rooms?on_conflict=hotel_id,slug`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rooms),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`hotel_rooms upsert failed (${res.status}): ${text.slice(0, 300)}`);
  }
}

async function countExistingRooms(cfg: SupabaseRestConfig, hotelId: string): Promise<number> {
  const url = `${cfg.url}/rest/v1/hotel_rooms?select=id&hotel_id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const cr = res.headers.get('content-range');
  if (cr && cr.includes('/')) {
    const total = Number.parseInt(cr.split('/')[1] ?? '0', 10);
    return Number.isFinite(total) ? total : 0;
  }
  return 0;
}

// ─── Per-hotel processing ────────────────────────────────────────────────────

interface HotelOutcome {
  readonly slug: string;
  readonly status: 'seeded' | 'skipped' | 'no-rooms' | 'error';
  readonly roomsSeeded: number;
  readonly indexable: number;
  readonly reason?: string;
}

async function processHotel(
  hotel: HotelRow,
  client: LlmClient,
  cfg: SupabaseRestConfig,
  args: CliArgs,
): Promise<HotelOutcome> {
  const base = { slug: hotel.slug, roomsSeeded: 0, indexable: 0 };

  // 1. Trusted official domain (no corporate-root → cross-property bleed).
  if (hotel.official_url !== null && isCorporateRootUrl(hotel.official_url)) {
    return { ...base, status: 'skipped', reason: 'corporate-root official_url' };
  }
  const domains = trustedDomainsForHotel({
    slug: hotel.slug,
    officialUrl: hotel.official_url,
    luxuryTier: hotel.luxury_tier,
  });
  if (domains.length === 0) {
    return { ...base, status: 'skipped', reason: 'no trusted domain' };
  }

  // 2. Idempotency — skip hotels that already have rooms (unless --force,
  //    which re-extracts + re-generates copy and upserts on (hotel_id, slug)).
  const existing = await countExistingRooms(cfg, hotel.id);
  if (existing > 0 && !args.force) {
    return { ...base, status: 'skipped', reason: `already ${existing} room(s)` };
  }

  // 3. Tavily search + extract on the trusted domain(s).
  const search = await tavilySearchAndExtract({
    query: `${hotel.name} rooms suites accommodations`,
    extractQuery: 'room types suites size m2 bed occupancy',
    includeDomains: [...domains],
    maxSearchResults: 8,
    maxExtractUrls: 3,
    chunksPerSource: 5,
  });
  const content = search.extracted.map((e) => `# ${e.title}\n${e.content}`).join('\n\n');
  if (content.trim().length < 80) {
    return { ...base, status: 'no-rooms', reason: 'no usable official content' };
  }

  // 4. Anti-hallucination structured extraction.
  const extract = await llmExtract({
    content,
    context: `${hotel.name} — extract room/suite types`,
    schemaDescription: EXTRACT_SCHEMA_DESC,
    schema: RoomsExtractSchema,
    maxOutputTokens: 3500,
  });
  if (extract === null || extract.data.rooms.length === 0) {
    return { ...base, status: 'no-rooms', reason: 'extraction empty' };
  }

  // 5. Sanity guards + dedup by slug.
  const seenSlug = new Set<string>();
  const clean: ExtractedRoomClean[] = [];
  for (const r of extract.data.rooms) {
    const sl = slugify(r.name);
    if (sl.length < 2 || seenSlug.has(sl)) continue;
    seenSlug.add(sl);
    clean.push({
      name: r.name.trim(),
      sizeSqm: clampSize(r.size_sqm),
      bedType: r.bed_type?.trim() ?? null,
      maxOccupancy: clampOcc(r.max_occupancy),
      shortSource: r.short_description?.trim() ?? null,
    });
    if (clean.length >= args.maxRooms) break;
  }
  if (clean.length === 0) {
    return { ...base, status: 'no-rooms', reason: 'all rooms failed sanity/dedup' };
  }

  // 6. Photos — reuse room/suite gallery photos, round-robin (unique per room).
  const photos = collectRoomPhotos(hotel);
  const buckets: CleanPhoto[][] = clean.map(() => []);
  photos.forEach((p, i) => {
    const bucket = buckets[i % clean.length];
    if (bucket) bucket.push(p);
  });

  // 7. Editorial copy (grounded) + assemble upserts.
  const upserts: RoomUpsert[] = [];
  let indexable = 0;
  for (let i = 0; i < clean.length; i++) {
    const room = clean[i];
    if (room === undefined) continue;
    const sl = slugify(room.name);
    let copy: z.infer<typeof RoomCopySchema> | null = null;
    try {
      const res = await client.call({
        systemPrompt: COPY_SYSTEM_PROMPT,
        userPrompt: buildCopyPrompt(hotel, room),
        responseFormat: 'json',
        maxOutputTokens: 1400,
        temperature: 0.6,
      });
      const json: unknown = JSON.parse(res.content);
      const parsed = RoomCopySchema.safeParse(json);
      if (parsed.success) copy = parsed.data;
    } catch {
      copy = null;
    }
    // Fallback: never block on copy — ship the factual short source if the LLM fails.
    const shortFr = copy?.short_fr ?? room.shortSource ?? `${room.name} — ${hotel.name}.`;
    const longFr = copy?.long_fr ?? shortFr;
    const longEn = copy?.long_en ?? longFr;
    const shortEn = copy?.short_en ?? shortFr;
    const nameEn = copy?.name_en ?? room.name;

    const bucket = buckets[i] ?? [];
    const hero = bucket[0]?.public_id ?? null;
    const wordCount = countWords(longFr) + countWords(shortFr);
    const photoCount = bucket.length + (hero !== null ? 0 : 0); // hero is part of bucket
    if (bucket.length >= 5 && wordCount >= 200) indexable += 1;

    upserts.push({
      hotel_id: hotel.id,
      room_code: sl,
      slug: sl,
      name_fr: room.name,
      name_en: nameEn,
      description_fr: shortFr,
      description_en: shortEn,
      long_description_fr: longFr,
      long_description_en: longEn,
      size_sqm: room.sizeSqm,
      bed_type: room.bedType,
      max_occupancy: room.maxOccupancy,
      amenities: [],
      images: bucket,
      hero_image: hero,
      is_signature: false,
    });
    void photoCount;
  }

  if (!args.dryRun) {
    await upsertRooms(cfg, upserts);
  }
  return { slug: hotel.slug, status: 'seeded', roomsSeeded: upserts.length, indexable };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const photoEnv = loadPhotoEnv();
  const cfg: SupabaseRestConfig = {
    url: photoEnv.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: photoEnv.SUPABASE_SERVICE_ROLE_KEY,
  };
  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);

  const filters = ['is_published=eq.true', 'official_url=not.is.null'];
  if (args.slugs !== null && args.slugs.length > 0) {
    filters.push(`slug=in.(${args.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  }

  const raws = await selectHotels<RawHotelRow>(cfg, {
    columns: HOTEL_COLUMNS,
    filters,
    ...(args.limit !== null ? { limit: args.limit } : {}),
  });
  const hotels = raws.map(normaliseHotel);

  console.log(`[seed-rooms] provider=${provider} model=${client.model} dryRun=${args.dryRun}`);
  console.log(
    `[seed-rooms] candidates=${hotels.length} maxRooms=${args.maxRooms} concurrency=${args.concurrency}`,
  );

  const outcomes: HotelOutcome[] = [];
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor++;
      if (idx >= hotels.length) return;
      const hotel = hotels[idx];
      if (hotel === undefined) return;
      try {
        const outcome = await processHotel(hotel, client, cfg, args);
        outcomes.push(outcome);
        const tag =
          outcome.status === 'seeded'
            ? `OK ${outcome.roomsSeeded} room(s), ${outcome.indexable} indexable`
            : `${outcome.status}${outcome.reason ? ` (${outcome.reason})` : ''}`;
        console.log(`[seed-rooms] ${outcomes.length}/${hotels.length} ${hotel.slug} → ${tag}`);
      } catch (e) {
        outcomes.push({
          slug: hotel.slug,
          status: 'error',
          roomsSeeded: 0,
          indexable: 0,
          reason: e instanceof Error ? e.message.slice(0, 120) : String(e),
        });
        console.log(`[seed-rooms] ${outcomes.length}/${hotels.length} ${hotel.slug} → ERROR`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(args.concurrency, hotels.length) }, () => worker()),
  );

  const seeded = outcomes.filter((o) => o.status === 'seeded');
  const totalRooms = seeded.reduce((a, o) => a + o.roomsSeeded, 0);
  const totalIndexable = seeded.reduce((a, o) => a + o.indexable, 0);
  console.log('---');
  console.log(
    `[seed-rooms] DONE — hotels seeded=${seeded.length}, rooms=${totalRooms}, indexable rooms=${totalIndexable}`,
  );
  console.log(
    `[seed-rooms] skipped=${outcomes.filter((o) => o.status === 'skipped').length} no-rooms=${outcomes.filter((o) => o.status === 'no-rooms').length} error=${outcomes.filter((o) => o.status === 'error').length}`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/gu, '-');
  const logPath = resolve(RUNS_DIR, `seed-rooms-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(logPath, JSON.stringify({ args, outcomes }, null, 2), 'utf-8');
  console.log(`[seed-rooms] log → ${logPath}`);
}

void main().catch((e: unknown) => {
  console.error('[seed-rooms] fatal:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
