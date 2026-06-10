/**
 * LLM generator — kit-wave JSON payloads for kit rollout fiches.
 *
 * Fetches the current Supabase row, calls the editorial LLM once per slug,
 * validates against KitGoldenPayload shape, writes
 * `packages/domain/src/editorial/kit-wave/{slug}.json`.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot kit:generate-payload -- --slug=cheval-blanc-paris
 *   pnpm --filter @mch/editorial-pilot kit:generate-payload -- --wave5
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const WAVE_SLUGS = [
  'cheval-blanc-paris',
  'le-bristol-paris',
  'les-airelles-courchevel',
  'les-pres-deugenie',
  'shangri-la-paris',
] as const;

const HOTEL_COLS =
  'id,slug,name,city,country_code,address,postal_code,phone_e164,official_url,description_fr,description_en,factual_summary_fr,factual_summary_en,meta_title_fr,meta_title_en,meta_desc_fr,meta_desc_en,restaurant_info,spa_info,points_of_interest,amenities,faq_content,concierge_advice,signature_experiences,long_description_sections,awards,latitude,longitude,google_place_id,luxury_tier';

const AmenitySchema = z.object({
  key: z.string().min(2),
  label_fr: z.string().min(2),
  label_en: z.string().min(2),
});

const GalleryImageSchema = z.object({
  public_id: z.string().min(8),
  category: z.string().min(3),
  alt_fr: z.string().min(10),
  alt_en: z.string().min(10),
  caption_fr: z.string().min(20).optional(),
  caption_en: z.string().min(20).optional(),
  credit: z.string().min(3).optional(),
});

const KitPayloadSchema = z.object({
  slug: z.string(),
  imagePrefix: z.string(),
  phoneE164: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  emailReservations: z.string().optional(),
  googlePlaceId: z.string().optional(),
  openedAt: z.string().optional(),
  factualSummaryFr: z.string().min(110).max(165).optional(),
  factualSummaryEn: z.string().min(110).max(165).optional(),
  metaTitleFr: z.string().max(70).optional(),
  metaTitleEn: z.string().max(70).optional(),
  metaDescFr: z.string().min(140).max(170).optional(),
  metaDescEn: z.string().min(140).max(170).optional(),
  descriptionFr: z.string().min(400).optional(),
  descriptionEn: z.string().min(400).optional(),
  heroImage: z.string().optional(),
  restaurantInfo: z.object({
    count: z.number().int().positive(),
    michelin_stars: z.number().int().nonnegative().optional(),
    venues: z.array(z.record(z.unknown())).min(2),
  }),
  pointsOfInterest: z.array(z.record(z.unknown())).min(9),
  spaInfo: z.record(z.unknown()),
  conciergeAdvice: z.record(z.unknown()),
  conciergeHook: z.record(z.unknown()),
  conciergeQuestions: z.array(z.record(z.unknown())).min(20).max(35),
  faqContentPromote: z.array(z.record(z.unknown())).min(10).max(15),
  faqContentKit: z.array(z.record(z.unknown())).min(25).max(60).optional(),
  highlights: z.array(z.record(z.unknown())).optional(),
  amenities: z.array(AmenitySchema).min(75).max(90),
  galleryImages: z.array(GalleryImageSchema).min(28).max(32),
  signatureExperiences: z.array(z.record(z.unknown())).optional(),
  transports: z.array(z.record(z.unknown())).optional(),
});

const SYSTEM_PROMPT = `You are the editorial kit payload generator for MyConciergeHotel.com — an IATA-accredited luxury hotel OTA.

Produce ONE JSON object matching the KitGoldenPayload schema for a hotel kit fiche (Airelles Gordes reference).

HARD RULES (PO gates D7–D14):
- restaurant_info.venues[]: EVERY official F&B outlet from the hotel website — restaurants AND bars as SEPARATE entries. Each venue MUST have name + (website OR phone OR reservation_url) + tip_fr + tip_en. Tips = concierge one-liner, ≤ 25 words per sentence.
- points_of_interest[]: min 9 entries across buckets visit/do/shop (≥2 each). Each POI: name, bucket, distance_meters OR walk_minutes, description_fr/en, tip_fr/en, image_public_id = "{imagePrefix}/poi-{kebab-slug}".
- spa_info: description_fr/en + hours_fr/en + website or phone + tip_fr/en. Never invent a spa if hotel has none.
- concierge_questions: 22–28 Q&A pairs, INFORMATIVE tone (3rd person / "La conciergerie peut…"). NEVER "Je réserve", "Je confirme", "Je m'occupe".
- concierge_hook: operational secret opening the fiche (60–90 words FR + EN).
- concierge_advice: { advice_fr, advice_en } — voix complice, secret opérationnel.
- amenities: exactly 80 factual items { key, label_fr, label_en } — no invented Michelin unless verified.
- galleryImages: exactly 30 entries, 10 categories × 3 (exterior, lobby, room, dining, spa, pool, view, detail, concierge, events). public_id = "{imagePrefix}/press-N" for N=1..30. Rich alt_fr/en + caption_fr/en. credit = official source name.
- faqContentPromote: 12 canonical FAQ for JSON-LD. faqContentKit: 40–50 extended FAQ if possible.
- EEAT: omit figures you cannot source from official_url; never fabricate awards.

Return ONLY valid JSON, no markdown fence.`;

function parseArgs(argv: readonly string[]): { readonly slugs: readonly string[] } {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) map.set(arg.slice(2), true);
    else map.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  if (map.has('wave5')) return { slugs: [...WAVE_SLUGS] };
  const slugRaw = map.get('slug');
  const slugs =
    typeof slugRaw === 'string' && slugRaw.length > 0
      ? slugRaw.split(',').map((s) => s.trim())
      : [];
  return { slugs };
}

function loadRestConfig(): SupabaseRestConfig {
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
    })
    .parse(process.env);
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

async function generateForSlug(slug: string, cfg: SupabaseRestConfig): Promise<void> {
  const rows = await selectHotels<Record<string, unknown>>(cfg, {
    columns: HOTEL_COLS,
    filters: [`slug=eq.${slug}`],
    limit: 1,
  });
  if (rows.length === 0) throw new Error(`no row for ${slug}`);
  const hotel = rows[0] as Record<string, unknown>;
  const imagePrefix = `cct/hotels/${slug}`;

  const env = loadEnv();
  const llm = buildLlmClient(env, resolveProvider(env));

  const userPrompt = `=== HOTEL ROW (Supabase) ===
${JSON.stringify(hotel, null, 2)}

=== REQUIRED OUTPUT FIELDS ===
slug: "${slug}"
imagePrefix: "${imagePrefix}"

Use official_url for venue contacts when dedicated F&B URLs are unknown.
Preserve factual_summary/meta if already in envelope; otherwise regenerate.
For Paris hotels: include accurate arrondissement POI (museums, monuments, shopping).
For Courchevel: ski, alpine POI. For Eugénie-les-Bains: Landes thermal/gastronomy POI.

Generate the full KitGoldenPayload JSON now.`;

  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const suffix =
      attempt === 1
        ? ''
        : `\n\nPREVIOUS ATTEMPT REJECTED: ${lastError}\nFix and return valid JSON only.`;
    const result = await llm.call({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: userPrompt + suffix,
      temperature: 0.35,
      maxOutputTokens: 16000,
      responseFormat: 'json',
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      lastError = 'invalid JSON';
      continue;
    }
    const validated = KitPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      lastError = validated.error.message.slice(0, 500);
      console.warn(`[kit:generate] ${slug} attempt ${attempt}: ${lastError}`);
      continue;
    }
    const outDir = path.resolve(__dirname, '../../../../packages/domain/src/editorial/kit-wave');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.resolve(outDir, `${slug}.json`);
    writeFileSync(outPath, JSON.stringify(validated.data, null, 2) + '\n', 'utf8');
    console.log(
      `[kit:generate] ✓ ${slug} → ${outPath} (venues=${validated.data.restaurantInfo.venues.length}, poi=${validated.data.pointsOfInterest.length}, gallery=${validated.data.galleryImages.length})`,
    );
    return;
  }
  throw new Error(`[kit:generate] ${slug} failed after 3 attempts: ${lastError}`);
}

async function main(): Promise<void> {
  const { slugs } = parseArgs(process.argv.slice(2));
  if (slugs.length === 0) {
    console.error('Usage: --slug=x or --wave5');
    process.exit(1);
  }
  const cfg = loadRestConfig();
  for (const slug of slugs) {
    console.log(`\n[kit:generate] ${slug}…`);
    await generateForSlug(slug, cfg);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
