/**
 * One-off probe: ask GPT-4o-mini Vision to classify, score, and write
 * alt FR/EN + JSON-LD captions for every Cloudinary photo currently
 * sitting in `hotels.gallery_images` for the 4 polish hotels.
 *
 * Goal: validate the pipeline economics + output quality BEFORE we
 * touch Supabase. We do NOT write anything to Cloudinary or Supabase
 * here — pure read + LLM probe + console table.
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/test-openai-vision.ts
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/test-openai-vision.ts --hotel=le-bristol-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx src/photos/test-openai-vision.ts --limit=3
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';
import { z } from 'zod';

import { selectHotels } from './supabase-rest.js';
import { loadPhotoEnv } from './env-photos.js';

interface GalleryImageRow {
  readonly public_id: string;
  readonly alt_fr?: string | null;
  readonly alt_en?: string | null;
  readonly category?: string | null;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly hero_image: string | null;
  readonly gallery_images: readonly GalleryImageRow[] | null;
}

interface HotelForProbe {
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly galleryImages: ReadonlyArray<{
    readonly publicId: string;
    readonly altFr: string | null;
  }>;
}

async function loadHotelsForProbe(
  url: string,
  serviceRoleKey: string,
  slugs: readonly string[],
): Promise<HotelForProbe[]> {
  // PostgREST `in` filter: `?slug=in.(a,b,c)`
  const filter = `slug=in.(${slugs.map((s) => encodeURIComponent(s)).join(',')})`;
  const rows = await selectHotels<HotelRow>(
    { url, serviceRoleKey },
    {
      columns: 'id,slug,name,city,hero_image,gallery_images',
      filters: [filter],
      order: 'slug.asc',
    },
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    city: r.city ?? '',
    galleryImages: (r.gallery_images ?? []).map((g) => ({
      publicId: g.public_id,
      altFr: g.alt_fr ?? null,
    })),
  }));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });

const POLISH_SLUGS = ['le-bristol-paris', 'akelarre', 'al-moudira', 'alila-jabal-akhdar'] as const;

const PHOTO_CATEGORIES = [
  'exterior',
  'lobby',
  'room',
  'suite',
  'dining',
  'spa',
  'pool',
  'view',
  'detail',
  'concierge',
  'events',
  'other',
] as const;

const VisionAnswerSchema = z.object({
  category: z.enum(PHOTO_CATEGORIES),
  alt_fr: z
    .string()
    .min(10)
    .max(120)
    .describe('Format: [Adjectif descriptif] [Hôtel X] [Ville]. Concierge voice, no superlative.'),
  alt_en: z.string().min(10).max(120),
  caption_fr: z
    .string()
    .min(20)
    .max(160)
    .describe('Phrase complète, autoexplicative, pour JSON-LD ImageObject.'),
  caption_en: z.string().min(20).max(160),
  quality_score: z.number().int().min(1).max(10),
  keep: z.boolean(),
  reason_if_drop: z.string().max(160).nullable(),
});

type VisionAnswer = z.infer<typeof VisionAnswerSchema>;

interface PhotoResult {
  readonly hotelSlug: string;
  readonly hotelName: string;
  readonly publicId: string;
  readonly url: string;
  readonly originalAltFr: string | null;
  readonly elapsedMs: number;
  readonly answer: VisionAnswer | null;
  readonly error: string | null;
}

const VISION_PROMPT = `Tu es un editor photo qui prepare la fiche d'un hotel de luxe pour MyConciergeHotel.com. Voici une photo (URL ci-dessous) destinee a la galerie de "{HOTEL_NAME}" a {HOTEL_CITY}.

Tu dois renvoyer un JSON strict (et SEULEMENT ce JSON, sans backticks, sans commentaire) avec les champs:

- category: une seule valeur parmi: exterior | lobby | room | suite | dining | spa | pool | view | detail | concierge | events | other
- alt_fr: 10-120 caracteres, voix Concierge. Format: "[Adjectif descriptif] {HOTEL_NAME} {HOTEL_CITY}". Pas de superlatifs (incroyable, magnifique, exceptionnel). Pas de "photo de" / "image de". Decris ce qu'on voit. Exemple: "Suite Panoramique vue Tour Eiffel Le Bristol Paris" / "Bar a champagne du salon principal Le Bristol Paris".
- alt_en: meme exigence, en anglais.
- caption_fr: 20-160 caracteres, phrase complete et auto-explicative pour un JSON-LD ImageObject. Exemple: "Le Salon des Tuileries avec vue sur les jardins, Le Bristol Paris, Faubourg Saint-Honore."
- caption_en: meme exigence, en anglais.
- quality_score: entier 1-10. Criteres: nettete, composition, eclairage, absence de touristes/voitures/personnel/elements parasites, representativite du luxe.
- keep: boolean. false UNIQUEMENT si: photo floue, photo de voiture/parking/rue exterieure non architecturale, screenshot, photo de touristes/personnel en gros plan, capture de site web, doublon visuel evident (impossible a juger ici, dis true par defaut), filigrane visible, image clairement non-hotel.
- reason_if_drop: si keep=false, raison courte (10-160 chars). Si keep=true, null.

IMPORTANT:
- Si tu vois une plaque mineralogique, une vitrine de magasin, un panneau de rue, un touriste qui pose: c'est probablement keep=false.
- Si la photo represente un espace generique sans signe distinctif de l'hotel, score bas mais keep=true.
- Pour {HOTEL_NAME}: prefere les nominations evocatrices ("Suite Imperiale", "Salon des Glaces", "Restaurant Epicure") quand tu reconnais le lieu, sinon descriptif sobre.`;

interface Args {
  readonly hotel?: string;
  readonly limit?: number;
}

function parseArgs(argv: readonly string[]): Args {
  const out: { hotel?: string; limit?: number } = {};
  for (const arg of argv) {
    if (arg.startsWith('--hotel=')) out.hotel = arg.slice('--hotel='.length);
    if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length));
      if (Number.isFinite(n) && n > 0) out.limit = Math.floor(n);
    }
  }
  return out;
}

function buildCloudinaryUrl(cloudName: string, publicId: string): string {
  // High-res for Vision (1600px width). GPT-4o-mini accepts up to 2048px on either side.
  return `https://res.cloudinary.com/${cloudName}/image/upload/w_1600,c_limit,q_auto,f_auto/${publicId}`;
}

async function classifyOnePhoto(
  client: OpenAI,
  cloudName: string,
  hotelName: string,
  hotelCity: string,
  publicId: string,
): Promise<{ answer: VisionAnswer | null; error: string | null; elapsedMs: number }> {
  const url = buildCloudinaryUrl(cloudName, publicId);
  const prompt = VISION_PROMPT.replaceAll('{HOTEL_NAME}', hotelName).replaceAll(
    '{HOTEL_CITY}',
    hotelCity,
  );
  const t0 = Date.now();
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
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
    const elapsedMs = Date.now() - t0;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        answer: null,
        error: `JSON parse failed: ${(err as Error).message}. Raw: ${raw.slice(0, 200)}`,
        elapsedMs,
      };
    }
    const validated = VisionAnswerSchema.safeParse(parsed);
    if (!validated.success) {
      return {
        answer: null,
        error: `Zod failed: ${validated.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .slice(0, 3)
          .join(' | ')}`,
        elapsedMs,
      };
    }
    return { answer: validated.data, error: null, elapsedMs };
  } catch (err) {
    return {
      answer: null,
      error: (err as Error).message.slice(0, 200),
      elapsedMs: Date.now() - t0,
    };
  }
}

function shorten(s: string | null | undefined, n = 60): string {
  if (s === null || s === undefined) return '-';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadPhotoEnv();
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (cloudName === undefined) {
    throw new Error('CLOUDINARY_CLOUD_NAME missing in .env.local');
  }
  const apiKey = process.env['OPENAI_API_KEY'];
  if (apiKey === undefined || apiKey.length < 20) {
    throw new Error('OPENAI_API_KEY missing or invalid in .env.local');
  }

  const slugs = args.hotel === undefined ? [...POLISH_SLUGS] : [args.hotel];
  console.log(`[probe] Loading hotels: ${slugs.join(', ')}`);
  const hotels = await loadHotelsForProbe(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    slugs,
  );

  const client = new OpenAI({ apiKey });
  const results: PhotoResult[] = [];

  for (const hotel of hotels) {
    const cap = args.limit ?? hotel.galleryImages.length;
    const sample = hotel.galleryImages.slice(0, cap);
    console.log(
      `\n[probe] ${hotel.slug} — ${hotel.name} (${hotel.city}) — ${sample.length}/${hotel.galleryImages.length} photos`,
    );
    for (let i = 0; i < sample.length; i += 1) {
      const photo = sample[i]!;
      const publicId = photo.publicId;
      process.stdout.write(`  [${i + 1}/${sample.length}] ${publicId} … `);
      // eslint-disable-next-line no-await-in-loop
      const { answer, error, elapsedMs } = await classifyOnePhoto(
        client,
        cloudName,
        hotel.name,
        hotel.city ?? '',
        publicId,
      );
      if (error !== null) {
        process.stdout.write(`ERROR (${elapsedMs}ms) ${error}\n`);
      } else if (answer === null) {
        process.stdout.write(`NO ANSWER (${elapsedMs}ms)\n`);
      } else {
        process.stdout.write(
          `${answer.category.padEnd(8)} score=${answer.quality_score} keep=${answer.keep ? 'Y' : 'n'} (${elapsedMs}ms)\n`,
        );
      }
      results.push({
        hotelSlug: hotel.slug,
        hotelName: hotel.name,
        publicId,
        url: buildCloudinaryUrl(cloudName, publicId),
        originalAltFr: photo.altFr ?? null,
        elapsedMs,
        answer,
        error,
      });
    }
  }

  // Summary table per hotel.
  for (const slug of slugs) {
    const subset = results.filter((r) => r.hotelSlug === slug);
    if (subset.length === 0) continue;
    const ok = subset.filter((r) => r.answer !== null);
    const kept = ok.filter((r) => r.answer?.keep === true);
    const categoriesCovered = new Set(
      ok.filter((r) => r.answer?.keep === true).map((r) => r.answer!.category),
    );
    const avgQuality =
      ok.length === 0
        ? 0
        : Math.round(
            (ok.reduce((acc, r) => acc + (r.answer?.quality_score ?? 0), 0) / ok.length) * 10,
          ) / 10;
    const totalMs = subset.reduce((acc, r) => acc + r.elapsedMs, 0);
    console.log(`\n=== ${slug} ===`);
    console.log(
      `  parsed=${ok.length}/${subset.length}  keep=${kept.length}  drop=${ok.length - kept.length}  categories=${categoriesCovered.size}  avg_quality=${avgQuality}  total=${(totalMs / 1000).toFixed(1)}s`,
    );
    console.log(`  Categories kept: ${[...categoriesCovered].sort().join(', ')}`);
    console.log('');
    console.log(
      [
        '  #',
        'cat'.padEnd(8),
        'sc',
        'kp',
        'alt_fr'.padEnd(60),
        'reason_drop'.padEnd(40),
        'public_id',
      ].join(' | '),
    );
    subset.forEach((r, i) => {
      if (r.error !== null) {
        console.log(`  ${String(i + 1).padStart(2)} | ERROR | ${r.error.slice(0, 120)}`);
        return;
      }
      const a = r.answer!;
      console.log(
        [
          `  ${String(i + 1).padStart(2)}`,
          a.category.padEnd(8),
          String(a.quality_score).padStart(2),
          a.keep ? 'Y ' : 'n ',
          shorten(a.alt_fr, 60).padEnd(60),
          shorten(a.reason_if_drop, 40).padEnd(40),
          r.publicId,
        ].join(' | '),
      );
    });
  }

  const totalCalls = results.length;
  const successful = results.filter((r) => r.answer !== null).length;
  const totalMs = results.reduce((acc, r) => acc + r.elapsedMs, 0);
  // gpt-4o-mini: $0.150 / 1M input tokens text + ~$0.000425 per image at high-detail 1600x ~= 765 input tokens / image
  // Prompt ~500 tokens, output ~250 tokens
  // Per call: ~$0.000115 input + $0.000425 image + $0.00015 output ~= $0.00069
  const estCost = totalCalls * 0.0007;
  console.log('\n--- OVERALL ---');
  console.log(`  Total calls: ${totalCalls}`);
  console.log(
    `  Successful: ${successful} (${Math.round((successful / Math.max(totalCalls, 1)) * 100)}%)`,
  );
  console.log(`  Wall time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Estimated cost: ~$${estCost.toFixed(3)} (gpt-4o-mini @ ~$0.0007/photo)`);
}

main().catch((err) => {
  console.error('[probe] FATAL', err);
  process.exitCode = 1;
});
