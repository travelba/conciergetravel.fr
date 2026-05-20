/**
 * Probe OpenAI API to verify which models are usable in May 2026
 * with the current SDK pin (^4.78.0).
 *
 * Usage:
 *   pnpm --filter @mch/editorial-pilot exec tsx scripts/editorial-pilot/probe-models.ts
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../.env') });

const apiKey = process.env['OPENAI_API_KEY'];
if (!apiKey) {
  console.error('OPENAI_API_KEY missing');
  process.exit(1);
}

const client = new OpenAI({ apiKey });

const candidates: Array<[string, boolean]> = [
  ['gpt-5.5', true],
  ['gpt-5', true],
  ['o3', true],
];

async function probe(model: string, withCompletionTokens: boolean): Promise<void> {
  try {
    const params: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'user',
          content:
            'Tu es un concierge senior d\'un palace parisien. Tu connais Hôtel de Crillon. Donne-moi en exactement 30 mots un secret opérationnel sur cet hôtel, en commençant par "Mon conseil :".',
        },
      ],
    };
    if (withCompletionTokens) params['max_completion_tokens'] = 8000;
    else {
      params['max_tokens'] = 200;
      params['temperature'] = 0.7;
    }
    const r = await client.chat.completions.create(params as never);
    const content = r.choices[0]?.message.content?.trim();
    const inT = r.usage?.prompt_tokens ?? 0;
    const outT = r.usage?.completion_tokens ?? 0;
    console.log(
      `✓ ${model.padEnd(20)} | in=${String(inT).padStart(3)} out=${String(outT).padStart(3)} | ${(content ?? '').replace(/\n/g, ' ')}`,
    );
  } catch (e) {
    const msg = (e as Error).message.split('\n')[0];
    console.log(`✗ ${model.padEnd(20)} | ${msg}`);
  }
}

console.log('Probing OpenAI models with current SDK pin...');
console.log('SDK version:', '4.78.0 (locked in package.json)');
console.log('');

for (const [m, useNew] of candidates) {
  await probe(m, useNew);
}
