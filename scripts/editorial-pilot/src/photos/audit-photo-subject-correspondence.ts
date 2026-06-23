/**
 * audit-photo-subject-correspondence.ts — Layer 1 (structural) + Layer 2 (Vision) photo/subject QA.
 *
 * Ensures POI cards use dedicated `poi-*` assets (never recycled `press-*`),
 * gallery category aligns with alt_fr vocabulary, and (optional) Vision confirms
 * POI pixels match the venue name.
 *
 * CLI
 *   pnpm --filter @mch/editorial-pilot audit:photo-subject -- --slug=prince-de-galles-paris
 *   pnpm --filter @mch/editorial-pilot audit:photo-subject -- --published-only
 *   pnpm --filter @mch/editorial-pilot audit:photo-subject -- --slug=x --vision
 *
 * Skill: photo-pipeline §Photo-subject correspondence · hotel-kit-rollout D13–D14.
 */

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import OpenAI from 'openai';
import { z } from 'zod';

import {
  evaluateGalleryAltCategoryCorrespondence,
  evaluatePoiStructuralCorrespondence,
  evaluateRoomPhotoCoverage,
  type PoiStructuralIssue,
  type RoomPhotoIssue,
} from '@mch/domain/photos';

import { loadPhotoEnv } from './env-photos.js';
import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '../..', 'runs');

const VISION_MODEL = 'gpt-4o-mini-2024-07-18';

const PoiVisionSchema = z.object({
  matches_subject: z.boolean(),
  detected_subject: z.string().min(3).max(200),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().min(5).max(300),
});

const CategoryVisionSchema = z.object({
  matches_category: z.boolean(),
  detected_category: z.string().min(2).max(40),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().min(5).max(300),
});

/**
 * Gallery categories whose section binding is pixel-sensitive: the spa block,
 * dining block, pool/view tiles and room cards filter the gallery by
 * `category`, so a mislabeled photo surfaces the wrong subject. These are the
 * ones worth a Vision pixel re-check. (`lobby`, `exterior`, `detail`,
 * `concierge`, `events` are lower-risk / less section-bound.)
 */
const VISION_CHECKED_CATEGORIES = ['spa', 'dining', 'pool', 'view', 'room'] as const;
/** Cap Vision calls per category per hotel to keep cohort audits cheap. */
const MAX_VISION_PER_CATEGORY = 3;

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly is_published: boolean;
  readonly points_of_interest: unknown;
  readonly gallery_images: unknown;
}

interface RoomRow {
  readonly slug: string | null;
  readonly name_fr: string | null;
  readonly name_en: string | null;
  readonly hero_image: string | null;
  readonly images: unknown;
}

interface GalleryVisionIssue {
  readonly publicId: string;
  readonly declaredCategory: string;
  readonly detectedCategory: string;
  readonly confidence: string;
  readonly reason: string;
}

interface PoiVisionIssue {
  readonly poiName: string;
  readonly imagePublicId: string;
  readonly matchesSubject: boolean;
  readonly detectedSubject: string;
  readonly confidence: string;
  readonly reason: string;
}

interface HotelPhotoSubjectReport {
  readonly slug: string;
  readonly name: string;
  readonly poiStructuralOk: number;
  readonly poiStructuralTotal: number;
  readonly poiIssues: readonly PoiStructuralIssue[];
  readonly galleryAltIssues: number;
  readonly poiVisionIssues: readonly PoiVisionIssue[];
  readonly roomTotal: number;
  readonly roomPhotoIssues: readonly RoomPhotoIssue[];
  readonly galleryVisionIssues: readonly GalleryVisionIssue[];
}

function buildCloudinaryUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/w_1280,c_limit,q_auto,f_auto/${publicId}`;
}

function parseArgs(argv: readonly string[]): {
  slug?: string;
  slugsFile?: string;
  publishedOnly: boolean;
  vision: boolean;
  limit?: number;
} {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const limitRaw = map.get('limit');
  return {
    ...(typeof map.get('slug') === 'string' ? { slug: map.get('slug') as string } : {}),
    ...(typeof map.get('slugs-file') === 'string'
      ? { slugsFile: map.get('slugs-file') as string }
      : {}),
    publishedOnly: map.has('published-only'),
    vision: map.has('vision'),
    ...(typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
      ? { limit: Number(limitRaw) }
      : {}),
  };
}

/**
 * Read a newline-delimited or JSON-array slug list from disk. Used by the
 * `--slugs-file` flag to scope a Vision pass on a precise cohort (e.g. the
 * hotels flagged by the structural gallery-alt heuristic) in one aggregated
 * run instead of clobbering the dated JSON report once per `--slug`.
 */
function readSlugsFile(path: string): string[] {
  const raw = readFileSync(path, 'utf8').trim();
  if (raw.startsWith('[')) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function readPoiName(poi: Record<string, unknown>): string {
  const fr = poi['name_fr'];
  if (typeof fr === 'string' && fr.trim().length > 0) return fr.trim();
  const name = poi['name'];
  if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  return 'POI';
}

function readPoiImageId(poi: Record<string, unknown>): string | null {
  const raw = poi['image_public_id'] ?? poi['imagePublicId'];
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

async function verifyPoiWithVision(
  client: OpenAI,
  cloudName: string,
  poiName: string,
  city: string,
  imagePublicId: string,
): Promise<PoiVisionIssue | null> {
  const url = buildCloudinaryUrl(cloudName, imagePublicId);
  const prompt = `You verify POI card images for a luxury hotel neighbourhood guide.
Expected subject: "${poiName}" in ${city}.
Does the image clearly depict this place, venue or street (NOT a hotel bedroom, bathroom, or unrelated monument)?
Return JSON only:
{ "matches_subject": boolean, "detected_subject": string, "confidence": "high"|"medium"|"low", "reason": string }`;

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url, detail: 'high' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 300,
  });

  const raw = response.choices[0]?.message?.content;
  if (typeof raw !== 'string') return null;
  const parsed = PoiVisionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  if (parsed.data.matches_subject) return null;
  return {
    poiName,
    imagePublicId,
    matchesSubject: parsed.data.matches_subject,
    detectedSubject: parsed.data.detected_subject,
    confidence: parsed.data.confidence,
    reason: parsed.data.reason,
  };
}

/**
 * Vision pixel re-check: does the photo actually depict its declared
 * `category`? Catches the "category=spa but the pixels are a bedroom" failure
 * that the section renderers cannot see (they trust `category`).
 */
async function verifyGalleryCategoryWithVision(
  client: OpenAI,
  cloudName: string,
  publicId: string,
  declaredCategory: string,
): Promise<GalleryVisionIssue | null> {
  const url = buildCloudinaryUrl(cloudName, publicId);
  const prompt = `You verify a luxury-hotel gallery photo's category.
Declared category: "${declaredCategory}".
Allowed categories: exterior, lobby, room, dining, spa, pool, view, detail, concierge, events.
Does the image clearly depict the declared category (e.g. spa = wellness/treatment/hammam/sauna; room = bedroom/suite/bathroom; dining = restaurant/bar/table; pool = swimming pool; view = panorama/landscape from the property)?
Return JSON only:
{ "matches_category": boolean, "detected_category": string, "confidence": "high"|"medium"|"low", "reason": string }`;

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url, detail: 'low' } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 250,
  });

  const raw = response.choices[0]?.message?.content;
  if (typeof raw !== 'string') return null;
  const parsed = CategoryVisionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return null;
  // Only flag confident mismatches — low-confidence noise is not actionable.
  if (parsed.data.matches_category || parsed.data.confidence === 'low') return null;
  return {
    publicId,
    declaredCategory,
    detectedCategory: parsed.data.detected_category,
    confidence: parsed.data.confidence,
    reason: parsed.data.reason,
  };
}

function readGalleryByCategory(gallery: unknown): Map<string, string[]> {
  const byCat = new Map<string, string[]>();
  const items = Array.isArray(gallery) ? gallery : [];
  for (const item of items) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const publicId = rec['public_id'];
    const category = rec['category'];
    if (typeof publicId !== 'string' || publicId.trim().length === 0) continue;
    if (typeof category !== 'string' || category.trim().length === 0) continue;
    const cat = category.toLowerCase().trim();
    if (!(VISION_CHECKED_CATEGORIES as readonly string[]).includes(cat)) continue;
    const list = byCat.get(cat) ?? [];
    if (list.length < MAX_VISION_PER_CATEGORY) list.push(publicId.trim());
    byCat.set(cat, list);
  }
  return byCat;
}

async function fetchHotelRooms(cfg: SupabaseRestConfig, hotelId: string): Promise<RoomRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'slug,name_fr,name_en,hero_image,images');
  params.set('hotel_id', `eq.${hotelId}`);
  const res = await fetch(`${cfg.url}/rest/v1/hotel_rooms?${params.toString()}`, {
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return [];
  const json: unknown = await res.json();
  return Array.isArray(json) ? (json as RoomRow[]) : [];
}

async function auditHotel(
  row: HotelRow,
  vision: boolean,
  openai: OpenAI | null,
  cloudName: string | null,
  cfg: SupabaseRestConfig,
): Promise<HotelPhotoSubjectReport> {
  const poiStructural = evaluatePoiStructuralCorrespondence(row.points_of_interest);
  const galleryStructural = evaluateGalleryAltCategoryCorrespondence(row.gallery_images);

  const rooms = await fetchHotelRooms(cfg, row.id);
  const roomCoverage = evaluateRoomPhotoCoverage(rooms);

  const poiVisionIssues: PoiVisionIssue[] = [];
  const galleryVisionIssues: GalleryVisionIssue[] = [];
  if (vision && openai !== null && cloudName !== null) {
    const pois = Array.isArray(row.points_of_interest) ? row.points_of_interest : [];
    for (const item of pois) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const imageId = readPoiImageId(rec);
      if (imageId === null) continue;
      const issue = await verifyPoiWithVision(
        openai,
        cloudName,
        readPoiName(rec),
        row.city ?? 'Paris',
        imageId,
      );
      if (issue !== null) poiVisionIssues.push(issue);
    }

    const byCategory = readGalleryByCategory(row.gallery_images);
    for (const [category, publicIds] of byCategory) {
      for (const publicId of publicIds) {
        const issue = await verifyGalleryCategoryWithVision(openai, cloudName, publicId, category);
        if (issue !== null) galleryVisionIssues.push(issue);
      }
    }
  }

  return {
    slug: row.slug,
    name: row.name,
    poiStructuralOk: poiStructural.ok,
    poiStructuralTotal: poiStructural.total,
    poiIssues: poiStructural.issues,
    galleryAltIssues: galleryStructural.issues.length,
    poiVisionIssues,
    roomTotal: roomCoverage.total,
    roomPhotoIssues: roomCoverage.issues,
    galleryVisionIssues,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();

  const cfg: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const filters: string[] = [];
  if (args.publishedOnly) filters.push('is_published=eq.true');
  if (args.slug !== undefined) filters.push(`slug=eq.${args.slug}`);
  if (args.slugsFile !== undefined) {
    const slugs = readSlugsFile(args.slugsFile);
    if (slugs.length === 0) {
      console.error(`[audit:photo-subject] --slugs-file ${args.slugsFile} yielded no slugs.`);
      process.exitCode = 1;
      return;
    }
    filters.push(`slug=in.(${slugs.join(',')})`);
    console.log(`[audit:photo-subject] scoping ${slugs.length} slugs from ${args.slugsFile}`);
  }

  const rows = await selectHotels<HotelRow>(cfg, {
    columns: 'id,slug,name,city,is_published,points_of_interest,gallery_images',
    filters,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
  });

  if (rows.length === 0) {
    console.error('[audit:photo-subject] No hotels matched filters.');
    process.exitCode = 1;
    return;
  }

  const openai =
    args.vision && process.env['OPENAI_API_KEY'] !== undefined
      ? new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
      : null;
  const cloudName = env.CLOUDINARY_CLOUD_NAME ?? null;

  if (args.vision && (openai === null || cloudName === null)) {
    console.error('[audit:photo-subject] --vision requires OPENAI_API_KEY + CLOUDINARY_CLOUD_NAME');
    process.exitCode = 1;
    return;
  }

  const reports: HotelPhotoSubjectReport[] = [];
  for (const row of rows) {
    const report = await auditHotel(row, args.vision, openai, cloudName, cfg);
    reports.push(report);

    const poiFail = report.poiIssues.filter((i) => i.code !== 'alt_name_mismatch');
    const hasFail =
      poiFail.length > 0 ||
      report.galleryAltIssues > 0 ||
      report.poiVisionIssues.length > 0 ||
      report.roomPhotoIssues.length > 0 ||
      report.galleryVisionIssues.length > 0;

    if (hasFail || args.slug !== undefined) {
      console.log(`\n── ${report.slug} (${report.name}) ──`);
      if (poiFail.length > 0) {
        for (const issue of poiFail) {
          console.log(`  [POI] ${issue.code}: ${issue.name ?? '?'} — ${issue.detail}`);
        }
      }
      if (report.galleryAltIssues > 0) {
        console.log(`  [GALLERY-ALT] ${report.galleryAltIssues} alt/category mismatch(es)`);
      }
      for (const v of report.poiVisionIssues) {
        console.log(
          `  [POI-VISION] ${v.poiName}: detected "${v.detectedSubject}" (${v.confidence}) — ${v.reason}`,
        );
      }
      for (const v of report.galleryVisionIssues) {
        console.log(
          `  [GALLERY-VISION] ${v.publicId}: declared "${v.declaredCategory}" but pixels look like "${v.detectedCategory}" (${v.confidence}) — ${v.reason}`,
        );
      }
      for (const r of report.roomPhotoIssues) {
        console.log(`  [ROOM] no_photo: ${r.name ?? r.slug ?? '?'} — ${r.detail}`);
      }
      if (!hasFail) console.log('  ✅ structural + vision OK');
    }
  }

  const poiStructuralFails = reports.filter((r) =>
    r.poiIssues.some((i) => i.code !== 'alt_name_mismatch'),
  ).length;
  const galleryFails = reports.filter((r) => r.galleryAltIssues > 0).length;
  const visionFails = reports.filter((r) => r.poiVisionIssues.length > 0).length;
  const galleryVisionFails = reports.filter((r) => r.galleryVisionIssues.length > 0).length;
  const roomFails = reports.filter((r) => r.roomPhotoIssues.length > 0).length;

  console.log('\n=== Photo-subject correspondence audit ===');
  console.log(`Hotels scanned       : ${reports.length}`);
  console.log(`POI structural fail  : ${poiStructuralFails}`);
  console.log(`Gallery alt fail     : ${galleryFails}`);
  console.log(`Room no-photo fail   : ${roomFails}`);
  if (args.vision) {
    console.log(`POI vision fail      : ${visionFails}`);
    console.log(`Gallery vision fail  : ${galleryVisionFails}`);
  }

  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = resolve(RUNS_DIR, `photo-subject-audit-${stamp}.json`);
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2),
  );
  console.log(`JSON → ${outPath}`);

  if (
    poiStructuralFails > 0 ||
    galleryFails > 0 ||
    visionFails > 0 ||
    galleryVisionFails > 0 ||
    roomFails > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
