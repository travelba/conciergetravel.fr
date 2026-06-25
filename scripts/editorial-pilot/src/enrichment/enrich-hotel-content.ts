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

import type { DataForSeoClientConfig } from '@mch/integrations/dataforseo';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { loadDfsConfig } from '../grounding/env-dfs.js';
import { groundHotel } from '../grounding/hotel-grounding.js';
import type { HotelLlmInput } from '../hotels/supabase-hotels.js';
import { hasLeak } from './scaffolding-gate.js';

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

/**
 * Clamp an over-long LLM string to `max` chars at a sentence/word
 * boundary. gpt-5.x routinely overshoots a hard char cap by a few dozen
 * chars on free-form descriptions; rejecting the whole hotel for a 5-char
 * overflow wastes a full (expensive) generation. Per llm-output-robustness
 * §post-validation we self-heal the deterministic shape instead.
 */
function clampText(max: number): (v: unknown) => unknown {
  return (v: unknown): unknown => {
    if (typeof v !== 'string' || v.length <= max) return v;
    const slice = v.slice(0, max);
    const lastStop = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('? '),
    );
    if (lastStop > max * 0.6) return slice.slice(0, lastStop + 1).trim();
    const lastSpace = slice.lastIndexOf(' ');
    return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
  };
}

/**
 * Lenient EN string (llm-output-robustness Rule 3c). `.min(N).optional()
 * .default('')` does NOT bypass `.min(N)` — an empty/short LLM EN field
 * fails the whole hotel (observed 2026-06-25: hotel-costes lost all 7
 * sections to `body_en min(100)`). EN parity is backfilled downstream by
 * `translate-sections-en.ts` (the canonical 7th/9th-wave tool), so we accept
 * empty/short EN here and never reject a good FR generation because of it.
 */
const EnString = (maxLen: number): z.ZodEffects<z.ZodDefault<z.ZodString>, string, unknown> =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'string') return v;
    return v;
  }, z.string().max(maxLen).default(''));

const LongSectionSchema = z.object({
  anchor: z.preprocess(slugifyKey, z.string().regex(/^[a-z0-9-]+$/u)),
  title_fr: z.string().min(4).max(120),
  title_en: EnString(120),
  body_fr: z.string().min(300),
  body_en: EnString(8000),
});

const SignatureExperienceSchema = z.object({
  key: z.preprocess(slugifyKey, z.string().regex(/^[a-z0-9-]+$/u)),
  title_fr: z.string().min(3).max(120),
  title_en: EnString(120),
  description_fr: z.preprocess(clampText(1200), z.string().min(40).max(1200)),
  description_en: z.preprocess(clampText(1200), EnString(1200)),
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
  readonly name_en: string | null;
  readonly stars: number | null;
  readonly is_palace: boolean;
  readonly city: string;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly description_fr: string | null;
  readonly long_description_sections: unknown;
  readonly signature_experiences: unknown;
  readonly highlights: unknown;
  readonly amenities: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
}

const HOTEL_COLS =
  'id,slug,name,name_en,stars,is_palace,city,region,country_code,description_fr,long_description_sections,' +
  'signature_experiences,highlights,amenities,restaurant_info,spa_info';

/** Minimal `HotelLlmInput` for `groundHotel` (it only reads name / name_en /
 * city / country_code to derive the DataForSEO seeds + locale). */
function toLlmInput(h: HotelInput): HotelLlmInput {
  return {
    slug: h.slug,
    name: h.name,
    name_en: h.name_en,
    city: h.city,
    district: null,
    country_code: h.country_code,
    country_label_fr: null,
    country_label_en: null,
    stars: h.stars,
    is_palace: h.is_palace,
    description_fr_excerpt: null,
    description_en_excerpt: null,
    points_of_interest: null,
    restaurant_info: h.restaurant_info,
    spa_info: h.spa_info,
    amenities: h.amenities,
    signature_experiences: h.signature_experiences,
    awards: null,
  };
}

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
  slugs: readonly string[],
  force: boolean,
): Promise<readonly HotelInput[]> {
  const filters: string[] = ['is_published=eq.true'];
  if (slug !== null) filters.push(`slug=eq.${slug}`);
  else if (slugs.length > 0) filters.push(`slug=in.(${slugs.join(',')})`);
  if (!force && slug === null && slugs.length === 0)
    filters.push('long_description_sections=is.null');
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
  preserveExperiences: boolean,
): Promise<void> {
  // Safety: do NOT overwrite an existing `signature_experiences` array. Some
  // fiches (notably the late R&C + Marriott scaffold pass) shipped with
  // hand-curated experiences but a NULL `long_description_sections`. Running
  // this script on them must close the sections gap without erasing the
  // experiences. The caller decides per-row by reading the input row first.
  const patch: Record<string, unknown> = {
    long_description_sections: out.long_description_sections,
  };
  if (!preserveExperiences) {
    patch['signature_experiences'] = out.signature_experiences;
  }
  await patchHotelById(cfg, hotelId, patch);
}

// ─── LLM prompts ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un rédacteur éditorial spécialisé dans le luxe hôtelier français pour MyConciergeHotel.com.

Tu écris des sections éditoriales longues et substantielles pour des fiches Palaces/5★ en France. Style "long-read Condé Nast Traveler", précis, factuel, intemporel — JAMAIS de superlatifs creux.

Anti-hallucination critique :
- Tu disposes du brief + des données structurées de l'hôtel. NE PAS inventer de chiffres, dates, noms de chefs, distinctions Michelin.
- Si tu n'es pas certain d'un fait précis, OMETS-LE ou utilise un terme générique ("un chef étoilé Michelin" plutôt qu'un nom inventé).
- Tu peux te baser sur le contexte donné et tes connaissances générales VÉRIFIABLES (Wikipédia niveau).
- Pour les dates : préfère un siècle/décennie sauf si l'année est dans le brief.

INTERDICTION ABSOLUE (rejet automatique de la fiche) :
- Ne JAMAIS écrire de méta-commentaire sur les données ou le processus : pas de "le brief", "AUTO_DRAFT", "pending", "statut pending", "niveau de confiance", "selon les sources publiques", "à vérifier", "non vérifié", "non confirmé", ni d'identifiant Wikidata (Qxxxxx), ni de backticks \`...\`.
- Tu écris UNIQUEMENT de la prose éditoriale publiable, comme si elle paraissait demain dans un magazine. Le lecteur ne doit jamais soupçonner l'existence d'un brief ou d'un pipeline.
- N'écris une section QUE si tu as de la matière réelle. Si une dimension (spa, restauration, chambres…) manque de données exploitables, NE PRODUIS PAS de section pour elle — réduis le nombre de sections plutôt que de narrer l'absence.

Format de sortie : JSON strict.`;

function buildUserPrompt(h: HotelInput, groundingBlock: string): string {
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
  if (groundingBlock.length > 0) {
    lines.push(groundingBlock);
    lines.push('');
    lines.push(
      '### Ancrage SEO/GEO (DataForSEO)',
      "Le bloc ci-dessus liste la demande de recherche RÉELLE (mots-clés à volume, questions People-Also-Ask, intentions). Ancre les titres de section (title_fr/title_en) et le corps sur ces requêtes quand c'est naturel : reprends le vocabulaire exact des recherches à fort volume, et traite les questions People-Also-Ask dans le fil du texte. JAMAIS de bourrage de mots-clés ni de liste — la prose reste fluide et éditoriale.",
      '',
    );
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

async function generateEnrichment(
  h: HotelInput,
  dfsCfg: DataForSeoClientConfig | null,
): Promise<EnrichmentOutput> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const client = buildLlmClient(env, provider);
  // DataForSEO grounding — anchors section titles + prose on real search demand
  // (high-volume keywords + People-Also-Ask). Degrade-safe: empty block on DFS-off.
  const { block } = await groundHotel(dfsCfg, toLlmInput(h));
  const result = await client.call({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(h, block),
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

  // I1 anti-scaffolding gate (ADR-0029) — this generator has no Tavily fact
  // pinning, so on a thin-source hotel the LLM narrates the brief ("le brief
  // résume…", "section pending", "niveau de confiance low"). Without this gate
  // it is the very tool that polluted 817 fiches (2026-06-19 audit). Drop any
  // leaking section; if fewer than the schema floor survive, REFUSE the whole
  // write so the fiche stays clean-thin rather than re-polluted.
  const cleanSections = validation.data.long_description_sections.filter(
    (s) => !hasLeak(s.body_fr) && !hasLeak(s.body_en),
  );
  if (cleanSections.length < 5) {
    throw new Error(
      `[enrich ${h.slug}] leak-gate: only ${cleanSections.length}/${validation.data.long_description_sections.length} sections are leak-free (min 5) — refusing to persist (thin-source hotel narrating the brief).`,
    );
  }
  return { ...validation.data, long_description_sections: cleanSections };
}

// ─── CLI ─────────────────────────────────────────────────────────────

interface Args {
  readonly slug: string | null;
  readonly slugs: readonly string[];
  readonly all: boolean;
  readonly force: boolean;
  readonly concurrency: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  let slug: string | null = null;
  let slugs: string[] = [];
  let all = false;
  let force = false;
  let concurrency = 4;
  for (const arg of a) {
    if (arg === '--all') all = true;
    else if (arg === '--force') force = true;
    else if (arg.startsWith('--slug=')) slug = arg.slice('--slug='.length).trim();
    else if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (arg.startsWith('--concurrency=')) {
      const n = Number.parseInt(arg.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 16) concurrency = n;
    }
  }
  return { slug, slugs, all, force, concurrency };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.slug === null && args.slugs.length === 0 && !args.all) {
    console.error(
      'Usage: tsx src/enrichment/enrich-hotel-content.ts --slug=<slug> | --slugs=a,b,c | --all [--force] [--concurrency=N]',
    );
    process.exit(1);
  }
  const cfg = loadRestConfig();
  const dfsCfg = loadDfsConfig();
  const hotels = await listHotels(cfg, args.slug, args.slugs, args.force);
  console.log(
    `Found ${hotels.length} hotel(s) to enrich (concurrency=${args.concurrency}, grounding=${dfsCfg !== null ? 'on' : 'off'}).`,
  );

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
        const out = await generateEnrichment(h, dfsCfg);
        const wordsFr = out.long_description_sections.reduce(
          (acc, s) => acc + s.body_fr.split(/\s+/u).length,
          0,
        );
        const existingExperiences = Array.isArray(h.signature_experiences)
          ? h.signature_experiences.length
          : 0;
        const preserveExperiences = existingExperiences > 0;
        await persistEnrichment(cfg, h.id, out, preserveExperiences);
        console.log(
          `${tag} ✓ sections=${out.long_description_sections.length}, exp=${preserveExperiences ? `kept ${existingExperiences} existing` : out.signature_experiences.length}, words_fr≈${wordsFr} (${Date.now() - t0} ms)`,
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
