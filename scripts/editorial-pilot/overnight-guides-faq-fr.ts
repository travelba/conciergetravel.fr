/**
 * Phase 5 — generate `faq` (5-10 Q&A pairs FR) for destination guides.
 *
 * Each entry: { question_fr, answer_fr, category? }
 *
 * Voice : Le Concierge factuel et concis. Réponses 50-100 mots (densité AEO).
 * Idempotent : skips guides with faq_count >= 5.
 *
 * Usage:
 *   pnpm exec tsx overnight-guides-faq-fr.ts [--limit N] [--slug X] [--scope country]
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
const scopeFilter = (() => {
  const i = args.indexOf('--scope');
  return i >= 0 ? (args[i + 1] ?? null) : null;
})();

const conn = (
  process.env['SUPABASE_DB_POOLER_URL'] ??
  process.env['SUPABASE_DB_URL'] ??
  ''
).replace(/[?&]sslmode=[^&]*/giu, '');
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY']!,
  timeout: 120_000,
  maxRetries: 2,
});
const MODEL = process.env['EDITORIAL_PILOT_OPENAI_MODEL'] ?? 'gpt-5.4';

const SYSTEM = `Tu es Le Concierge — expert factuel — pour MyConciergeHotel.com (agence IATA premium).

CONTRAT DE VOIX
- Tu informes, tu ne vends pas. Pas de superlatif vide.
- Phrases courtes : ≤ 25 mots STRICT.
- Repère factuel concret : étoiles Atout France, Michelin, Forbes Travel Guide, distance en km, quartier, mois.
- Réponses 50-100 mots (densité AEO pour FAQPage JSON-LD).
- Pas d'emoji, pas d'exclamation, pas de markdown.
- Pas de lexique IA-typique : niché, joyau, écrin, havre, escapade, dépaysement, art de vivre.

CONTRAT DE FORMAT
Tu retournes un JSON STRICT :
{
  "faq": [
    { "question_fr": "...", "answer_fr": "...", "category": "..." },
    ...  // 5 à 8 entrées au total
  ]
}

Catégories autorisées : "saisonnalite", "transport", "budget", "formalites", "famille", "luxe", "experience", "securite", "gastronomie", "logement".

Les questions sont celles que se pose un voyageur premium qui prépare un séjour 5★ dans cette destination.
Exemples : "Quelle est la meilleure saison pour partir ?", "Quel budget prévoir pour 4 nuits en hôtel 5★ ?", "Faut-il un visa pour les Français ?", "Quels quartiers privilégier ?", "Quelle compagnie aérienne choisir depuis Paris ?".`;

interface Row {
  slug: string;
  name_fr: string;
  scope: string;
  country_code: string;
  summary_fr: string;
  summary_long_fr: string | null;
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
  select slug, name_fr, scope, country_code, summary_fr, summary_long_fr
    from public.editorial_guides
   where (
           faq is null
        or jsonb_typeof(faq) <> 'array'
        or jsonb_array_length(faq) < 5
         )
     and char_length(coalesce(summary_fr, '')) >= 60
   order by
     case scope when 'country' then 0 when 'region' then 1 when 'cluster' then 2 else 3 end,
     slug;
`);

const filtered = (
  slugFilter !== null
    ? rows.filter((r) => r.slug === slugFilter)
    : scopeFilter !== null
      ? rows.filter((r) => r.scope === scopeFilter)
      : rows
).slice(0, Number.isFinite(limitArg) ? limitArg : rows.length);

console.log(
  `[guides-faq] ${filtered.length} guides to enrich (limit=${limitArg}, slug=${slugFilter ?? '*'}, scope=${scopeFilter ?? '*'})`,
);

let ok = 0;
let failed = 0;

function buildUserPrompt(row: Row): string {
  const scopeFr =
    row.scope === 'city'
      ? 'ville'
      : row.scope === 'region'
        ? 'région'
        : row.scope === 'cluster'
          ? 'cluster éditorial'
          : 'pays';
  return [
    `Destination : ${row.name_fr}`,
    `Périmètre : ${scopeFr} (${row.scope})`,
    `Pays code : ${row.country_code}`,
    `Carte de visite : ${row.summary_fr}`,
    '',
    'Contexte (extrait du guide pour calibrer le ton) :',
    (row.summary_long_fr ?? row.summary_fr).slice(0, 1500),
    '',
    'Génère 5 à 8 paires Q&A en JSON pour un voyageur premium préparant un séjour 5★ dans cette destination.',
    'Réponses 50-100 mots, ton factuel et opérationnel (mois, distances, budgets €, étoiles Michelin, formalités).',
    'Couvre au moins : saisonnalité, transport/accès, budget, formalités, et 1-2 spécificités locales (gastronomie, sécurité, mœurs).',
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
      `update public.editorial_guides
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

console.log(`\n[guides-faq] ok=${ok} failed=${failed} of ${filtered.length}`);
await client.end();
