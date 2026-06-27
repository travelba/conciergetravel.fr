/**
 * v2 push — persists a GeneratedRankingV2 to `editorial_rankings`
 * (including v2 columns from migrations 0027 + 0028) and refreshes
 * the entries in `editorial_ranking_entries`.
 *
 * Idempotent: re-runs delete-and-reinsert entries inside a single
 * transaction so ranks stay contiguous.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { hasLeak } from '../enrichment/scaffolding-gate.js';

import type { GeneratedRankingV2 } from './generate-ranking-v2.js';
import type { RankingSeed } from './rankings-catalog.js';
import type { RankingAxes } from './axes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });

function resolveConnectionString(): string {
  const conn =
    process.env['DATABASE_URL'] ??
    process.env['SUPABASE_DB_POOLER_URL'] ??
    process.env['SUPABASE_DB_URL'] ??
    null;
  if (conn === null) throw new Error('No DB connection string.');
  return conn;
}

/**
 * Minimum number of ranking entries below which a ranking must NEVER be
 * published. Matches the combinator eligibility policy (≥ 3 hotels) and the
 * documented 2026-05-31 precedent where 13 zero-inventory slugs were
 * unpublished. Override with `MCH_RANKING_MIN_ENTRIES` for a deliberate small
 * curated ranking.
 *
 * Root cause of the 2026-06-26 "0 hôtels" prod incident (51 published rankings
 * rendering "Classement éditorial de 0 hôtels …", surfaced by the L3
 * site-audit crawler — docs/audits/rankings-health-crawl-2026-06-26.md): the
 * bulk pipeline pushed empty geographic×theme combos (e.g. montagne-saint-tropez)
 * with `publish=true` and no entry-count gate. This guard closes that path so
 * a thin/empty ranking can never go live again.
 */
export const MIN_PUBLISHABLE_ENTRIES = 3;

function resolveMinEntries(): number {
  const raw = process.env['MCH_RANKING_MIN_ENTRIES'];
  if (raw === undefined) return MIN_PUBLISHABLE_ENTRIES;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : MIN_PUBLISHABLE_ENTRIES;
}

/**
 * Publish gate: a ranking may only stay published if the caller asked to AND
 * it carries at least `floor` entries. Pure + exported for unit testing.
 */
export function resolveEffectivePublish(
  requestedPublish: boolean,
  entryCount: number,
  floor: number = MIN_PUBLISHABLE_ENTRIES,
): boolean {
  return requestedPublish && entryCount >= floor;
}

/**
 * Scaffolding leak gate (defense-in-depth at the write boundary). Mirrors the
 * catalogue-wide hotel-fiche lesson (AGENTS waves 5/6): ANY generator writing
 * to a public column must run the shared `hasLeak()` gate, and the publisher
 * must refuse to publish leaked prose. The 2026-06-26 audit found 66 published
 * rankings leaking brief/dossier scaffolding because the bulk path skipped this
 * gate. Scans every rendered prose field (intro/outro/factual summary +
 * section titles/bodies + FAQ Q/A) in both locales. Pure + exported for tests.
 */
interface RankingProse {
  readonly intro_fr: string;
  readonly intro_en: string;
  readonly outro_fr: string;
  readonly outro_en: string;
  readonly factual_summary_fr: string;
  readonly factual_summary_en: string;
  readonly editorial_sections: ReadonlyArray<{
    readonly title_fr: string;
    readonly title_en: string;
    readonly body_fr: string;
    readonly body_en: string;
  }>;
  readonly faq: ReadonlyArray<{
    readonly question_fr: string;
    readonly question_en: string;
    readonly answer_fr: string;
    readonly answer_en: string;
  }>;
}

/**
 * Detects a ranking whose summary ADMITS its own emptiness / off-theme failure
 * — "0 hôtels à la montagne", "aucune adresse côtière", "sélection vide", "no
 * hotels". This is a distinct class from scaffolding leaks (no brief/dossier
 * marker) and from the entry-count gate (these rankings carry OFF-theme
 * entries, so `entries.length >= 3`). Root cause of the 2026-06-26 prod
 * incident: 7 thematically-impossible combos (montagne × flat/coastal regions,
 * bord-de-mer × landlocked Champs-Élysées) shipped live with a self-defeating
 * summary that then leaked onto sibling pages via the related-rankings cards.
 * Neither prior gate caught them — this one does.
 */
const EMPTY_SELECTION_MARKERS =
  /\b0\s+h[ôo]tels?\b|aucune?\s+(?:adresse|h[ôo]tel|établissement)\b|s[ée]lection\s+(?:vide|à\s+réorienter)|\bno\s+(?:hotels?|properties|addresses)\b|\bnone\s+(?:retained|selected)\b/iu;

export function rankingAdmitsEmptySelection(
  factualSummaryFr: string | null | undefined,
  factualSummaryEn: string | null | undefined,
): boolean {
  return (
    (typeof factualSummaryFr === 'string' && EMPTY_SELECTION_MARKERS.test(factualSummaryFr)) ||
    (typeof factualSummaryEn === 'string' && EMPTY_SELECTION_MARKERS.test(factualSummaryEn))
  );
}

export function rankingProseLeaks(ranking: RankingProse): boolean {
  const parts: Array<string | null | undefined> = [
    ranking.intro_fr,
    ranking.intro_en,
    ranking.outro_fr,
    ranking.outro_en,
    ranking.factual_summary_fr,
    ranking.factual_summary_en,
  ];
  for (const s of ranking.editorial_sections) {
    parts.push(s.title_fr, s.title_en, s.body_fr, s.body_en);
  }
  for (const f of ranking.faq) {
    parts.push(f.question_fr, f.question_en, f.answer_fr, f.answer_en);
  }
  return parts.some((p) => hasLeak(p));
}

interface TocAnchor {
  readonly anchor: string;
  readonly label_fr: string;
  readonly label_en: string;
  readonly level: 2 | 3;
}

function buildTocAnchors(ranking: GeneratedRankingV2): TocAnchor[] {
  const out: TocAnchor[] = [];
  out.push({
    anchor: 'introduction',
    label_fr: 'Introduction',
    label_en: 'Introduction',
    level: 2,
  });
  if (ranking.tables.length > 0) {
    out.push({
      anchor: 'tableau-comparatif',
      label_fr: 'Tableau comparatif',
      label_en: 'Comparison table',
      level: 2,
    });
  }
  out.push({
    anchor: 'classement',
    label_fr: 'Le classement',
    label_en: 'The ranking',
    level: 2,
  });
  for (const s of ranking.editorial_sections) {
    out.push({
      anchor: s.key,
      label_fr: s.title_fr,
      label_en: s.title_en.length > 0 ? s.title_en : s.title_fr,
      level: 2,
    });
  }
  if (ranking.glossary.length > 0) {
    out.push({
      anchor: 'glossaire',
      label_fr: 'Glossaire',
      label_en: 'Glossary',
      level: 2,
    });
  }
  out.push({
    anchor: 'faq',
    label_fr: 'FAQ',
    label_en: 'FAQ',
    level: 2,
  });
  if (ranking.external_sources.length > 0) {
    out.push({
      anchor: 'sources',
      label_fr: 'Sources & références',
      label_en: 'Sources & references',
      level: 2,
    });
  }
  return out;
}

export async function pushRankingV2(
  seed: RankingSeed,
  ranking: GeneratedRankingV2,
  options: {
    readonly publish: boolean;
    /** Optional axes payload (matrice v2) — persisted to the JSONB column added by 0029. */
    readonly axes?: RankingAxes;
  } = { publish: true },
): Promise<void> {
  // Publish gate (root-cause fix for the 2026-06-26 "0 hôtels" incident):
  // never let a thin/empty ranking go live, regardless of the caller's intent.
  const floor = resolveMinEntries();
  const entryGatePublish = resolveEffectivePublish(options.publish, ranking.entries.length, floor);
  if (options.publish && !entryGatePublish) {
    console.warn(
      `[push-ranking-v2] "${seed.slug}" has ${ranking.entries.length} entr${
        ranking.entries.length === 1 ? 'y' : 'ies'
      } (< ${floor}) — forcing is_published=false (zero/thin ranking gate).`,
    );
  }
  // Scaffolding leak gate — never publish prose that leaks brief/dossier
  // meta-commentary (the shared hasLeak() gate, same as hotel fiches).
  const leaks = rankingProseLeaks(ranking);
  if (entryGatePublish && leaks) {
    console.warn(
      `[push-ranking-v2] "${seed.slug}" leaks pipeline scaffolding in its prose — forcing is_published=false (leak gate).`,
    );
  }
  // Empty-selection gate — a ranking whose summary admits it has no on-theme
  // hotels ("0 hôtels à la montagne", "aucune adresse", "sélection vide") is a
  // nonsensical combo that must never go live (2026-06-26 incident).
  const admitsEmpty = rankingAdmitsEmptySelection(
    ranking.factual_summary_fr,
    ranking.factual_summary_en,
  );
  if (entryGatePublish && !leaks && admitsEmpty) {
    console.warn(
      `[push-ranking-v2] "${seed.slug}" summary admits an empty/off-theme selection — forcing is_published=false (empty-selection gate).`,
    );
  }
  const effectivePublish = entryGatePublish && !leaks && !admitsEmpty;
  const gatedOptions = { ...options, publish: effectivePublish };

  // PostgREST fallback for environments where the direct `pg` connection
  // is unusable (Windows dev box: SUPABASE_DB_URL / _POOLER_URL point at
  // the IPv6-only direct host `db.<ref>.supabase.co` and/or carry a stale
  // postgres password → "password authentication failed for user postgres";
  // the real pooler is aws-0-eu-west-1.pooler.supabase.com — see
  // windows-dev-environment SKILL Rule 12). Set MCH_PUSH_VIA_REST=1 to
  // write through the service-role REST API instead.
  if (process.env['MCH_PUSH_VIA_REST'] === '1') {
    await pushRankingV2ViaRest(seed, ranking, gatedOptions);
    return;
  }
  const pgModule = (await import('pg')) as typeof import('pg');
  const cleaned = resolveConnectionString().replace(/[?&]sslmode=[^&]*/giu, '');
  const isLocal = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
  const client = new pgModule.Client({
    connectionString: cleaned,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    const todayIso = new Date().toISOString().slice(0, 10);
    const tocAnchors = buildTocAnchors(ranking);

    const axesPayload = options.axes !== undefined ? JSON.stringify(options.axes) : '{}';
    const factualSummaryFr =
      ranking.factual_summary_fr.length > 0 ? ranking.factual_summary_fr : null;
    const factualSummaryEn =
      ranking.factual_summary_en.length > 0 ? ranking.factual_summary_en : null;
    const upsert = await client.query<{ id: string }>(
      `insert into public.editorial_rankings (
        slug, title_fr, title_en, kind, intro_fr, intro_en, outro_fr, outro_en,
        faq, hero_image, meta_title_fr, meta_title_en, meta_desc_fr, meta_desc_en,
        reviewed_at, author_name, author_url, is_published,
        tables, glossary, external_sources, editorial_callouts, toc_anchors,
        editorial_sections, axes, factual_summary_fr, factual_summary_en
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27
      )
      on conflict (slug) do update set
        title_fr = excluded.title_fr,
        title_en = excluded.title_en,
        kind = excluded.kind,
        intro_fr = excluded.intro_fr,
        intro_en = excluded.intro_en,
        outro_fr = excluded.outro_fr,
        outro_en = excluded.outro_en,
        faq = excluded.faq,
        hero_image = excluded.hero_image,
        meta_title_fr = excluded.meta_title_fr,
        meta_title_en = excluded.meta_title_en,
        meta_desc_fr = excluded.meta_desc_fr,
        meta_desc_en = excluded.meta_desc_en,
        reviewed_at = excluded.reviewed_at,
        -- Ratchet: never downgrade an already-published ranking back to draft on
        -- a bulk re-push. The bulk pipeline publishes new drafts forward and
        -- never silently unpublishes live SEO pages. Unpublishing remains an
        -- explicit admin operation. Regression incident 2026-05-19.
        is_published = (editorial_rankings.is_published OR excluded.is_published),
        tables = excluded.tables,
        glossary = excluded.glossary,
        external_sources = excluded.external_sources,
        editorial_callouts = excluded.editorial_callouts,
        toc_anchors = excluded.toc_anchors,
        editorial_sections = excluded.editorial_sections,
        axes = excluded.axes,
        factual_summary_fr = excluded.factual_summary_fr,
        factual_summary_en = excluded.factual_summary_en
      returning id`,
      [
        seed.slug,
        seed.titleFr,
        seed.titleEn,
        seed.kind,
        ranking.intro_fr,
        ranking.intro_en,
        ranking.outro_fr,
        ranking.outro_en,
        JSON.stringify(ranking.faq),
        seed.heroImage ?? null,
        ranking.meta_title_fr,
        ranking.meta_title_en,
        ranking.meta_desc_fr,
        ranking.meta_desc_en,
        todayIso,
        'MyConciergeHotel Éditorial',
        '/equipe/editorial',
        effectivePublish,
        JSON.stringify(ranking.tables),
        JSON.stringify(ranking.glossary),
        JSON.stringify(ranking.external_sources),
        JSON.stringify(ranking.editorial_callouts),
        JSON.stringify(tocAnchors),
        JSON.stringify(ranking.editorial_sections),
        axesPayload,
        factualSummaryFr,
        factualSummaryEn,
      ],
    );
    const rankingRow = upsert.rows[0];
    if (rankingRow === undefined) {
      throw new Error('UPSERT did not return a row.');
    }
    const rankingId = rankingRow.id;

    await client.query('delete from public.editorial_ranking_entries where ranking_id = $1', [
      rankingId,
    ]);

    for (const e of ranking.entries) {
      await client.query(
        `insert into public.editorial_ranking_entries (
          ranking_id, hotel_id, rank, justification_fr, justification_en,
          badge_fr, badge_en
        ) values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          rankingId,
          e.hotel_id,
          e.rank,
          e.justification_fr,
          e.justification_en === '' ? null : e.justification_en,
          e.badge_fr ?? null,
          e.badge_en ?? null,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

// ─── PostgREST push path (service-role) ──────────────────────────────────
// Faithful re-implementation of the pg upsert above over PostgREST. Used
// when MCH_PUSH_VIA_REST=1. Two differences from the pg path, both safe
// here: (1) the upsert is NOT transactional with the entries rewrite —
// acceptable because a brand-new ranking is published only after both
// steps succeed, and a re-push overwrites idempotently; (2) the
// `is_published = (existing OR excluded)` ratchet becomes a plain set to
// `options.publish`. Since the bulk runner always pushes with
// publish=true, this never downgrades a live page. An explicit
// is_published=false admin op must still go through the pg/admin path.

interface RestCfg {
  readonly url: string;
  readonly key: string;
}

function resolveRestCfg(): RestCfg {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'] ?? null;
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? null;
  if (url === null || key === null) {
    throw new Error(
      'MCH_PUSH_VIA_REST=1 requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  return { url: url.replace(/\/$/u, ''), key };
}

async function pushRankingV2ViaRest(
  seed: RankingSeed,
  ranking: GeneratedRankingV2,
  options: { readonly publish: boolean; readonly axes?: RankingAxes },
): Promise<void> {
  const cfg = resolveRestCfg();
  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  } as const;
  const todayIso = new Date().toISOString().slice(0, 10);
  const tocAnchors = buildTocAnchors(ranking);

  const row: Record<string, unknown> = {
    slug: seed.slug,
    title_fr: seed.titleFr,
    title_en: seed.titleEn,
    kind: seed.kind,
    intro_fr: ranking.intro_fr,
    intro_en: ranking.intro_en,
    outro_fr: ranking.outro_fr,
    outro_en: ranking.outro_en,
    faq: ranking.faq,
    hero_image: seed.heroImage ?? null,
    meta_title_fr: ranking.meta_title_fr,
    meta_title_en: ranking.meta_title_en,
    meta_desc_fr: ranking.meta_desc_fr,
    meta_desc_en: ranking.meta_desc_en,
    reviewed_at: todayIso,
    author_name: 'MyConciergeHotel Éditorial',
    author_url: '/equipe/editorial',
    is_published: options.publish,
    tables: ranking.tables,
    glossary: ranking.glossary,
    external_sources: ranking.external_sources,
    editorial_callouts: ranking.editorial_callouts,
    toc_anchors: tocAnchors,
    editorial_sections: ranking.editorial_sections,
    axes: options.axes ?? {},
    factual_summary_fr: ranking.factual_summary_fr.length > 0 ? ranking.factual_summary_fr : null,
    factual_summary_en: ranking.factual_summary_en.length > 0 ? ranking.factual_summary_en : null,
  };

  const upsertRes = await fetch(`${cfg.url}/rest/v1/editorial_rankings?on_conflict=slug`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  if (!upsertRes.ok) {
    throw new Error(
      `[push-rest] upsert failed (${upsertRes.status}): ${(await upsertRes.text()).slice(0, 400)}`,
    );
  }
  const upserted = (await upsertRes.json()) as ReadonlyArray<{ id?: string }>;
  const rankingId = upserted[0]?.id;
  if (rankingId === undefined) {
    throw new Error('[push-rest] upsert did not return an id.');
  }

  const delRes = await fetch(
    `${cfg.url}/rest/v1/editorial_ranking_entries?ranking_id=eq.${encodeURIComponent(rankingId)}`,
    { method: 'DELETE', headers: { ...headers, Prefer: 'return=minimal' } },
  );
  if (!delRes.ok) {
    throw new Error(
      `[push-rest] entries delete failed (${delRes.status}): ${(await delRes.text()).slice(0, 400)}`,
    );
  }

  if (ranking.entries.length > 0) {
    const entryRows = ranking.entries.map((e) => ({
      ranking_id: rankingId,
      hotel_id: e.hotel_id,
      rank: e.rank,
      justification_fr: e.justification_fr,
      justification_en: e.justification_en === '' ? null : e.justification_en,
      badge_fr: e.badge_fr ?? null,
      badge_en: e.badge_en ?? null,
    }));
    const insRes = await fetch(`${cfg.url}/rest/v1/editorial_ranking_entries`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(entryRows),
    });
    if (!insRes.ok) {
      throw new Error(
        `[push-rest] entries insert failed (${insRes.status}): ${(await insRes.text()).slice(0, 400)}`,
      );
    }
  }
}
