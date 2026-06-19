/**
 * remove-scaffold-sections.ts — STAGE 3 of the 2026-06-19 scaffolding-leak
 * remediation (ADR-0029). Deterministic, non-LLM, honest removal of the
 * residual *pure-scaffolding* prose that `descaffold-sections.ts` could not
 * surgically clean and `enrich-residual-sections.ts` could not regenerate
 * (no ≥2 sourced facts). Leaving a placeholder ("AUTO_DRAFT", "niveau de
 * confiance low", "statut pending", "le brief …", Q-ids) rendered live is a
 * worse EEAT regression than a shorter fiche, so we strip it.
 *
 * Rules (conservative — FR is canonical):
 *   - long_description_sections[i]:
 *       · body_fr leaks  → DROP the whole section (pure scaffolding; the
 *         de-scaffolder already preserved every salvageable FR section).
 *       · body_fr clean but body_en leaks → KEEP section, blank body_en
 *         (drop the leaking EN translation only; EN is regenerable).
 *   - concierge_advice: either locale body leaks → set the column to null
 *     (the block self-elides; regenerable via enrich-concierge-handoff).
 *
 * Safeguards:
 *   - --dry-run (default) prints the full impact and writes nothing.
 *   - Never drops a fiche to 0 sections silently — fiches falling below 3
 *     sections are listed (indexability watch) but still cleaned.
 *   - Only ever REMOVES content; never invents.
 *
 * Usage:
 *   tsx src/hotels/remove-scaffold-sections.ts            # dry-run
 *   tsx src/hotels/remove-scaffold-sections.ts --apply     # write
 *   tsx src/hotels/remove-scaffold-sections.ts --apply --limit=50
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

import { hasLeak } from '../enrichment/scaffolding-gate.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

interface Section {
  readonly body_fr?: string | null;
  readonly body_en?: string | null;
  readonly [k: string]: unknown;
}
interface ConciergeAdvice {
  readonly fr?: { readonly body?: string } | null;
  readonly en?: { readonly body?: string } | null;
  readonly [k: string]: unknown;
}
interface Row {
  readonly id: string;
  readonly slug: string;
  readonly long_description_sections: Section[] | null;
  readonly concierge_advice: ConciergeAdvice | null;
}

function cfgFromEnv(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!url || !serviceRoleKey)
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { url, serviceRoleKey };
}

interface Plan {
  readonly id: string;
  readonly slug: string;
  readonly newSections: Section[];
  readonly droppedSections: number;
  readonly blankedEn: number;
  readonly clearConcierge: boolean;
  readonly sectionsAfter: number;
}

function planFor(row: Row): Plan | null {
  const sections = row.long_description_sections ?? [];
  let dropped = 0;
  let blankedEn = 0;
  const newSections: Section[] = [];
  for (const s of sections) {
    if (hasLeak(s.body_fr)) {
      dropped += 1;
      continue;
    }
    if (hasLeak(s.body_en)) {
      blankedEn += 1;
      newSections.push({ ...s, body_en: '' });
    } else {
      newSections.push(s);
    }
  }
  const ca = row.concierge_advice;
  const clearConcierge = ca !== null && (hasLeak(ca.fr?.body) || hasLeak(ca.en?.body));
  if (dropped === 0 && blankedEn === 0 && !clearConcierge) return null;
  return {
    id: row.id,
    slug: row.slug,
    newSections,
    droppedSections: dropped,
    blankedEn,
    clearConcierge,
    sectionsAfter: newSections.length,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : null;
  const cfg = cfgFromEnv();

  const rows = await selectHotels<Row>(cfg, {
    columns: 'id,slug,long_description_sections,concierge_advice',
    filters: ['is_published=eq.true'],
    order: 'slug.asc',
  });

  const plans: Plan[] = [];
  for (const r of rows) {
    const p = planFor(r);
    if (p) plans.push(p);
  }

  const totalDropped = plans.reduce((n, p) => n + p.droppedSections, 0);
  const totalBlankedEn = plans.reduce((n, p) => n + p.blankedEn, 0);
  const totalConcierge = plans.filter((p) => p.clearConcierge).length;
  const thin = plans.filter((p) => p.sectionsAfter < 3);

  console.log(`published scanned = ${rows.length}`);
  console.log(`fiches to clean   = ${plans.length}`);
  console.log(`  sections dropped (body_fr leak) = ${totalDropped}`);
  console.log(`  EN bodies blanked (body_en leak) = ${totalBlankedEn}`);
  console.log(`  concierge_advice cleared         = ${totalConcierge}`);
  console.log(`  fiches dropping < 3 sections     = ${thin.length}`);
  writeFileSync(
    'runs/scaffold-removal-plan.json',
    JSON.stringify(
      {
        plans: plans.map((p) => ({
          slug: p.slug,
          droppedSections: p.droppedSections,
          blankedEn: p.blankedEn,
          clearConcierge: p.clearConcierge,
          sectionsAfter: p.sectionsAfter,
        })),
        thinSlugs: thin.map((t) => t.slug),
      },
      null,
      2,
    ),
  );
  if (thin.length > 0)
    console.log(
      `  thin slugs: ${thin
        .slice(0, 25)
        .map((t) => t.slug)
        .join(', ')}${thin.length > 25 ? ' …' : ''}`,
    );

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
    return;
  }

  const targets = limit ? plans.slice(0, limit) : plans;
  // Rollback safety net: snapshot the ORIGINAL content of every targeted row.
  const targetIds = new Set(targets.map((t) => t.id));
  const backup = rows
    .filter((r) => targetIds.has(r.id))
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      long_description_sections: r.long_description_sections,
      concierge_advice: r.concierge_advice,
    }));
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  writeFileSync(`runs/scaffold-removal-backup-${stamp}.json`, JSON.stringify(backup));
  console.log(
    `\nbackup written → runs/scaffold-removal-backup-${stamp}.json (${backup.length} rows)`,
  );
  console.log(`APPLY — writing ${targets.length} fiche(s)…`);
  let done = 0;
  for (const p of targets) {
    const body: Record<string, unknown> = { long_description_sections: p.newSections };
    if (p.clearConcierge) body['concierge_advice'] = null;
    await patchHotelById(cfg, p.id, body);
    done += 1;
    if (done % 25 === 0) console.log(`  …${done}/${targets.length}`);
  }
  console.log(`Done — wrote ${done} fiche(s).`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
