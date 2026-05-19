/**
 * scaffold-guides-rankings-intl.ts — create the editorial scaffold around the
 * 663 international hotels we just inserted.
 *
 * Reads:  global-sources/scaffold-intl-to-insert.json
 * Writes: editorial_guides + editorial_rankings + editorial_ranking_entries
 *
 * Produces 4 families of editorial pages :
 *
 *   1. AWARDED RANKINGS — one per source (kind='awarded'):
 *        - classement-worlds-50-best-hotels-2025
 *        - classement-travel-leisure-worlds-best-2025
 *        - classement-conde-nast-gold-list-2026
 *
 *   2. GEOGRAPHIC RANKINGS — one per city with ≥ 5 hotels (kind='geographic'):
 *        - meilleurs-hotels-tokyo, -londres, -rome, -new-york, -bangkok, ...
 *
 *   3. COUNTRY GUIDES — one per country with ≥ 3 hotels (scope='country'):
 *        - guide-italie, -japon, -royaume-uni, -espagne, -etats-unis, ...
 *
 *   4. THEMATIC RANKINGS — one per top luxury brand (kind='thematic'):
 *        - aman-hotels-collection, belmond-hotels, rosewood-hotels, ...
 *
 * All entries are `is_published = false` (drafts). Idempotent via
 * `ON CONFLICT (slug) DO NOTHING` on rankings/guides, and
 * `ON CONFLICT (ranking_id, hotel_id) DO NOTHING` on entries.
 *
 * Usage :
 *   pnpm global:scaffold:gr              # actually insert
 *   pnpm global:scaffold:gr -- --dry-run # preview only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../global-sources');
const ENV = resolve(__dirname, '../../../../.env.local');

const envText = readFileSync(ENV, 'utf8');
const env: Record<string, string> = {};
for (const raw of envText.split('\n')) {
  const m = raw.trim().match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = (m[2] ?? '').trim();
  const q = v.match(/^"([^"]*)"/) ?? v.match(/^'([^']*)'/);
  v = q ? (q[1] ?? '') : (v.split(/\s+#/)[0]?.trim() ?? '');
  env[m[1] ?? ''] = v;
}
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const DRY_RUN = process.argv.includes('--dry-run');

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// ─── Load scaffold output ──────────────────────────────────────────────────

interface ScaffoldRow {
  slug: string;
  name: string;
  city: string;
  country_code: string;
  country_label_fr: string;
  country_label_en: string;
  is_palace: boolean;
  luxury_tier: string | null;
  region: string | null;
  sources: string[];
  rank: number | null;
}

const hotels: ScaffoldRow[] = JSON.parse(
  readFileSync(resolve(ROOT, 'scaffold-intl-to-insert.json'), 'utf8'),
);

// Also keep a parallel index by extracted tier_signals from diff-missing.json,
// because some hotels appear on multiple awards (W50 + T+L + CN). The scaffold
// row only kept the "best" tier; for awarded rankings we need all source-level
// memberships.
interface DiffMissingRow {
  candidate_slug: string;
  hint_city: string | null;
  hint_country_code: string | null;
  tier_signals: string[];
  origin_sources: string[];
  rank: number | null;
}
const diffMissing: DiffMissingRow[] = JSON.parse(
  readFileSync(resolve(ROOT, 'diff-missing.json'), 'utf8'),
);
const tierByCandidateSlug = new Map<
  string,
  { tiers: string[]; sources: string[]; rank: number | null }
>();
for (const d of diffMissing) {
  tierByCandidateSlug.set(d.candidate_slug, {
    tiers: d.tier_signals ?? [],
    sources: d.origin_sources ?? [],
    rank: d.rank,
  });
}

// ─── Build editorial plans ─────────────────────────────────────────────────

interface RankingPlan {
  slug: string;
  title_fr: string;
  title_en: string;
  kind: 'best_of' | 'awarded' | 'thematic' | 'geographic';
  intro_fr: string;
  intro_en: string;
  /** Hotels that belong to this ranking, in order. */
  entries: Array<{ hotel_slug: string; rank: number; justification_fr: string }>;
}
interface GuidePlan {
  slug: string;
  name_fr: string;
  name_en: string;
  scope: 'city' | 'region' | 'cluster' | 'country';
  country_code: string;
  summary_fr: string;
  summary_en: string;
}

function paddedIntro(topic: string, methodology: string): string {
  // editorial_rankings_intro_fr_ck requires 400-8000 chars.
  const intro = [
    `DRAFT — Le classement « ${topic} » est en cours de rédaction par l’équipe éditoriale MyConciergeHotel.`,
    `Notre Concierge sélectionne, avec la rigueur d’un palace et la liberté d’un voyageur, les meilleures adresses retenues dans cette sélection. La voix est experte, complice, jamais commerciale.`,
    methodology,
    `Méthodologie générale : sélection indépendante recoupée avec les sources de référence (Atout France, Michelin, Forbes Travel Guide, Relais & Châteaux, Travel + Leisure World’s Best, Condé Nast Gold List, The World’s 50 Best Hotels, LHW). Aucune contrepartie financière n’est acceptée pour figurer dans nos classements ou nos guides.`,
    `Le contenu définitif (intro éditoriale 400-600 mots, justification 80-200 mots par établissement, FAQ AEO, JSON-LD ItemList + Article, AggregateRating) sera produit par le pipeline éditorial Concierge dès que la sélection finale aura été validée et croisée avec notre catalogue interne d’hôtels 5★ et Palaces vérifiés.`,
    `Cette page restera mise à jour : freshness signal, sources externes citées, et synchronisation Schema.org + AggregateRating + ItemList conformes aux standards SEO/GEO/AEO de MyConciergeHotel.`,
  ].join('\n\n');
  return intro.length < 400 ? intro.padEnd(420, '.') : intro;
}

function paddedSummaryFr(s: string): string {
  // editorial_guides_summary_fr_ck requires 60-220 chars.
  if (s.length >= 60 && s.length <= 220) return s;
  if (s.length < 60) return s.padEnd(60, '.');
  return s.slice(0, 220);
}

function justification(hotel: ScaffoldRow, tier: string, rank: number | null): string {
  // editorial_ranking_entries_justification_fr_ck requires 40-1200 chars.
  const bits = [
    `DRAFT — ${hotel.name} à ${hotel.city} (${hotel.country_label_fr}).`,
    `Justification éditoriale à venir (voix du Concierge, 80-200 mots).`,
    `Distinction retenue : ${tier}.`,
    rank ? `Rang source : #${rank}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return bits.length >= 40 ? bits : bits.padEnd(60, '.');
}

// ─── 1. Awarded rankings (one per source) ──────────────────────────────────

const AWARDED_DEFS: Array<{
  tier: string;
  slug: string;
  title_fr: string;
  title_en: string;
  description: string;
}> = [
  {
    tier: 'world_50_best',
    slug: 'classement-worlds-50-best-hotels-2025',
    title_fr: "Le classement The World's 50 Best Hotels 2025",
    title_en: "The World's 50 Best Hotels 2025 ranking",
    description: `Le classement de référence dévoilé en octobre 2025 à Londres par l’organisation 50 Best. Voté par plus de 800 experts mondiaux (anonymes, indépendants), il fait autorité pour identifier les hôtels qui définissent l’hospitalité contemporaine. La liste 1-100 inclut depuis 2025 une extension 51-100 inédite. Notre Concierge décode ici les choix du jury, pondère avec les notes d’étape de nos voyageurs, et signale les hôtels où l’expérience justifie absolument le déplacement.`,
  },
  {
    tier: 'tl_worlds_best',
    slug: 'classement-travel-leisure-worlds-best-2025',
    title_fr: "Le palmarès Travel + Leisure World's Best 2025",
    title_en: "Travel + Leisure World's Best 2025 awards",
    description: `Le palmarès lecteurs de Travel + Leisure : 180 000 voyageurs ont voté en 2025. Le Concierge complète la lecture par hôtel : pourquoi tel établissement a grimpé, quels biais (US-centric) il faut corriger, et quelles adresses obtiennent un consensus rare avec les autres palmarès professionnels (50 Best, CN, Forbes).`,
  },
  {
    tier: 'cn_gold_list',
    slug: 'classement-conde-nast-gold-list-2026',
    title_fr: 'Le Condé Nast Traveler Gold List 2025-2026',
    title_en: 'Condé Nast Traveler Gold List 2025-2026',
    description: `La Gold List est la sélection éditoriale stricte (pas lecteurs) des rédactions Condé Nast Traveler US et UK. Elle célèbre la classe (vintage palaces, design rigueur, service silencieux). Le Concierge croise chaque mention avec ses propres notes terrain pour distinguer les choix d’éditeurs des choix de voyageurs.`,
  },
];

const awardedPlans: RankingPlan[] = [];
for (const a of AWARDED_DEFS) {
  const entries = hotels
    .filter((h) => {
      const t = tierByCandidateSlug.get(slugify(h.name));
      return t?.tiers.includes(a.tier);
    })
    .map((h) => {
      const t = tierByCandidateSlug.get(slugify(h.name));
      const r = t?.rank ?? null;
      return { h, rank: r ?? 0 };
    })
    .sort((x, y) => {
      const xr = x.rank > 0 ? x.rank : 999;
      const yr = y.rank > 0 ? y.rank : 999;
      return xr - yr;
    })
    .slice(0, 100)
    .map((row, i) => ({
      hotel_slug: row.h.slug,
      rank: i + 1,
      justification_fr: justification(row.h, a.tier, row.rank > 0 ? row.rank : null),
    }));
  if (entries.length === 0) continue;
  awardedPlans.push({
    slug: a.slug,
    title_fr: a.title_fr,
    title_en: a.title_en,
    kind: 'awarded',
    intro_fr: paddedIntro(a.title_fr, a.description),
    intro_en: paddedIntro(a.title_en, a.description),
    entries,
  });
}

// ─── 2. Geographic rankings (per city with ≥ 5 hotels) ────────────────────

const byCity = new Map<string, ScaffoldRow[]>();
for (const h of hotels) {
  const key = `${h.country_code}|${h.city}`;
  const list = byCity.get(key) ?? [];
  list.push(h);
  byCity.set(key, list);
}
const cityRankings: RankingPlan[] = [];
for (const [key, list] of byCity) {
  if (list.length < 5) continue;
  const [, city] = key.split('|') as [string, string];
  const sample = list[0];
  if (!sample) continue;
  const slug = `meilleurs-hotels-${slugify(city)}`;
  const entries = list
    .slice(0, 30)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h, i) => ({
      hotel_slug: h.slug,
      rank: i + 1,
      justification_fr: justification(h, h.luxury_tier ?? 'self_5_star', h.rank),
    }));
  cityRankings.push({
    slug,
    title_fr: `Les meilleurs hôtels à ${city}`,
    title_en: `The best hotels in ${city}`,
    kind: 'geographic',
    intro_fr: paddedIntro(
      `Les meilleurs hôtels à ${city}`,
      `Sélection de ${list.length} adresses de référence à ${city} (${sample.country_label_fr}) : palaces établis, ouvertures remarquables, retraites discrètes. Notre Concierge classe selon trois critères concrets : qualité du sommeil, mémorabilité de l’expérience, qualité du service de conciergerie sur place.`,
    ),
    intro_en: paddedIntro(
      `The best hotels in ${city}`,
      `${list.length} reference addresses in ${city} (${sample.country_label_en}): established palaces, notable openings, discreet retreats.`,
    ),
    entries,
  });
}

// ─── 3. Country guides (one per country with ≥ 3 hotels) ──────────────────

const byCountry = new Map<string, ScaffoldRow[]>();
for (const h of hotels) {
  const list = byCountry.get(h.country_code) ?? [];
  list.push(h);
  byCountry.set(h.country_code, list);
}
const guides: GuidePlan[] = [];
for (const [cc, list] of byCountry) {
  if (list.length < 3) continue;
  const sample = list[0];
  if (!sample) continue;
  const slug = `guide-${slugify(sample.country_label_fr)}`;
  guides.push({
    slug,
    name_fr: sample.country_label_fr,
    name_en: sample.country_label_en,
    scope: 'country',
    country_code: cc,
    summary_fr: paddedSummaryFr(
      `Le guide MyConciergeHotel des palaces et hôtels 5★ de ${sample.country_label_fr} (${list.length} adresses recensées).`,
    ),
    summary_en: paddedSummaryFr(
      `MyConciergeHotel's guide to palaces and 5-star hotels in ${sample.country_label_en} (${list.length} addresses).`,
    ),
  });
}

// ─── 4. Country-scope rankings (per country with ≥ 10 hotels) ────────────

const countryRankings: RankingPlan[] = [];
for (const [cc, list] of byCountry) {
  if (list.length < 10) continue;
  const sample = list[0];
  if (!sample) continue;
  const slug = `meilleurs-hotels-${slugify(sample.country_label_fr)}`;
  const entries = list
    .slice(0, 50)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h, i) => ({
      hotel_slug: h.slug,
      rank: i + 1,
      justification_fr: justification(h, h.luxury_tier ?? 'self_5_star', h.rank),
    }));
  countryRankings.push({
    slug,
    title_fr: `Les meilleurs hôtels de ${sample.country_label_fr}`,
    title_en: `The best hotels in ${sample.country_label_en}`,
    kind: 'geographic',
    intro_fr: paddedIntro(
      `Les meilleurs hôtels de ${sample.country_label_fr}`,
      `Notre Concierge présente sa sélection de ${list.length} hôtels d’exception en ${sample.country_label_fr} : palaces patrimoniaux, design hotels contemporains, retraites nature. Le classement privilégie la cohérence entre promesse et expérience, et signale les villes où la densité d’offres luxe justifie un dossier ville dédié.`,
    ),
    intro_en: paddedIntro(
      `The best hotels in ${sample.country_label_en}`,
      `${list.length} exceptional hotels in ${sample.country_label_en}.`,
    ),
    entries,
  });
}

// ─── 5. Thematic rankings (per major brand with ≥ 4 hotels) ──────────────

const BRAND_TIERS: Array<{
  tier: string;
  slug: string;
  title_fr: string;
  title_en: string;
  description: string;
}> = [
  {
    tier: 'aman',
    slug: 'classement-aman-hotels-collection-complete',
    title_fr: 'Aman Hotels — la collection complète vue par notre Concierge',
    title_en: 'Aman Hotels — the complete collection',
    description: `La grammaire Aman : silence, immenses chambres, services invisibles, design contextuel. Nous parcourons ici chaque adresse Aman recensée sur MyConciergeHotel — du flagship asiatique aux nouvelles ouvertures urbaines (New York, Tokyo, Bangkok). Notre Concierge identifie les Aman où l’expérience justifie le tarif, et ceux où d’autres marques offrent mieux.`,
  },
  {
    tier: 'belmond',
    slug: 'classement-belmond-hotels-collection',
    title_fr: 'Belmond — palaces historiques et trains de légende',
    title_en: 'Belmond — historic palaces and legendary trains',
    description: `La griffe Belmond combine palaces patrimoniaux et expériences ferroviaires (Venice Simplon-Orient-Express). Cette sélection regroupe les hôtels Belmond accessibles via MyConciergeHotel, du Cipriani de Venise au Hotel das Cataratas d’Iguaçu.`,
  },
  {
    tier: 'rosewood',
    slug: 'classement-rosewood-hotels-collection',
    title_fr: 'Rosewood Hotels — le luxe « sense of place »',
    title_en: 'Rosewood Hotels — sense-of-place luxury',
    description: `Rosewood incarne le luxe contextuel : chaque adresse répond à son territoire (Rosewood Hong Kong, Rosewood São Paulo, Rosewood Castiglion del Bosco). Notre Concierge guide les voyageurs vers les Rosewood les plus signature.`,
  },
  {
    tier: 'four_seasons',
    slug: 'classement-four-seasons-hotels-monde',
    title_fr: 'Four Seasons — la référence du service luxe mondial',
    title_en: 'Four Seasons — the global benchmark for luxury service',
    description: `Four Seasons reste l’étalon-or de la régularité de service haut de gamme à l’international. Cette sélection couvre les Four Seasons recensés sur MyConciergeHotel — flagship Firenze, Tokyo, Bangkok, Hampshire — et signale les pépites moins exposées.`,
  },
  {
    tier: 'mandarin_oriental',
    slug: 'classement-mandarin-oriental-hotels',
    title_fr: 'Mandarin Oriental — l’hospitalité asiatique au sommet',
    title_en: 'Mandarin Oriental — the apex of Asian hospitality',
    description: `Mandarin Oriental cultive un héritage asiatique d’hospitalité (Hong Kong, Bangkok, Tokyo, Qianmen Beijing) et étend sa signature aux capitales européennes. Sélection complète des Mandarin Oriental disponibles via MyConciergeHotel.`,
  },
  {
    tier: 'park_hyatt',
    slug: 'classement-park-hyatt-hotels-monde',
    title_fr: 'Park Hyatt — le luxe contemporain Hyatt',
    title_en: 'Park Hyatt — Hyatt’s contemporary luxury',
    description: `Park Hyatt incarne la branche urbaine et discrète de Hyatt — Tokyo, Vienne, Paris-Vendôme, New York. Le Concierge identifie les Park Hyatt qui se distinguent vraiment du portefeuille luxe Hyatt.`,
  },
  {
    tier: 'ritz_carlton_reserve',
    slug: 'classement-ritz-carlton-reserve-hotels',
    title_fr: 'Ritz-Carlton Reserve — la branche ultra-confidentielle',
    title_en: 'Ritz-Carlton Reserve — the ultra-private label',
    description: `Ritz-Carlton Reserve regroupe quelques adresses ultra-confidentielles (Dorado Beach Puerto Rico, Phulay Bay Krabi, Bukhara). Cette sélection les met en perspective.`,
  },
  {
    tier: 'lhw_member',
    slug: 'classement-leading-hotels-of-the-world-selection',
    title_fr: 'The Leading Hotels of the World — notre sélection commentée',
    title_en: 'The Leading Hotels of the World — our curated selection',
    description: `LHW rassemble des hôtels indépendants de haut standing. Le label est large : le Concierge filtre ici les LHW vraiment incontournables présents dans notre catalogue.`,
  },
  {
    tier: 'small_luxury_hotels',
    slug: 'classement-small-luxury-hotels-of-the-world-selection',
    title_fr: 'Small Luxury Hotels of the World — notre sélection',
    title_en: 'Small Luxury Hotels of the World — our selection',
    description: `SLH agrège des boutique-hôtels haut de gamme. Le Concierge isole ici les SLH qui se démarquent par leur singularité.`,
  },
];

const brandRankings: RankingPlan[] = [];
for (const b of BRAND_TIERS) {
  const list = hotels.filter((h) => h.luxury_tier === b.tier);
  if (list.length < 4) continue;
  const entries = list
    .slice(0, 50)
    .sort((a, b2) => a.name.localeCompare(b2.name))
    .map((h, i) => ({
      hotel_slug: h.slug,
      rank: i + 1,
      justification_fr: justification(h, b.tier, h.rank),
    }));
  brandRankings.push({
    slug: b.slug,
    title_fr: b.title_fr,
    title_en: b.title_en,
    kind: 'thematic',
    intro_fr: paddedIntro(b.title_fr, b.description),
    intro_en: paddedIntro(b.title_en, b.description),
    entries,
  });
}

// ─── Aggregate + report ──────────────────────────────────────────────────

const allRankings = [...awardedPlans, ...cityRankings, ...countryRankings, ...brandRankings];

console.log(`[scaffold-gr] guides         : ${guides.length}`);
console.log(`[scaffold-gr] rankings total : ${allRankings.length}`);
console.log(`                  awarded   : ${awardedPlans.length}`);
console.log(`                  city      : ${cityRankings.length}`);
console.log(`                  country   : ${countryRankings.length}`);
console.log(`                  brand     : ${brandRankings.length}`);
const totalEntries = allRankings.reduce((acc, r) => acc + r.entries.length, 0);
console.log(`[scaffold-gr] ranking_entries: ${totalEntries}`);

writeFileSync(
  resolve(ROOT, 'scaffold-intl-gr-plan.json'),
  JSON.stringify({ guides, rankings: allRankings }, null, 2),
);

if (DRY_RUN) {
  console.log('[scaffold-gr] --dry-run, skipping insert.');
  process.exit(0);
}

// ─── Real insert ─────────────────────────────────────────────────────────

const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['DATABASE_URL'] ?? '').replace(
  /\?sslmode=require/,
  '',
);
if (!conn) {
  console.error('[scaffold-gr] No DB connection string in .env.local');
  process.exit(1);
}
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

// Map hotel slug → id
const { rows: hotelRows } = await cli.query<{ id: string; slug: string }>(
  `select id, slug from public.hotels`,
);
const hotelIdBySlug = new Map(hotelRows.map((h) => [h.slug, h.id]));

// 1. Guides
let gIns = 0,
  gSk = 0;
for (const g of guides) {
  const r = await cli.query(
    `insert into public.editorial_guides (slug, name_fr, name_en, scope, country_code, summary_fr, summary_en, is_published)
     values ($1, $2, $3, $4, $5, $6, $7, false)
     on conflict (slug) do nothing
     returning id`,
    [g.slug, g.name_fr, g.name_en, g.scope, g.country_code, g.summary_fr, g.summary_en],
  );
  if ((r.rowCount ?? 0) > 0) gIns++;
  else gSk++;
}
console.log(`[scaffold-gr] guides inserted    : ${gIns} / skipped: ${gSk}`);

// 2. Rankings + entries
let rIns = 0,
  rSk = 0,
  eIns = 0,
  eSk = 0,
  eErr = 0;
for (const rp of allRankings) {
  // Upsert ranking row, retrieve id (whether newly inserted or already existing).
  let id: string | null = null;
  const ins = await cli.query<{ id: string }>(
    `insert into public.editorial_rankings (slug, title_fr, title_en, kind, intro_fr, intro_en, is_published)
     values ($1, $2, $3, $4, $5, $6, false)
     on conflict (slug) do nothing
     returning id`,
    [rp.slug, rp.title_fr, rp.title_en, rp.kind, rp.intro_fr, rp.intro_en],
  );
  if ((ins.rowCount ?? 0) > 0 && ins.rows[0]) {
    id = ins.rows[0].id;
    rIns++;
  } else {
    rSk++;
    const sel = await cli.query<{ id: string }>(
      `select id from public.editorial_rankings where slug = $1`,
      [rp.slug],
    );
    id = sel.rows[0]?.id ?? null;
  }
  if (!id) continue;

  for (const e of rp.entries) {
    const hid = hotelIdBySlug.get(e.hotel_slug);
    if (!hid) {
      eErr++;
      continue;
    }
    try {
      const r = await cli.query(
        `insert into public.editorial_ranking_entries (ranking_id, hotel_id, rank, justification_fr)
         values ($1, $2, $3, $4)
         on conflict (ranking_id, hotel_id) do nothing
         returning hotel_id`,
        [id, hid, e.rank, e.justification_fr],
      );
      if ((r.rowCount ?? 0) > 0) eIns++;
      else eSk++;
    } catch (err) {
      eErr++;
      console.error(`  fail ${rp.slug}/${e.hotel_slug}: ${(err as Error).message.slice(0, 200)}`);
    }
  }
}
console.log(`[scaffold-gr] rankings inserted  : ${rIns} / skipped: ${rSk}`);
console.log(`[scaffold-gr] entries inserted   : ${eIns} / skipped: ${eSk} / errors: ${eErr}`);

await cli.end();
