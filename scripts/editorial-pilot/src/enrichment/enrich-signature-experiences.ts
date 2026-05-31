/**
 * Signature experiences enrichment — fills the `signature_experiences`
 * column for hotels whose value is currently null or empty.
 *
 * Each hotel gets 5-7 exclusive on-site programmes (in-house transport,
 * loyalty perks, dining rituals, in-residence arts, signature spa
 * treatments…). Surfaces as a 3-up card grid on the public fiche.
 *
 * Anti-hallucination guard: the LLM only sees the hotel's name + city
 * + status (Palace / 5★) + existing brief blocks (highlights, dining,
 * spa, amenities). Outputs are typed by Zod before persist.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-signature-experiences.ts --all
 *   pnpm --filter @mch/editorial-pilot exec tsx \
 *     src/enrichment/enrich-signature-experiences.ts --slug=plaza-athenee-paris [--force]
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

const SignatureExperienceSchema = z.object({
  key: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/gu, '')
            .replace(/[^a-z0-9-]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
            .replace(/-+/gu, '-')
        : v,
    z
      .string()
      .regex(/^[a-z0-9-]+$/u)
      .min(2)
      .max(60),
  ),
  title_fr: z.string().min(3).max(120),
  title_en: z.string().min(3).max(120),
  description_fr: z.string().min(40).max(800),
  description_en: z.string().min(40).max(800),
  badge_fr: z.string().max(60).optional().nullable(),
  badge_en: z.string().max(60).optional().nullable(),
  booking_required: z.boolean().default(false),
});

const PayloadSchema = z.object({
  signature_experiences: z.array(SignatureExperienceSchema).min(4).max(10),
});

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly stars: number | null;
  readonly is_palace: boolean;
  readonly city: string;
  readonly region: string | null;
  readonly description_fr: string | null;
  readonly highlights: unknown;
  readonly amenities: unknown;
  readonly restaurant_info: unknown;
  readonly spa_info: unknown;
  readonly signature_experiences: unknown;
}

const HOTEL_COLS =
  'id,slug,name,stars,is_palace,city,region,description_fr,highlights,amenities,' +
  'restaurant_info,spa_info,signature_experiences';

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

const SYSTEM_PROMPT = `Tu es un rédacteur éditorial spécialisé dans le luxe hôtelier français pour MyConciergeHotel.com.

Tu produis les "expériences signature" d'un Palace : programmes exclusifs in-situ qui distinguent l'hôtel d'un 5★ classique. Style "long-read Condé Nast Traveler", précis et factuel — JAMAIS de superlatifs creux ("magique", "à couper le souffle", "incroyable").

Anti-hallucination critique :
- Tu disposes du brief de l'hôtel (highlights, restaurants, spa, équipements). Tes signatures DOIVENT être cohérentes avec ce brief.
- NE PAS inventer de noms de chefs/sommeliers/médecins, de partenariats de marques, de distinctions précises.
- Si tu cites un produit/marque, il doit être universellement connu (Guerlain, Dior, La Mer, Veuve Clicquot) OU être déjà dans le brief.
- Sinon, reste générique ("un spa partenaire d'une grande maison de cosmétique française", "un sommelier reconnu").

Format de sortie : JSON strict avec la clé "signature_experiences".`;

function buildPrompt(h: HotelRow): string {
  const lines: string[] = [];
  lines.push(`Hôtel : **${h.name}**`);
  lines.push(`Statut : ${h.is_palace ? 'Palace Atout France' : `${h.stars ?? 5}★`}`);
  lines.push(
    `Ville : ${h.region !== null && h.region.length > 0 ? `${h.city} (${h.region})` : h.city}`,
  );
  lines.push('');
  if (typeof h.description_fr === 'string' && h.description_fr.length > 0) {
    lines.push('### Description courte');
    lines.push(h.description_fr.slice(0, 800));
    lines.push('');
  }
  if (h.highlights !== null && h.highlights !== undefined) {
    lines.push('### Highlights connus');
    lines.push(JSON.stringify(h.highlights).slice(0, 1500));
    lines.push('');
  }
  if (h.restaurant_info !== null && h.restaurant_info !== undefined) {
    lines.push('### Restaurants connus');
    lines.push(JSON.stringify(h.restaurant_info).slice(0, 1500));
    lines.push('');
  }
  if (h.spa_info !== null && h.spa_info !== undefined) {
    lines.push('### Spa connu');
    lines.push(JSON.stringify(h.spa_info).slice(0, 1500));
    lines.push('');
  }
  if (h.amenities !== null && h.amenities !== undefined) {
    lines.push('### Équipements (extrait)');
    lines.push(JSON.stringify(h.amenities).slice(0, 900));
    lines.push('');
  }
  lines.push('### Travail demandé');
  lines.push(
    'Produis 5 à 7 "signature_experiences" — des programmes ou rituels exclusifs in-situ.',
  );
  lines.push('');
  lines.push('Inspire-toi de ces exemples (de vrais Palaces) pour calibrer le ton :');
  lines.push('- "Peninsula Time" : check-in 6h, check-out 22h, sans frais (Peninsula Paris)');
  lines.push('- "Aviator Service" : transfert privé en Rolls-Royce vintage (Cheval Blanc)');
  lines.push(
    '- "Petit-déjeuner sur la terrasse panoramique" : rituel matinal exclusif aux suites (Plaza Athénée)',
  );
  lines.push(
    '- "Initiation à la dégustation" : masterclass avec le sommelier (Domaine Les Crayères)',
  );
  lines.push('- "Routine bien-être personnalisée Dior" : 90 min de soin signature dédié');
  lines.push('- "Coucher de soleil en hélicoptère privé" : survol Côte d\'Azur, retour spa');
  lines.push('- "Cours de cuisine intimiste avec le Chef étoilé" : 4 personnes, marché compris');
  lines.push('- "Soirée jazz en bibliothèque" : cocktail au bar avec live music vendredi');
  lines.push('- "Atelier sommelier dégustation Champagnes Grands Crus" (Royal Champagne)');
  lines.push('- "Ski-room privatif + service ski valet" : ski-in/ski-out alpin');
  lines.push('');
  lines.push('Format chaque entrée :');
  lines.push(
    '{ key, title_fr (3-8 mots), title_en, description_fr (60-180 mots, précis et factuel), description_en, badge_fr (optionnel, ex: "Inclus", "Sur réservation", "Pour les Loyalty"), badge_en, booking_required (boolean) }',
  );
  lines.push('');
  lines.push('Contraintes :');
  lines.push('- `key` : kebab-case ASCII (ex: "petit-dejeuner-terrasse", "ski-valet-prive")');
  lines.push(
    "- Anglais britannique (en-GB) **OBLIGATOIRE** sur title_en + description_en + badge_en (si présent). Pas d'oubli.",
  );
  lines.push(
    '- title_en = traduction directe du title_fr ; description_en = traduction directe (60-180 mots), pas un résumé.',
  );
  lines.push(
    '- Adapter les signatures à la SAISON et au LIEU (montagne en hiver, mer en été, urbain à Paris…)',
  );
  lines.push('- 5 à 7 entrées (sweet spot : 6)');
  lines.push('');
  lines.push('Retourne UNIQUEMENT le JSON : { "signature_experiences": [ ... ] }');
  return lines.join('\n');
}

async function generateForHotel(
  h: HotelRow,
): Promise<readonly z.infer<typeof SignatureExperienceSchema>[]> {
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  const result = await llm.call({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildPrompt(h),
    temperature: 0.6,
    maxOutputTokens: 6000,
    responseFormat: 'json',
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch (err) {
    throw new Error(
      `non-JSON output: ${(err as Error).message}. First 200 chars: ${result.content.slice(0, 200)}`,
    );
  }
  const validation = PayloadSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `schema-fail:\n${validation.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`,
    );
  }
  return validation.data.signature_experiences;
}

interface Args {
  readonly slug: string | null;
  readonly all: boolean;
  readonly force: boolean;
  readonly missingEn: boolean;
  readonly concurrency: number;
}
/** Client-side reproduction of the SQL `--missing-en` predicate. */
function firstSignatureLacksEn(h: HotelRow): boolean {
  const sig = h.signature_experiences;
  if (!Array.isArray(sig) || sig.length < 4) return true;
  const first: unknown = sig[0];
  if (typeof first !== 'object' || first === null) return true;
  const en = (first as { description_en?: unknown }).description_en;
  return typeof en !== 'string' || en.length < 30;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let slug: string | null = null;
  let all = false;
  let force = false;
  let missingEn = false;
  let concurrency = 4;
  for (const a of args) {
    if (a === '--all') all = true;
    else if (a === '--force') force = true;
    else if (a === '--missing-en') missingEn = true;
    else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length).trim();
    else if (a.startsWith('--concurrency=')) {
      const n = Number.parseInt(a.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 16) concurrency = n;
    }
  }
  return { slug, all, force, missingEn, concurrency };
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.slug === null && !args.all && !args.missingEn) {
    console.error(
      'Usage: tsx src/enrichment/enrich-signature-experiences.ts --slug=<slug> | --all | --missing-en [--force]',
    );
    process.exit(1);
  }

  const cfg = loadRestConfig();
  // Ported off `pg` to the service-role PostgREST path (no DATABASE_URL on
  // this machine). The `jsonb_array_length < 4` predicate is approximated
  // with `signature_experiences=is.null` — every gap row is strictly NULL
  // (verified 2026-05-31: 2112 null, 0 empty array). `--missing-en` pulls
  // the small set of rows that already have signatures and filters EN gaps
  // client-side.
  const filters: string[] = ['is_published=eq.true'];
  if (args.slug !== null) {
    filters.push(`slug=eq.${args.slug}`);
  } else if (args.missingEn) {
    filters.push('signature_experiences=not.is.null');
  } else if (!args.force) {
    filters.push('signature_experiences=is.null');
  }
  const fetched = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'is_palace.desc.nullslast,stars.desc.nullslast,name.asc',
  });
  const hotels = args.missingEn ? fetched.filter(firstSignatureLacksEn) : fetched;
  console.log(
    `Found ${hotels.length} hotel(s) needing signature_experiences (concurrency=${args.concurrency}).`,
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
        const sigs = await generateForHotel(h);
        await patchHotelById(cfg, h.id, { signature_experiences: sigs });
        console.log(`${tag} ✓ ${sigs.length} signatures (${Date.now() - t0} ms)`);
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
