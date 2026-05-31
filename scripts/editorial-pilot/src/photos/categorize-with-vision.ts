/**
 * categorize-with-vision.ts — Wave 0 batch that classifies every
 * uncategorised photo in `hotels.gallery_images` with GPT-4o-mini Vision,
 * writing `category` + enriched `alt_fr/en` + `caption_fr/en` +
 * `quality_score`, and dropping photos the model rejects (keep=false).
 *
 * Goal: push published hotels toward the 10-category CDC coverage floor
 * (photo-quality.mdc) so the indexability gate can flip them to
 * photo-rich. We NEVER fabricate a category — every value comes from a
 * Vision call on the real Cloudinary asset.
 *
 * Eligibility (default): published hotels with a non-empty gallery that
 * either have photos without a category OR cover < 10 CDC categories.
 * `--force` re-classifies everything. `--dry-run` skips the Supabase write.
 *
 * Requires OPENAI_API_KEY + CLOUDINARY_CLOUD_NAME + Supabase service role.
 *
 * Skill: photo-pipeline, photo-quality-seo-geo-agentique, llm-output-robustness.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import OpenAI from 'openai';
import { z } from 'zod';

import { selectHotels, type SupabaseRestConfig } from './supabase-rest.js';
import { loadPhotoEnv } from './env-photos.js';
import {
  VISION_CATEGORIES,
  coverageCount,
  hotelNeedsCategorisation,
  hotelNeedsScores,
  imagesNeedingCategory,
  imagesNeedingScores,
  mergeVisionAnswers,
  type GalleryImage,
  type VisionAnswer,
} from './gallery-coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '../..', 'runs');

const VISION_MODEL = 'gpt-4o-mini-2024-07-18';

const VisionAnswerSchema = z.object({
  category: z.enum(VISION_CATEGORIES),
  alt_fr: z.string().min(10).max(120),
  alt_en: z.string().min(10).max(120),
  caption_fr: z.string().min(20).max(160),
  caption_en: z.string().min(20).max(160),
  quality_score: z.number().int().min(1).max(10),
  representativeness: z.number().int().min(1).max(10),
  hero_suitable: z.boolean(),
  keep: z.boolean(),
  reason_if_drop: z.string().max(160).nullable(),
});

const VISION_PROMPT = `Tu es un editor photo qui prepare la fiche d'un hotel de luxe pour MyConciergeHotel.com. Voici une photo (URL ci-dessous) destinee a la galerie de "{HOTEL_NAME}" a {HOTEL_CITY}.

Renvoie un JSON strict (et SEULEMENT ce JSON, sans backticks) avec:
- category: une seule valeur parmi: exterior | lobby | room | suite | dining | spa | pool | view | detail | concierge | events | other
- alt_fr: 10-120 caracteres, voix Concierge. Format: "[Adjectif descriptif] {HOTEL_NAME} {HOTEL_CITY}". Pas de superlatifs (incroyable, magnifique, exceptionnel). Pas de "photo de". Decris ce qu'on voit.
- alt_en: meme exigence, en anglais.
- caption_fr: 20-160 caracteres, phrase complete auto-explicative pour un JSON-LD ImageObject.
- caption_en: meme exigence, en anglais.
- quality_score: entier 1-10. Qualite TECHNIQUE uniquement (nettete, composition, eclairage, absence de parasites, resolution).
- representativeness: entier 1-10. A quel point cette photo communique INSTANTANEMENT le caractere et la tendance de l'hotel (signature architecturale, vue iconique, ambiance distinctive, identite du lieu). Une chambre generique ou un detail anonyme = bas; une facade emblematique, une piscine signature ou une vue iconique = haut. C'est distinct de quality_score: une photo nette mais banale a un bon quality_score et une representativeness basse.
- hero_suitable: boolean. true si la photo peut servir d'IMAGE PRINCIPALE de la fiche: cadrage large (paysage 3:2 ou 16:9), sujet emblematique qui donne d'emblee la tendance de l'hotel, pas de gros plan de detail, pas de portrait vertical etroit. false sinon.
- keep: boolean. false UNIQUEMENT si: floue, voiture/parking/rue non architecturale, screenshot, touristes/personnel en gros plan, capture de site, filigrane visible, image clairement non-hotel.
- reason_if_drop: si keep=false, raison courte (10-160 chars). Sinon null.`;

interface HotelPhotoRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: readonly GalleryImage[] | null;
}

interface Args {
  readonly slug?: string;
  readonly slugs?: readonly string[];
  readonly limit?: number;
  readonly dryRun: boolean;
  readonly includeDrafts: boolean;
  readonly force: boolean;
  /**
   * Re-classify only photos missing the `representativeness` score (the
   * resumable "run on everything" mode). Cheaper than `--force` because
   * already-scored photos are skipped, so a crashed run never re-pays.
   */
  readonly backfillScores: boolean;
  readonly concurrency: number;
  readonly maxPhotosPerHotel?: number;
}

function parseArgs(argv: readonly string[]): Args {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  const num = (k: string): number | undefined => {
    const v = map.get(k);
    return typeof v === 'string' && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  const concRaw = num('concurrency');
  const limitRaw = num('limit');
  const maxPhotosRaw = num('max-photos');
  const slugsRaw = map.get('slugs');
  const slugRaw = map.get('slug');
  const out: Args = {
    dryRun: map.has('dry-run'),
    includeDrafts: map.has('include-drafts'),
    force: map.has('force'),
    backfillScores: map.has('backfill-scores'),
    concurrency: concRaw !== undefined ? Math.min(6, Math.max(1, concRaw)) : 3,
    ...(typeof slugRaw === 'string' ? { slug: slugRaw } : {}),
    ...(limitRaw !== undefined ? { limit: limitRaw } : {}),
    ...(maxPhotosRaw !== undefined ? { maxPhotosPerHotel: maxPhotosRaw } : {}),
  };
  if (typeof slugsRaw === 'string') {
    const list = slugsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length > 0) return { ...out, slugs: list };
  }
  return out;
}

function buildCloudinaryUrl(cloudName: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/w_1600,c_limit,q_auto,f_auto/${publicId}`;
}

/**
 * Persist the full gallery jsonb (preserving every field, incl. caption_*
 * and quality_score). The narrow `updateHotelPhotos` helper would strip
 * those, so we PATCH directly.
 */
async function patchGallery(
  cfg: SupabaseRestConfig,
  hotelId: string,
  gallery: readonly GalleryImage[],
): Promise<void> {
  const url = `${cfg.url}/rest/v1/hotels?id=eq.${encodeURIComponent(hotelId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ gallery_images: gallery }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[vision] PATCH gallery failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

async function classifyPhoto(
  client: OpenAI,
  cloudName: string,
  hotelName: string,
  hotelCity: string,
  publicId: string,
): Promise<{
  answer: VisionAnswer | null;
  inputTokens: number;
  outputTokens: number;
  error: string | null;
}> {
  const url = buildCloudinaryUrl(cloudName, publicId);
  const prompt = VISION_PROMPT.replaceAll('{HOTEL_NAME}', hotelName).replaceAll(
    '{HOTEL_CITY}',
    hotelCity,
  );
  try {
    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      max_completion_tokens: 600,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url, detail: 'high' } },
          ],
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return { answer: null, inputTokens, outputTokens, error: 'json-parse-failed' };
    }
    const parsed = VisionAnswerSchema.safeParse(json);
    if (!parsed.success) {
      return {
        answer: null,
        inputTokens,
        outputTokens,
        error: parsed.error.issues
          .slice(0, 2)
          .map((i) => `${i.path.join('.')}:${i.message}`)
          .join('|'),
      };
    }
    return { answer: parsed.data, inputTokens, outputTokens, error: null };
  } catch (err) {
    return {
      answer: null,
      inputTokens: 0,
      outputTokens: 0,
      error: (err as Error).message.slice(0, 160),
    };
  }
}

interface PerHotelResult {
  readonly slug: string;
  readonly name: string;
  readonly classified: number;
  readonly dropped: number;
  readonly coverageBefore: number;
  readonly coverageAfter: number;
  readonly errors: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly skipped?: string;
  readonly failed?: string;
}

/** Classify a hotel's pending photos with a small intra-hotel concurrency. */
async function runOnHotel(
  client: OpenAI,
  supabase: SupabaseRestConfig,
  cloudName: string,
  row: HotelPhotoRow,
  args: Args,
): Promise<PerHotelResult> {
  const gallery = row.gallery_images ?? [];
  const base = { slug: row.slug, name: row.name, coverageBefore: coverageCount(gallery) };
  try {
    // Target selection:
    //  - --force          → every photo (full re-classification)
    //  - --backfill-scores → photos missing a representativeness score
    //                        (a superset of "missing category", since a row
    //                        without a category was never scored either) —
    //                        resumable, so a crashed run never re-pays
    //  - default          → photos missing a category
    const targets = args.force
      ? gallery
      : args.backfillScores
        ? // Only re-score photos with a usable Cloudinary public_id. Legacy
          // pre-Cloudinary rows store the image under `url` with no
          // `public_id` (forbidden-CDN scrapes) — sending those to OpenAI
          // just 404s. They belong to the Phase-2 re-sourcing chantier.
          imagesNeedingScores(gallery).filter(
            (img) => typeof img.public_id === 'string' && img.public_id.trim().length > 0,
          )
        : imagesNeedingCategory(gallery);
    const capped =
      args.maxPhotosPerHotel !== undefined ? targets.slice(0, args.maxPhotosPerHotel) : targets;
    if (capped.length === 0) {
      return {
        ...base,
        classified: 0,
        dropped: 0,
        coverageAfter: base.coverageBefore,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        skipped: 'all-categorised',
      };
    }

    const answers = new Map<string, VisionAnswer>();
    let errors = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    // Photos within a hotel run sequentially (Cloudinary + OpenAI rate-friendly);
    // hotel-level concurrency is handled by the outer pool.
    for (const photo of capped) {
      const res = await classifyPhoto(client, cloudName, row.name, row.city ?? '', photo.public_id);
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
      if (res.answer === null) {
        errors++;
        continue;
      }
      answers.set(photo.public_id, res.answer);
    }

    const merged = mergeVisionAnswers(gallery, answers);
    const coverageAfter = coverageCount(merged.gallery);

    if (!args.dryRun && merged.classified > 0) {
      await patchGallery(supabase, row.id, merged.gallery);
    }

    return {
      ...base,
      classified: merged.classified,
      dropped: merged.dropped.length,
      coverageAfter,
      errors,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    return {
      ...base,
      classified: 0,
      dropped: 0,
      coverageAfter: base.coverageBefore,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      failed: (err as Error).message.slice(0, 160),
    };
  }
}

function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number, last: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  return new Promise((resolveAll, rejectAll) => {
    const launchNext = (): void => {
      const myIndex = cursor++;
      if (myIndex >= total) return;
      const item = items[myIndex];
      if (item === undefined) return;
      fn(item, myIndex)
        .then((res) => {
          results[myIndex] = res;
          done++;
          if (onProgress) onProgress(done, total, res);
          if (done === total) resolveAll(results);
          else launchNext();
        })
        .catch(rejectAll);
    };
    if (total === 0) resolveAll([]);
    else for (let i = 0; i < Math.min(limit, total); i++) launchNext();
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined) {
    throw new Error('[vision] CLOUDINARY_CLOUD_NAME missing — required to build photo URLs.');
  }
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.length < 20) {
    throw new Error('[vision] OPENAI_API_KEY missing or invalid.');
  }

  const supabase: SupabaseRestConfig = {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  console.log(
    `[vision] dryRun=${args.dryRun} concurrency=${args.concurrency} limit=${args.limit ?? '∞'} force=${args.force} backfillScores=${args.backfillScores} maxPhotos=${args.maxPhotosPerHotel ?? '∞'}`,
  );

  const filters: string[] = [];
  if (!args.includeDrafts) filters.push('is_published=eq.true');
  if (args.slug !== undefined) filters.push(`slug=eq.${encodeURIComponent(args.slug)}`);
  if (args.slugs !== undefined) {
    filters.push(`slug=in.(${args.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  }
  filters.push('gallery_images=not.is.null');

  const rows = await selectHotels<HotelPhotoRow>(supabase, {
    columns: 'id,slug,name,city,hero_image,gallery_images',
    filters,
    order: 'slug.asc',
  });

  const eligible = rows.filter((r) => {
    const g = r.gallery_images ?? [];
    if (hotelNeedsCategorisation(g, { force: args.force })) return true;
    // In backfill mode, a fully-categorised hotel is still eligible if any
    // photo lacks the newer representativeness/hero_suitable scores.
    return args.backfillScores && hotelNeedsScores(g);
  });
  const targets = args.limit !== undefined ? eligible.slice(0, args.limit) : eligible;

  console.log(
    `[vision] fetched=${rows.length} eligible=${eligible.length} processing=${targets.length}`,
  );
  if (targets.length === 0) {
    console.log('[vision] nothing to do.');
    return;
  }

  const client = new OpenAI({ apiKey, timeout: 120_000, maxRetries: 2 });
  const startedAt = Date.now();
  const results = await withConcurrency(
    targets,
    args.concurrency,
    (row) => runOnHotel(client, supabase, cloudName, row, args),
    (doneCount, total, last) => {
      const status = last.failed
        ? `FAIL: ${last.failed.slice(0, 60)}`
        : last.skipped
          ? `SKIP (${last.skipped})`
          : `cls=${last.classified} drop=${last.dropped} cov ${last.coverageBefore}→${last.coverageAfter} err=${last.errors}`;
      console.log(`[vision] ${doneCount}/${total} ${last.slug} → ${status}`);
    },
  );

  const elapsedMs = Date.now() - startedAt;
  const classifiedTotal = results.reduce((a, r) => a + r.classified, 0);
  const droppedTotal = results.reduce((a, r) => a + r.dropped, 0);
  const reachedFloor = results.filter((r) => r.coverageAfter >= 10).length;
  const totalIn = results.reduce((a, r) => a + r.inputTokens, 0);
  const totalOut = results.reduce((a, r) => a + r.outputTokens, 0);
  const estCost = classifiedTotal * 0.0007;

  console.log('---');
  console.log(`[vision] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `[vision] classified=${classifiedTotal} dropped=${droppedTotal} hotels≥10cats=${reachedFloor}/${targets.length} tokens=${totalIn}in/${totalOut}out estCost≈$${estCost.toFixed(2)}`,
  );

  await mkdir(RUNS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = resolve(RUNS_DIR, `vision-categorize-${args.dryRun ? 'dry' : 'live'}-${ts}.json`);
  await writeFile(
    logPath,
    JSON.stringify(
      {
        startedAt: new Date(startedAt).toISOString(),
        elapsedMs,
        dryRun: args.dryRun,
        processed: targets.length,
        classifiedTotal,
        droppedTotal,
        reachedFloor,
        totalInputTokens: totalIn,
        totalOutputTokens: totalOut,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`[vision] run log → ${logPath}`);

  if (results.some((r) => r.failed !== undefined)) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[vision] FATAL', err);
  process.exit(1);
});
