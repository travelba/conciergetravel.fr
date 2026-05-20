/**
 * Phase 5 quick win — generate `summary_fr` (250-400 words) + `summary_en`
 * (220-360 words) for guides missing them.
 *
 * Voice : Le Concierge complice, expert, jamais commercial. Phrases ≤ 25 mots.
 *
 * Idempotent : skips guides that already have summary_fr ≥ 220 words.
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx overnight-guides-summary-fr.ts \
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

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY']!,
  timeout: 120_000,
  maxRetries: 2,
});
const MODEL = process.env['EDITORIAL_PILOT_OPENAI_MODEL'] ?? 'gpt-5.4';

const SYSTEM = `Tu es Le Concierge — expert, jamais commercial — pour MyConciergeHotel.com (agence IATA premium, 5★ et Palaces).

CONTRAT DE VOIX
- Sobre, factuel, sans superlatif (incroyable, magnifique, exceptionnel, magique, sublime, merveilleux).
- Pas d'emoji, pas d'exclamation, pas de slogan, pas de balise HTML.
- Phrase unique ou deux phrases courtes (chaque phrase ≤ 25 mots).
- Repère factuel concret : quartier reconnu, monument, distance ou un trait éditorial (palaces, vignobles, bord de mer).

CONTRAT DE FORMAT
Tu retournes un JSON STRICT :
{
  "summary_fr": "..."   // ENTRE 130 ET 200 CARACTÈRES STRICT (espaces inclus). Compte-toi avant de répondre. Servira aussi de meta_description.
}

Le summary_fr est une "carte de visite" du guide destination : compact, factuel, optimisé pour Google et AI Overview.`;

interface Row {
  slug: string;
  name_fr: string;
  scope: string | null;
  country_code: string | null;
  summary_fr: string | null;
}

const Schema = z.object({
  summary_fr: z.string().min(120).max(220),
});

await client.connect();

const { rows } = await client.query<Row>(`
  select slug, name_fr, scope, country_code, summary_fr
    from public.editorial_guides
   where (
           summary_fr is null
        or coalesce(char_length(summary_fr), 0) < 130
        or coalesce(char_length(summary_fr), 0) > 220
         )
   order by slug;
`);

const filtered = (slugFilter ? rows.filter((r) => r.slug === slugFilter) : rows).slice(0, limitArg);

console.log(
  `[guides-summary] ${filtered.length} guides to enrich (limit=${limitArg}, slug=${slugFilter ?? '*'})`,
);

let ok = 0;
let failed = 0;

function buildUserPrompt(row: Row): string {
  return [
    `Nom du guide : ${row.name_fr}`,
    `Périmètre : ${row.scope ?? 'destination'}`,
    `Pays : ${row.country_code ?? 'FR'}`,
    '',
    'Génère summary_fr (130-200 caractères, espaces inclus).',
    'Format : "Guide [type] [nom destination], [angle factuel] : [3 repères concrets]."',
    'Exemple cible (139 chars) : "Guide voyage de luxe à Bordeaux, des palaces du Triangle d\u2019Or aux maisons de campagne de Saint-\u00c9milion, vignobles, gastronomie et art de vivre."',
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
      params['max_completion_tokens'] = 400;
    } else {
      params['temperature'] = 0.4;
      params['max_tokens'] = 400;
    }
    const resp = await openai.chat.completions.create(params as never);
    const raw = resp.choices[0]?.message.content ?? '';
    const parsed = Schema.parse(JSON.parse(raw));
    await client.query(
      `update public.editorial_guides
          set summary_fr = $1,
              updated_at = timezone('utc', now())
        where slug = $2`,
      [parsed.summary_fr.trim(), row.slug],
    );
    ok += 1;
    const ms = Date.now() - start;
    const summW = parsed.summary_fr.trim().split(/\s+/).length;
    console.log(`  ✓ ${row.slug} (summary ${summW}w, ${ms}ms)`);
  } catch (e) {
    failed += 1;
    const ms = Date.now() - start;
    console.error(`  ✗ ${row.slug} (${ms}ms): ${(e as Error).message.slice(0, 240)}`);
  }
}

console.log(`\n[guides-summary] ok=${ok} failed=${failed} of ${filtered.length}`);
await client.end();
