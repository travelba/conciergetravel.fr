/**
 * verify-sections-schema.ts — one-off guard: does every published hotel's
 * `long_description_sections` still PARSE against the frontend schema
 * (apps/web/src/server/hotels/get-hotel-by-slug.ts → LongDescriptionSectionSchema)?
 *
 * The frontend rejects empty-string fields (`z.string().min(1).optional()`):
 * a single `body_en: ""` anywhere makes the WHOLE array fail safeParse and the
 * hotel story vanishes. This script replicates that exact validation and
 * reports every fiche that would render no story.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { selectHotels, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

const ANCHOR_REGEX = /^[a-z][a-z0-9-]{1,40}$/;
const SectionSchema = z.object({
  anchor: z.string().regex(ANCHOR_REGEX),
  title_fr: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  body_fr: z.string().min(1).optional(),
  body_en: z.string().min(1).optional(),
});
const SectionsSchema = z.array(SectionSchema);

interface Row {
  readonly slug: string;
  readonly long_description_sections: unknown;
}

function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0)
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing');
  if (typeof key !== 'string' || key.length < 40)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return { url, serviceRoleKey: key };
}

function emptyStringFields(sections: unknown): string[] {
  const hits: string[] = [];
  if (!Array.isArray(sections)) return hits;
  sections.forEach((s, i) => {
    if (s === null || typeof s !== 'object') return;
    for (const k of ['title_fr', 'title_en', 'body_fr', 'body_en'] as const) {
      const v = (s as Record<string, unknown>)[k];
      if (v === '') hits.push(`[${i}].${k}=""`);
    }
    const anchor = (s as Record<string, unknown>)['anchor'];
    if (typeof anchor !== 'string' || !ANCHOR_REGEX.test(anchor))
      hits.push(`[${i}].anchor=invalid(${String(anchor)})`);
  });
  return hits;
}

async function main(): Promise<void> {
  const cfg = loadRestConfig();
  const dump = process.argv.includes('--dump');
  const explicit = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (dump && explicit.length > 0) {
    const rows = await selectHotels<Row>(cfg, {
      columns: 'slug,long_description_sections',
      filters: [`slug=in.(${explicit.join(',')})`],
    });
    for (const r of rows) {
      const secs = Array.isArray(r.long_description_sections) ? r.long_description_sections : [];
      secs.forEach((s, i) => {
        const o = (s ?? {}) as Record<string, unknown>;
        const fr = typeof o['body_fr'] === 'string' ? (o['body_fr'] as string) : '';
        console.log(
          `${r.slug} [${i}] anchor=${String(o['anchor'])} title_fr=${String(o['title_fr'])?.slice(0, 40)} body_fr_len=${fr.length}`,
        );
      });
    }
    return;
  }
  const rows = await selectHotels<Row>(cfg, {
    columns: 'slug,long_description_sections',
    filters: ['is_published=eq.true', 'long_description_sections=not.is.null'],
    order: 'slug.asc',
    limit: 5000,
  });
  let total = 0;
  let failing = 0;
  const failingSlugs: string[] = [];
  for (const r of rows) {
    total += 1;
    const parsed = SectionsSchema.safeParse(r.long_description_sections);
    const ok = parsed.success;
    const showThis = explicit.length === 0 ? !ok : explicit.includes(r.slug);
    if (!ok) {
      failing += 1;
      failingSlugs.push(r.slug);
    }
    if (showThis) {
      const hits = emptyStringFields(r.long_description_sections);
      console.log(
        `${ok ? '✓' : '✗'} ${r.slug} — parse=${ok ? 'OK' : 'FAIL'}${hits.length ? ` — breakers: ${hits.slice(0, 6).join(', ')}` : ''}`,
      );
    }
  }
  console.log(
    `\nScanned ${total} published fiches with sections. FAIL (story would vanish): ${failing}.`,
  );
  if (failing > 0) {
    console.log(`First failing slugs: ${failingSlugs.slice(0, 20).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
