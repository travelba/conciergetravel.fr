/**
 * Phase 4 quick win — generate `intro_fr` (250-400 words) + `outro_fr`
 * (120-200 words) for rankings missing them.
 *
 * Voice : Le Concierge complice, expert, jamais commercial. Phrases ≤ 25 mots
 * (cf. EDITORIAL_VOICE.md §3 + concierge-voice-pipeline/SKILL.md).
 *
 * Idempotent : skips rankings already covered.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx overnight-rankings-intro-fr.ts \
 *     [--limit 10] [--slug <slug>]
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';
import pg from 'pg';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const args = process.argv.slice(2);
const limitArg = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) : Number.POSITIVE_INFINITY;
})();
const slugFilter = (() => {
  const i = args.indexOf('--slug');
  return i >= 0 ? (args[i + 1] ?? null) : null;
})();

const conn = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  ''
).replace(/[?&]sslmode=[^&]*/giu, '');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY']! });
const MODEL = process.env['EDITORIAL_PILOT_OPENAI_MODEL'] ?? 'gpt-5.4';

const SYSTEM = `Tu es Le Concierge — expert complice, jamais commercial — pour MyConciergeHotel.com (agence IATA premium, 5★ et Palaces).

CONTRAT DE VOIX
- Tu écris à la première personne, en posture d'insider qui partage un secret opérationnel.
- Tu ne vends pas, tu informes. Pas de superlatifs creux (incroyable, magnifique, exceptionnel, magique, sublime).
- Phrases courtes : ≤ 25 mots par phrase. Pas de longueur "littéraire".
- Pas d'emoji, pas d'exclamation, pas de slogan.
- Pas de balise HTML, pas de markdown gras/italique.
- Toujours TTC en euros si tu mentionnes des prix. Pas de prix exact si tu n'en as pas.
- Mentionne au moins un repère factuel concret : étoiles Atout France, distinction Michelin, Relais & Châteaux, Leading Hotels of the World, Forbes Travel Guide, distance précise, quartier identifiable.

CONTRAT DE FORMAT
Tu retournes un JSON STRICT :
{
  "intro_fr": "...",      // 250-400 mots, 2-4 paragraphes
  "outro_fr": "..."       // 120-200 mots, 1-2 paragraphes, conclusion / appel à la prudence factuelle
}

L'intro_fr explique le pourquoi du classement, les critères concrets retenus, l'ancrage géographique et culturel.
L'outro_fr conclut avec un conseil concret, une réserve honnête (limites, contexte de mise à jour) et invite à la suite.`;

interface Row {
  slug: string;
  title_fr: string;
  factual_summary_fr: string | null;
  outro_fr: string | null;
  intro_fr: string | null;
  axes_label: string | null;
}

const Schema = z.object({
  intro_fr: z.string().min(800).max(3500),
  outro_fr: z.string().min(400).max(1800),
});

await client.connect();

const { rows } = await client.query<Row>(`
  with axes_summary as (
    select er.slug,
           coalesce(string_agg(distinct (a->>'label_fr'), ', '), '') as axes_label
      from public.editorial_rankings er
      left join lateral jsonb_array_elements(case when jsonb_typeof(er.axes) = 'array' then er.axes else '[]'::jsonb end) a on true
     group by er.slug
  )
  select er.slug, er.title_fr, er.factual_summary_fr, er.outro_fr, er.intro_fr, ax.axes_label
    from public.editorial_rankings er
    left join axes_summary ax on ax.slug = er.slug
   where (
           er.intro_fr is null
        or coalesce(array_length(regexp_split_to_array(er.intro_fr, '\s+'), 1), 0) < 220
         )
     and er.factual_summary_fr is not null
   order by er.slug;
`);

const filtered = (slugFilter ? rows.filter((r) => r.slug === slugFilter) : rows).slice(0, limitArg);

console.log(
  `[rankings-intro] ${filtered.length} rankings to enrich (limit=${limitArg}, slug=${slugFilter ?? '*'})`,
);

let ok = 0;
let failed = 0;

function buildUserPrompt(row: Row): string {
  return [
    `Titre du classement : ${row.title_fr}`,
    `Résumé factuel : ${row.factual_summary_fr}`,
    row.axes_label ? `Axes : ${row.axes_label}` : 'Axes : aucun défini',
    '',
    'Génère intro_fr (250-400 mots) et outro_fr (120-200 mots).',
    "L'intro_fr doit poser le contexte, expliquer ce qui sépare une bonne sélection d'une mauvaise sur ce sujet, mentionner au moins un repère factuel reconnu.",
    "L'outro_fr conclut avec un conseil concret pour le lecteur (timing de réservation, période, indicateur de qualité à observer). Pas de promesse commerciale.",
    'Retourne UNIQUEMENT le JSON.',
  ].join('\n');
}

for (const row of filtered) {
  const start = Date.now();
  try {
    const useNewParams = /^(gpt-5|o3$|o4-mini)/.test(MODEL);
    const params: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserPrompt(row) },
      ],
      response_format: { type: 'json_object' as const },
    };
    if (useNewParams) {
      params['max_completion_tokens'] = 2200;
    } else {
      params['temperature'] = 0.5;
      params['max_tokens'] = 2200;
    }
    const resp = await openai.chat.completions.create(params as never);
    const raw = resp.choices[0]?.message.content ?? '';
    const parsed = Schema.parse(JSON.parse(raw));
    await client.query(
      `update public.editorial_rankings
          set intro_fr = $1,
              outro_fr = $2,
              updated_at = timezone('utc', now())
        where slug = $3`,
      [parsed.intro_fr.trim(), parsed.outro_fr.trim(), row.slug],
    );
    ok += 1;
    const ms = Date.now() - start;
    const introW = parsed.intro_fr.trim().split(/\s+/).length;
    const outroW = parsed.outro_fr.trim().split(/\s+/).length;
    console.log(`  ✓ ${row.slug} (intro ${introW}w, outro ${outroW}w, ${ms}ms)`);
  } catch (e) {
    failed += 1;
    const ms = Date.now() - start;
    console.error(`  ✗ ${row.slug} (${ms}ms): ${(e as Error).message.slice(0, 240)}`);
  }
}

console.log(`\n[rankings-intro] ok=${ok} failed=${failed} of ${filtered.length}`);
await client.end();
