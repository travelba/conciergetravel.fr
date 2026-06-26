/**
 * Throwaway (tmp-*): dump the 2026-06-25 net-new cohort slugs that still
 * need long_description_sections (< 6) to a file, city-ordered, for the
 * continuous long-read run via `--slugs-file=`. Reads PostgREST creds from
 * the root .env.local.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, '../../.env.local') });

const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
if (url === undefined || key === undefined) throw new Error('missing supabase env');

interface Row {
  readonly slug: string;
  readonly city: string | null;
  readonly long_description_sections: readonly unknown[] | null;
}

async function main(): Promise<void> {
  const out: Row[] = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const qs = new URLSearchParams();
    qs.set('select', 'slug,city,long_description_sections');
    qs.set('is_published', 'eq.true');
    qs.set('priority', 'eq.P2');
    qs.set('booking_mode', 'eq.display_only');
    qs.set('created_at', 'gte.2026-06-25');
    qs.set('order', 'city.asc,slug.asc');
    qs.set('limit', String(pageSize));
    qs.set('offset', String(offset));
    const res = await fetch(`${url}/rest/v1/hotels?${qs.toString()}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`select failed ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as Row[];
    out.push(...page);
    if (page.length < pageSize) break;
    offset += page.length;
  }
  const need = out.filter((r) => (r.long_description_sections?.length ?? 0) < 6).map((r) => r.slug);
  const target = path.resolve(here, 'runs/remaining-longread-slugs.txt');
  writeFileSync(target, need.join('\n'), 'utf8');
  console.log(`wrote ${need.length} slugs (of ${out.length} cohort) → ${target}`);
}

void main();
