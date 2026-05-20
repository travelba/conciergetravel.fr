/**
 * Phase 2 quick win — generate `factual_summary_fr` (130–150 chars) for
 * every ranking that has a populated intro but no factual summary yet.
 *
 * The factual summary is the AEO/GEO sentence that LLMs cite directly
 * (CDC §6, seo-geo.mdc). Format strict :
 *   « [Type] [N] établissements [contexte], du [POI/critère 1] au [critère 2]. »
 *
 * Examples cibles :
 *   - "Sélection Concierge des 8 palaces parisiens triés sur les 13
 *      Atout France actifs en 2026, du Bristol au Crillon."
 *   - "Tour d'horizon des 32 Palaces Atout France en France, de la
 *      collection Mandarin Oriental aux Relais & Châteaux historiques."
 *
 * Uses gpt-5.4 (creative + factual) with temperature 0.3 for consistency.
 * Idempotent : skips rankings that already have a non-null factual_summary_fr.
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

const SYSTEM = `Tu es éditrice senior pour MyConciergeHotel.com, agence IATA premium.
Tu produis des « résumés factuels IA-ready » de 110 à 160 caractères, optimisés AEO/GEO.

Règles strictes :
- Une seule phrase, factuelle, sans superlatif (incroyable, magnifique, etc).
- Format : "[Verbe ou nom] [chiffre concret] [type d'établissements] [zone/critère], du [exemple 1] au [exemple 2]."
- Pas de marketing creux. Mention d'un chiffre vérifiable + d'un repère reconnaissable.
- Pas de point d'exclamation, pas d'emoji, pas de balise HTML.
- Si le titre / l'intro mentionne un chiffre, reprends-le tel quel.
- IMPORTANT : entre 110 et 160 caractères (espaces inclus). Si le sujet est local et offre peu de matière, complète par un repère géographique précis (rue, monument, distance) plutôt qu'une formule creuse.
- Réponds en JSON STRICT : { "factual_summary_fr": "..." }.`;

function buildUserPrompt(title: string, intro: string): string {
  return [
    `Titre : ${title}`,
    `Intro :`,
    intro.slice(0, 1500),
    '',
    'Génère le factual_summary_fr en respectant la longueur 130–150 chars.',
    'Retourne UNIQUEMENT le JSON.',
  ].join('\n');
}

const Schema = z.object({ factual_summary_fr: z.string().min(100).max(170) });

interface Row {
  slug: string;
  title_fr: string;
  intro_fr: string;
}

await client.connect();

const { rows } = await client.query<Row>(`
  select slug, title_fr, intro_fr
    from public.editorial_rankings
   where factual_summary_fr is null
     and intro_fr is not null
     and length(intro_fr) > 200
   order by slug;
`);

console.log(`[factual] ${rows.length} rankings to enrich with factual_summary_fr`);

let ok = 0;
let failed = 0;

for (const row of rows) {
  const start = Date.now();
  try {
    const useNewParams = /^(gpt-5|o3$|o4-mini)/.test(MODEL);
    const params: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildUserPrompt(row.title_fr, row.intro_fr) },
      ],
      response_format: { type: 'json_object' as const },
    };
    if (useNewParams) {
      params['max_completion_tokens'] = 500;
    } else {
      params['temperature'] = 0.3;
      params['max_tokens'] = 500;
    }
    const resp = await openai.chat.completions.create(params as never);
    const raw = resp.choices[0]?.message.content ?? '';
    const parsed = Schema.parse(JSON.parse(raw));
    const fs = parsed.factual_summary_fr.trim();
    await client.query(
      `update public.editorial_rankings set factual_summary_fr = $1, updated_at = timezone('utc', now()) where slug = $2 and factual_summary_fr is null`,
      [fs, row.slug],
    );
    ok += 1;
    const ms = Date.now() - start;
    console.log(`  ✓ ${row.slug} (${fs.length} chars, ${ms}ms): ${fs}`);
  } catch (e) {
    failed += 1;
    const ms = Date.now() - start;
    console.error(`  ✗ ${row.slug} (${ms}ms): ${(e as Error).message.slice(0, 200)}`);
  }
}

console.log(`\n[factual] ok=${ok} failed=${failed} of ${rows.length}`);
await client.end();
