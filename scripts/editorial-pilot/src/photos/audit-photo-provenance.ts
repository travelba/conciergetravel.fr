/**
 * Provenance-only photo audit (NO Vision / NO OpenAI).
 *
 * Audits `hotels.gallery_images` + `hero_image` for mis-attribution
 * caveats using metadata signals ONLY:
 *   1. `public_id` pipeline prefix — how a photo was sourced
 *      (`places-*` = Google Places geo-tagged, `press-*` = Tavily crawl of
 *      `official_url`, `commons-*` = Wikimedia, `poi-*` = POI). A `press-*`
 *      photo is only as trustworthy as the `official_url` it was crawled from.
 *   2. `external_sources` / `official_url` — the entity the `press-*` photos
 *      were crawled from. A residences/condo/off-plan/squatter URL means the
 *      `press-*` set depicts a DIFFERENT entity than the hotel.
 *   3. Stored `alt_*` / `caption_*` (already-written Vision descriptions, read
 *      as metadata — we do NOT call Vision) — render/maquette markers
 *      (`scale model`, `maquette`, `rendering`, `artist's impression`, `CGI`).
 *
 * Classification per photo: OK | DOUTEUX | CLAIREMENT-FAUX (with reason).
 * `CLAIREMENT-FAUX` is reserved for wrong-entity proven by provenance.
 * Renders/maquettes are flagged DOUTEUX (need a Vision pass to confirm pixels)
 * unless the entity itself is proven wrong by provenance.
 *
 * Removal is ALWAYS explicit (`--remove="slug:public_id,...;slug2:..."`) so the
 * operator decides exactly which `public_id`s leave the gallery. The tool:
 *   - refuses to remove the `hero_image` public_id,
 *   - backs the full pre-edit state up to runs/photo-caveat-backup-<date>.json,
 *   - warns (does not block) when a removal leaves a gallery below MIN_GALLERY.
 *
 * Usage (PowerShell, `;` separators, stderr via `*>`):
 *   npx tsx src/photos/audit-photo-provenance.ts --slugs=a,b,c
 *   npx tsx src/photos/audit-photo-provenance.ts --slugs=a,b --remove="a:cct/hotels/a/press-1" --apply
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { isToxicOfficialUrl } from '../enrichment/toxic-official-url';
import { loadPhotoEnv } from './env-photos';
import { patchHotelById, selectHotels } from './supabase-rest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNS_DIR = resolve(__dirname, '../../runs');

/** A gallery row carries at least a public_id; the rest is optional metadata. */
interface GalleryRow {
  readonly public_id?: unknown;
  readonly alt_fr?: unknown;
  readonly alt_en?: unknown;
  readonly caption_fr?: unknown;
  readonly caption_en?: unknown;
  readonly category?: unknown;
  readonly [key: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string | null;
  readonly country_code: string | null;
  readonly is_published: boolean;
  readonly hero_image: string | null;
  readonly gallery_images: GalleryRow[] | null;
  readonly official_url: string | null;
  readonly external_sources: unknown;
}

type Verdict = 'OK' | 'DOUTEUX' | 'CLAIREMENT-FAUX';

interface PhotoClassification {
  readonly publicId: string;
  readonly pipeline: string;
  readonly category: string;
  readonly verdict: Verdict;
  readonly reasons: string[];
}

const HOTEL_COLUMNS =
  'id,slug,name,city,country_code,is_published,hero_image,gallery_images,official_url,external_sources';

const MIN_GALLERY = 5; // EEAT guard floor (galleryCount >= 5 || hasSections)

const RENDER_MARKER =
  /\b(scale model|miniature model|architectural model|\bmodel\b|maquette|mod[èe]le r[ée]duit|rendering|render farm|artist'?s impression|\bcgi\b|3d render|computer-generated)\b/i;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** The pipeline segment is the public_id's last path token, minus the -N suffix. */
function pipelineOf(publicId: string): string {
  const tail = publicId.split('/').pop() ?? publicId;
  const m = /^([a-z]+)-\d+$/i.exec(tail);
  const prefix = m?.[1];
  return prefix !== undefined ? prefix.toLowerCase() : 'other';
}

function parseArgs(argv: readonly string[]): {
  slugs: string[];
  removals: Map<string, Set<string>>;
  apply: boolean;
} {
  let slugs: string[] = [];
  const removals = new Map<string, Set<string>>();
  let apply = false;
  for (const arg of argv) {
    if (arg.startsWith('--slugs=')) {
      slugs = arg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (arg.startsWith('--remove=')) {
      const spec = arg.slice('--remove='.length);
      for (const group of spec.split(';')) {
        const [slug, ids] = group.split(':');
        if (slug === undefined || ids === undefined) continue;
        const set = removals.get(slug.trim()) ?? new Set<string>();
        for (const id of ids.split(',')) {
          const trimmed = id.trim();
          if (trimmed.length > 0) set.add(trimmed);
        }
        removals.set(slug.trim(), set);
      }
    } else if (arg === '--apply') {
      apply = true;
    }
  }
  return { slugs, removals, apply };
}

function classifyPhoto(
  row: GalleryRow,
  hotel: HotelRow,
  officialUrlIsWrongEntity: boolean,
  wrongEntityLabel: string,
): PhotoClassification {
  const publicId = asString(row.public_id);
  const pipeline = pipelineOf(publicId);
  const category = asString(row.category) || '(none)';
  const text = [row.alt_fr, row.alt_en, row.caption_fr, row.caption_en].map(asString).join(' | ');
  const reasons: string[] = [];
  let verdict: Verdict = 'OK';

  const hasRenderMarker = RENDER_MARKER.test(text);
  if (hasRenderMarker) {
    reasons.push('stored alt/caption explicitly describes a model/maquette/render');
    verdict = 'DOUTEUX';
  }

  if (pipeline === 'press' && officialUrlIsWrongEntity) {
    reasons.push(
      `press-* photo Tavily-crawled from official_url (${wrongEntityLabel}) — wrong entity by provenance`,
    );
    verdict = 'CLAIREMENT-FAUX';
  } else if (pipeline === 'press') {
    reasons.push(
      'press-* photo crawled from official_url (entity depends on official_url validity)',
    );
    if (verdict === 'OK') verdict = 'DOUTEUX';
  } else if (pipeline === 'places') {
    reasons.push(
      'places-* photo from Google Places (geo-tagged; sourcing place_id NOT traced in row)',
    );
  } else if (pipeline === 'commons') {
    reasons.push('commons-* photo from Wikimedia Commons');
  }

  if (reasons.length === 0) reasons.push('no provenance anomaly detected in metadata');
  return { publicId, pipeline, category, verdict, reasons };
}

function main(): void {
  const env = loadPhotoEnv();
  const cfg = { url: env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
  const { slugs, removals, apply } = parseArgs(process.argv.slice(2));

  if (slugs.length === 0) {
    console.error('Provide --slugs=slug1,slug2,...');
    process.exit(1);
  }

  void (async (): Promise<void> => {
    const rows = await selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLUMNS,
      filters: [`slug=in.(${slugs.join(',')})`],
      order: 'slug.asc',
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    const backup: Record<string, { hero_image: string | null; gallery_images: GalleryRow[] }> = {};

    for (const slug of slugs) {
      const hotel = bySlug.get(slug);
      if (hotel === undefined) {
        console.log(`\n### ${slug} — NOT FOUND`);
        continue;
      }
      const gallery = hotel.gallery_images ?? [];
      // A non-brand residences/condo/off-plan/squatter URL means press-* photos
      // depict a different entity. isToxicOfficialUrl catches squatters; the
      // residences/off-plan judgement is operator-supplied via --remove.
      const officialUrl = hotel.official_url ?? '';
      const toxic = officialUrl.length > 0 && isToxicOfficialUrl(officialUrl);
      const wrongEntityLabel = toxic ? `toxic/squatter: ${officialUrl}` : officialUrl;

      console.log(
        `\n### ${slug} — ${hotel.name} (${hotel.city ?? '?'}, ${hotel.country_code ?? '?'})`,
      );
      console.log(`hero_image: ${hotel.hero_image ?? '(null)'}`);
      console.log(
        `official_url: ${officialUrl || '(null)'}${toxic ? '  [TOXIC by isToxicOfficialUrl]' : ''}`,
      );
      console.log(`gallery: ${gallery.length} photos`);

      const classifications = gallery.map((g) => classifyPhoto(g, hotel, toxic, wrongEntityLabel));
      for (const c of classifications) {
        console.log(`  [${c.verdict}] ${c.publicId} (pipeline=${c.pipeline}, cat=${c.category})`);
        for (const r of c.reasons) console.log(`        - ${r}`);
      }

      backup[slug] = { hero_image: hotel.hero_image, gallery_images: gallery };
    }

    if (removals.size === 0) {
      console.log('\nNo --remove specified — audit only (no DB writes).');
      return;
    }

    // Persist a backup BEFORE any write.
    mkdirSync(RUNS_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const backupPath = resolve(RUNS_DIR, `photo-caveat-backup-${date}.json`);
    writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`\nBackup written: ${backupPath}`);

    for (const [slug, idsToRemove] of removals) {
      const hotel = bySlug.get(slug);
      if (hotel === undefined) {
        console.log(`\n[remove] ${slug} — NOT FOUND, skipping`);
        continue;
      }
      const gallery = hotel.gallery_images ?? [];
      if (hotel.hero_image !== null && idsToRemove.has(hotel.hero_image)) {
        console.log(
          `\n[remove] ${slug} — REFUSED: ${hotel.hero_image} is the hero_image. Skipping whole hotel.`,
        );
        continue;
      }
      const kept = gallery.filter((g) => !idsToRemove.has(asString(g.public_id)));
      const removed = gallery.length - kept.length;
      console.log(
        `\n[remove] ${slug} — removing ${removed}/${gallery.length} photos → ${kept.length} remain`,
      );
      if (kept.length < MIN_GALLERY) {
        console.log(
          `         ⚠ WARNING: gallery now ${kept.length} (< ${MIN_GALLERY}); page stays indexable only via editorial sections. Flag for re-source.`,
        );
      }
      if (kept.length === 0) {
        console.log('         REFUSED: would empty the gallery. Skipping.');
        continue;
      }
      if (!apply) {
        console.log('         DRY-RUN (no --apply): not writing.');
        continue;
      }
      await patchHotelById(cfg, hotel.id, { gallery_images: kept });
      console.log('         APPLIED.');
    }
  })().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}

main();
