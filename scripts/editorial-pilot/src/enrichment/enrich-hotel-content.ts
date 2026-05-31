/**
 * Hotel content enrichment pipeline — generates and persists:
 *   1. `long_description_sections` — 6-8 long-form editorial sections
 *      per hotel (≥ 350 words FR each), anchored on the existing
 *      brief + Wikipedia/Wikidata facts.
 *   2. `signature_experiences` — 5-7 exclusive on-site programmes.
 *
 * Idempotent: COALESCE-style update — only fills the column if it
 * is currently null OR empty array. Use `--force` to overwrite.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-hotel-content.ts --slug=plaza-athenee-paris
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-hotel-content.ts --all
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-hotel-content.ts --all --force
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

// ─── Schemas (mirror DB JSONB shapes) ────────────────────────────────

/**
 * Slugify an LLM-produced anchor/key into kebab-case ASCII. The model
 * routinely returns accented or spaced keys ("Petit-déjeuner sur la
 * terrasse") that fail the `^[a-z0-9-]+$` regex and would hard-fail the
 * whole hotel. Per llm-output-robustness §post-validation, we self-heal
 * the deterministic shape rather than rejecting the generation.
 */
function slugifyKey(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const out = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
  return out.length > 0 ? out : input;
}

const LongSectionSchema = z.object({
  anchor: z.preprocess(slugifyKey, z.string().regex(/^[a-z0-9-]+$/u)),
  title_fr: z.string().min(4).max(120),
  title_en: z.string().min(4).max(120).optional().default(''),
  body_fr: z.string().min(300),
  body_en: z.string().min(100).optional().default(''),
});

const SignatureExperienceSchema = z.object({
  key: z.preprocess(slugifyKey, z.string().regex(/^[a-z0-9-]+$/u)),
  title_fr: z.string().min(3).max(120),
  title_en: z.string().min(3).max(120).optional().default(''),
  description_fr: z.string().min(40).max(700),
  description_en: z.string().min(20).max(700).optional().default(''),
  badge_fr: z.string().max(40).optional().nullable(),
  badge_en: z.string().max(40).optional().nullable(),
  booking_required: z.boolean().default(false),
});

const EnrichmentSchema = z.object({
  long_description_sections: z.array(LongSectionSchema).min(5).max(10),
  signature_experiences: z.array(SignatureExperienceSchema).min(4).max(10),
});

type EnrichmentOutput = z.infer<typeof EnrichmentSchema>;

// ─── DB helpers ──────────────────────────────────────────────────────

interface HotelInput {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly stars: number | null;
  readonly is_palace: boolean;
  readonly city: string;
  readonly region: string | null;
  readonly description_fr: string | null;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
  readonly highlights: unknown;
  readonly amenities: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
}

const HOTEL_COLS =
  'id,slug,name,stars,is_palace,city,region,description_fr,long_description_sections,' +
  'signature_experiences,highlights,amenities,restaurant_info,spa_info';

function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing in .env.local');
  }
  if (typeof key !== 'string' || key.length < 40) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  return { url, serviceRoleKey: key };
}

/**
 * Ported off `pg` (no DATABASE_URL on this machine) to the service-role
 * PostgREST path. The original `jsonb_array_length(...) < 5` predicate is
 * approximated with `long_description_sections=is.null` — every gap row in
 * the catalogue is strictly NULL (verified 2026-05-31: 1302 null, 0 empty
 * array, only 1 row with a non-null length < 5), so the simple null filter
 * avoids paging the heavy section blobs of the ~916 already-rich rows.
 */
async function listHotels(
  cfg: SupabaseRestConfig,
  slug: string | null,
  force: boolean,
): Promise<readonly HotelInput[]> {
  const filters: string[] = ['is_published=eq.true'];
  if (slug !== null) filters.push(`slug=eq.${slug}`);
  if (!force && slug === null) filters.push('long_description_sections=is.null');
  return selectHotels<HotelInput>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'is_palace.desc.nullslast,stars.desc.nullslast,name.asc',
  });
}

async function persistEnrichment(
  cfg: SupabaseRestConfig,
  hotelId: string,
  out: EnrichmentOutput,
): Promise<void> {
  await patchHotelById(cfg, hotelId, {
    long_description_sections: out.long_description_sections,
    signature_experiences: out.signature_experiences,
  });
}

// ─── LLM prompts ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un rédacteur éditorial spécialisé dans le luxe hôtelier français pour MyConciergeHotel.com.

Tu écris des sections éditoriales longues et substantielles pour des fiches Palaces/5★ en France. Style "long-read Condé Nast Traveler", précis, factuel, intemporel — JAMAIS de superlatifs creux.

Anti-hallucination critique :
- Tu disposes du brief + des données structurées de l'hôtel. NE PAS inventer de chiffres, dates, noms de chefs, distinctions Michelin.
- Si tu n'es pas certain d'un fait précis, OMETS-LE ou utilise un terme générique ("un chef étoilé Michelin" plutôt qu'un nom inventé).
- Tu peux te baser sur le contexte donné et tes connaissances générales VÉRIFIABLES (Wikipédia niveau).
- Pour les dates : préfère un siècle/décennie sauf si l'année est dans le brief.

Format de sortie : JSON strict.`;

function buildUserPrompt(h: HotelInput): string {
  const lines: string[] = [];
  lines.push(`Hôtel : ${h.name}`);
  lines.push(`Statut : ${h.is_palace ? 'Palace Atout France' : `${h.stars ?? 5}★`}`);
  lines.push(
    `Ville : ${h.region !== null && h.region.length > 0 ? `${h.city} (${h.region})` : h.city}`,
  );
  lines.push('');
  if (typeof h.description_fr === 'string' && h.description_fr.length > 0) {
    lines.push('### Description courte existante');
    lines.push(h.description_fr);
    lines.push('');
  }
  // Inject the highlights / restaurant / spa briefs if present.
  if (h.highlights !== null && h.highlights !== undefined) {
    lines.push('### Highlights connus (brief)');
    lines.push(JSON.stringify(h.highlights).slice(0, 1200));
    lines.push('');
  }
  if (h.restaurant_info !== null && h.restaurant_info !== undefined) {
    lines.push('### Restaurants connus (brief)');
    lines.push(JSON.stringify(h.restaurant_info).slice(0, 1200));
    lines.push('');
  }
  if (h.spa_info !== null && h.spa_info !== undefined) {
    lines.push('### Spa & bien-être connu (brief)');
    lines.push(JSON.stringify(h.spa_info).slice(0, 1200));
    lines.push('');
  }
  if (h.amenities !== null && h.amenities !== undefined) {
    lines.push('### Équipements connus (brief, extrait)');
    lines.push(JSON.stringify(h.amenities).slice(0, 800));
    lines.push('');
  }
  lines.push('### Travail demandé');
  lines.push('Produis un JSON STRICT avec deux clés :');
  lines.push('');
  lines.push(
    '1. `long_description_sections` (6-8 sections) — chaque section : { anchor, title_fr, title_en, body_fr, body_en }.',
  );
  lines.push(
    '   Sections recommandées : "histoire" (Histoire & héritage), "lieu" (L\'établissement), "chambres" (Chambres et suites), "gastronomie" (La table), "spa" (Spa & bien-être), "services" (Conciergerie & services), "art-de-vivre" (L\'art de vivre [ville]), "reserver" (Réserver via MyConciergeHotel).',
  );
  lines.push('   `body_fr` ≥ 350 mots par section. Anchor en kebab-case ASCII.');
  lines.push('');
  lines.push(
    '2. `signature_experiences` (5-7 expériences) — chaque entrée : { key, title_fr, title_en, description_fr (≥ 50 mots), description_en, badge_fr (optionnel), booking_required (boolean) }.',
  );
  lines.push(
    '   `key` OBLIGATOIREMENT en kebab-case ASCII (minuscules, chiffres et tirets uniquement, AUCUN accent ni espace), ex. "petit-dejeuner-terrasse", "cours-cuisine-chef".',
  );
  lines.push(
    '   Exemples de signature : "Petit-déjeuner sur la terrasse", "Cours de cuisine avec le Chef", "Routine bien-être personnalisée au Spa", "Visite privée du domaine", "Initiation à la dégustation", "Coucher de soleil en hélicoptère"…',
  );
  lines.push(
    '   Basé sur les briefs ci-dessus + connaissance générique du segment Palace (toujours générique si pas certain).',
  );
  lines.push('');
  lines.push('TOTAL minimum : ≥ 2100 mots FR dans long_description_sections.');
  lines.push("Anglais britannique (en-GB). Tu peux laisser `_en` vides si tu n'es pas sûr.");
  lines.push('');
  lines.push('Retourne UNIQUEMENT le JSON.');
  return lines.join('\n');
}

async function generateEnrichment(h: HotelInput): Promise<EnrichmentOutput> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);
  const result = await client.call({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(h),
    temperature: 0.5,
    maxOutputTokens: 16000,
    responseFormat: 'json',
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch (err) {
    throw new Error(
      `[enrich ${h.slug}] non-JSON output: ${(err as Error).message}. First 300 chars: ${result.content.slice(0, 300)}`,
    );
  }
  const validation = EnrichmentSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `[enrich ${h.slug}] schema-fail:\n${validation.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return validation.data;
}

// ─── CLI ─────────────────────────────────────────────────────────────

interface Args {
  readonly slug: string | null;
  readonly all: boolean;
  readonly force: boolean;
  readonly concurrency: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let slug: string | null = null;
  let all = false;
  let force = false;
  let concurrency = 4;
  for (const arg of a) {
    if (arg === '--all') all = true;
    else if (arg === '--force') force = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length).trim();
    else if (arg.startsWith('--concurrency=')) {
      const n = Number.parseInt(arg.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 16) concurrency = n;
    }
  }
  return { slug, all, force, concurrency };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.slug === null && !args.all) {
    console.error(
      'Usage: tsx src/enrichment/enrich-hotel-content.ts --slug=<slug> | --all [--force] [--concurrency=N]',
    );
    process.exit(1);
  }
  const cfg = loadRestConfig();
  const hotels = await listHotels(cfg, args.slug, args.force);
  console.log(`Found ${hotels.length} hotel(s) to enrich (concurrency=${args.concurrency}).`);

  let ok = 0;
  let fail = 0;
  let started = 0;
  const total = hotels.length;
  const queue = [...hotels];

  const worker = async (): Promise<void> => {
    for (;;) {
      const h = queue.shift();
      if (h === undefined) break;
      const idx = (started += 1);
      const tag = `[${idx}/${total} ${h.slug}]`;
      try {
        const t0 = Date.now();
        const out = await generateEnrichment(h);
        const wordsFr = out.long_description_sections.reduce(
          (acc, s) => acc + s.body_fr.split(/\s+/u).length,
          0,
        );
        await persistEnrichment(cfg, h.id, out);
        console.log(
          `${tag} ✓ sections=${out.long_description_sections.length}, exp=${out.signature_experiences.length}, words_fr≈${wordsFr} (${Date.now() - t0} ms)`,
        );
        ok += 1;
      } catch (err) {
        fail += 1;
        console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));
  console.log(`Done — ${ok} OK / ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
