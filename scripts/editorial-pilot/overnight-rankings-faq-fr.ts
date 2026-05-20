/**
 * Phase 4 quick win — generate `faq` (5-10 Q&A pairs FR) for rankings
 * missing them.
 *
 * Each entry: { question_fr, answer_fr, question_en?, answer_en?, category? }
 *
 * Voice : Le Concierge factuel et concis. Réponses 50-100 mots (densité AEO).
 *
 * Idempotent : skips rankings with faq_count >= 5.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx overnight-rankings-faq-fr.ts \
 *     [--limit 5] [--slug <slug>]
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

const SYSTEM = `Tu es Le Concierge — expert factuel — pour MyConciergeHotel.com (agence IATA premium).

CONTRAT DE VOIX
- Tu informes, tu ne vends pas. Pas de superlatif.
- Phrases courtes : ≤ 25 mots.
- Repère factuel concret : étoiles Atout France, Michelin, Relais & Châteaux, distance, quartier.
- Réponses 50-100 mots (densité AEO pour FAQPage JSON-LD).
- Pas d'emoji, pas d'exclamation, pas de markdown.

CONTRAT DE FORMAT
Tu retournes un JSON STRICT :
{
  "faq": [
    { "question_fr": "...", "answer_fr": "...", "category": "..." },
    ...  // 5 à 8 entrées au total
  ]
}

Catégories autorisées : "selection", "criteres", "saisonnalite", "budget", "transport", "famille", "luxe", "experience".

Les questions doivent être celles que se pose un voyageur premium devant ce classement (ex. "Quel est le critère principal de cette sélection ?", "Quelle saison privilégier pour ce type de séjour ?", "Faut-il réserver à l'avance ?", "Quels prix moyens prévoir ?").`;

interface Row {
  slug: string;
  title_fr: string;
  factual_summary_fr: string | null;
  intro_fr: string | null;
  axes_label: string | null;
}

const FaqEntrySchema = z.object({
  question_fr: z.string().min(10).max(200),
  answer_fr: z.string().min(80).max(700),
  category: z.string().min(3).max(40).optional(),
});
const Schema = z.object({
  faq: z.array(FaqEntrySchema).min(5).max(8),
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
  select er.slug, er.title_fr, er.factual_summary_fr, er.intro_fr, ax.axes_label
    from public.editorial_rankings er
    left join axes_summary ax on ax.slug = er.slug
   where (
           er.faq is null
        or jsonb_typeof(er.faq) <> 'array'
        or jsonb_array_length(er.faq) < 5
         )
     and er.factual_summary_fr is not null
     and er.intro_fr is not null
   order by er.slug;
`);

const filtered = (slugFilter ? rows.filter((r) => r.slug === slugFilter) : rows).slice(0, limitArg);

console.log(
  `[rankings-faq] ${filtered.length} rankings to enrich (limit=${limitArg}, slug=${slugFilter ?? '*'})`,
);

let ok = 0;
let failed = 0;

function buildUserPrompt(row: Row): string {
  return [
    `Titre du classement : ${row.title_fr}`,
    `Résumé factuel : ${row.factual_summary_fr}`,
    row.axes_label ? `Axes : ${row.axes_label}` : 'Axes : aucun défini',
    '',
    `Intro existante (extrait, pour calibrer le ton) :`,
    (row.intro_fr ?? '').slice(0, 1200),
    '',
    'Génère 5 à 8 paires Q&A en JSON. Réponses 50-100 mots, ton factuel.',
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
      params['max_completion_tokens'] = 2400;
    } else {
      params['temperature'] = 0.4;
      params['max_tokens'] = 2400;
    }
    const resp = await openai.chat.completions.create(params as never);
    const raw = resp.choices[0]?.message.content ?? '';
    const parsed = Schema.parse(JSON.parse(raw));
    const faq = parsed.faq.map((q) => ({
      question_fr: q.question_fr.trim(),
      answer_fr: q.answer_fr.trim(),
      ...(q.category ? { category: q.category.trim() } : {}),
    }));
    await client.query(
      `update public.editorial_rankings
          set faq = $1::jsonb,
              updated_at = timezone('utc', now())
        where slug = $2`,
      [JSON.stringify(faq), row.slug],
    );
    ok += 1;
    const ms = Date.now() - start;
    console.log(`  ✓ ${row.slug} (${faq.length} Q&A, ${ms}ms)`);
  } catch (e) {
    failed += 1;
    const ms = Date.now() - start;
    console.error(`  ✗ ${row.slug} (${ms}ms): ${(e as Error).message.slice(0, 240)}`);
  }
}

console.log(`\n[rankings-faq] ok=${ok} failed=${failed} of ${filtered.length}`);
await client.end();
