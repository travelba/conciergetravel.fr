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

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import OpenAI from 'openai';
import { z } from 'zod';

import {
  evaluateGalleryAltCategoryCorrespondence,
  evaluatePoiStructuralCorrespondence,
  type PoiStructuralIssue,
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

interface HotelRow {
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly is_published: boolean;
  readonly points_of_interest: unknown;
  readonly gallery_images: unknown;
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
}

function buildCloudinaryUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/w_1280,c_limit,q_auto,f_auto/${publicId}`;
}

function parseArgs(argv: readonly string[]): {
  slug?: string;
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
    publishedOnly: map.has('published-only'),
    vision: map.has('vision'),
    ...(typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
      ? { limit: Number(limitRaw) }
      : {}),
  };
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

async function auditHotel(
  row: HotelRow,
  vision: boolean,
  openai: OpenAI | null,
  cloudName: string | null,
): Promise<HotelPhotoSubjectReport> {
  const poiStructural = evaluatePoiStructuralCorrespondence(row.points_of_interest);
  const galleryStructural = evaluateGalleryAltCategoryCorrespondence(row.gallery_images);

  const poiVisionIssues: PoiVisionIssue[] = [];
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
  }

  return {
    slug: row.slug,
    name: row.name,
    poiStructuralOk: poiStructural.ok,
    poiStructuralTotal: poiStructural.total,
    poiIssues: poiStructural.issues,
    galleryAltIssues: galleryStructural.issues.length,
    poiVisionIssues,
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

  const rows = await selectHotels<HotelRow>(cfg, {
    columns: 'slug,name,city,is_published,points_of_interest,gallery_images',
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
    const report = await auditHotel(row, args.vision, openai, cloudName);
    reports.push(report);

    const poiFail = report.poiIssues.filter((i) => i.code !== 'alt_name_mismatch');
    const hasFail =
      poiFail.length > 0 || report.galleryAltIssues > 0 || report.poiVisionIssues.length > 0;

    if (hasFail || args.slug !== undefined) {
      console.log(`\n── ${report.slug} (${report.name}) ──`);
      if (poiFail.length > 0) {
        for (const issue of poiFail) {
          console.log(`  [POI] ${issue.code}: ${issue.name ?? '?'} — ${issue.detail}`);
        }
      }
      if (report.galleryAltIssues > 0) {
        console.log(`  [GALLERY] ${report.galleryAltIssues} alt/category mismatch(es)`);
      }
      for (const v of report.poiVisionIssues) {
        console.log(
          `  [VISION] ${v.poiName}: detected "${v.detectedSubject}" (${v.confidence}) — ${v.reason}`,
        );
      }
      if (!hasFail) console.log('  ✅ structural + vision OK');
    }
  }

  const poiStructuralFails = reports.filter((r) =>
    r.poiIssues.some((i) => i.code !== 'alt_name_mismatch'),
  ).length;
  const galleryFails = reports.filter((r) => r.galleryAltIssues > 0).length;
  const visionFails = reports.filter((r) => r.poiVisionIssues.length > 0).length;

  console.log('\n=== Photo-subject correspondence audit ===');
  console.log(`Hotels scanned     : ${reports.length}`);
  console.log(`POI structural fail: ${poiStructuralFails}`);
  console.log(`Gallery alt fail   : ${galleryFails}`);
  if (args.vision) console.log(`POI vision fail    : ${visionFails}`);

  await mkdir(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = resolve(RUNS_DIR, `photo-subject-audit-${stamp}.json`);
  await writeFile(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2),
  );
  console.log(`JSON → ${outPath}`);

  if (poiStructuralFails > 0 || galleryFails > 0 || visionFails > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
