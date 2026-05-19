/**
 * scaffold-guides-rankings.ts — for every Yonder editorial page that surfaced
 * a French hotel listing, ensure MyConciergeHotel has either a draft
 * `editorial_guide` (geographic scope) or a draft `editorial_ranking`
 * (thematic / "best of") so the path/page exists before the editorial
 * pipeline runs.
 *
 * Mapping rules :
 *   - URLs matching /destination|cityguide|region|ile-de-france|cote-azur/ → guide
 *   - URLs matching /plus-beaux-hotels-(nice|paris|courchevel|...)        → ranking 'geographic'
 *   - URLs matching /plus-beaux-palaces|5-etoiles|4-etoiles               → ranking 'best_of'
 *   - URLs matching /hotel-(rooftop|spa|design|seminaire|vue|family...)   → ranking 'thematic'
 *   - URLs matching /hotels-de-legende|chambres-avec-vues                 → ranking 'thematic'
 *   - URLs matching /openings/<slug>, /hotel(s)?-du-mois/avis-<slug>      → single hotel review (skip)
 *
 * `is_published = false` on every scaffold. Summaries are a 70-220 char
 * placeholder mentioning the topic — passes the CHECK constraint and is
 * trivially overwritten by the editorial pipeline.
 *
 * Idempotent : uses ON CONFLICT (slug) DO NOTHING.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YONDER_DIR = resolve(__dirname, '../../yonder');
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

interface Plan {
  type: 'guide' | 'ranking';
  slug: string;
  title: string;
  kind?: 'best_of' | 'awarded' | 'thematic' | 'geographic';
  scope?: 'city' | 'region' | 'cluster' | 'country';
  city?: string;
  region?: string;
  yonder_url: string;
}

// ─── Classify URL → plan ───────────────────────────────────────────────────

interface UrlClassifier {
  rx: RegExp;
  plan: (slug: string, label: string, url: string) => Plan | null;
}

const SINGLE_REVIEW_RX =
  /\/hotels?\/(openings|hotel-du-mois|chambres-avec-vues|hotels-de-legende|hotels-du-mois)\/(avis-|notre-avis-|on-a-teste-|cabanes-|grands-hotels-|la-saga|maison-|le-cinq-|les-bords-|les-horsensias-|coeur-marin-|como-|domaine-|hostellerie-|hotel-de-ill|hotel-70)/;

const PARIS_ARRDT_RX = /paris-(\d{1,2})\b|arrondissement-paris|paris-\d/;
const QUARTIER_RX =
  /(montmartre|marais|saint-germain|bastille|champs-elysees|tour-eiffel|quartier-latin|bercy|gare-de-lyon)/;
const CITY_RX =
  /(nice|cannes|courchevel|saint-tropez|megeve|biarritz|lyon|bordeaux|reims|dijon|colmar|strasbourg|chantilly|deauville|la-baule|la-rochelle|tours|val-thorens|chamonix|annecy|saint-emilion|cognac|hossegor|arcachon)/;
const REGION_RX =
  /(corse|provence|champagne|alsace|bourgogne|bretagne|normandie|sologne|val-de-loire|pays-basque|cote-azur|cote-atlantique|sud-ouest|ile-de-france|vexin|alpilles|luberon|lac-leman)/;
const THEME_RX =
  /(spa|piscine|wellness|bien-etre|design|deco|rooftop|seminaire|amoureux|romantique|famille|family|kids|suite-familiale|chateau|relais|vignes|oenotourisme|golf|montagne|chalet|vue-mer|bord-de-mer|vue-tour-eiffel|vue-sur-seine|maison-hotes|hotel-lifestyle)/;
const TYPE_RX = /(5-etoiles|4-etoiles|3-etoiles|palace|palaces|luxe|charme|boutique)/;

function classifyUrl(url: string): Plan | null {
  // Skip individual reviews
  if (SINGLE_REVIEW_RX.test(url)) return null;
  if (!/\/les-tops\/hotels\/|\/hotels\/hotels-du-mois\/|\/hotels\/openings\//.test(url))
    return null;

  const seg = url.split('/').pop() ?? '';
  if (!seg || seg.length < 5) return null;

  // Arrondissement parisien → ranking geographic
  const arrM = seg.match(/paris-(\d{1,2})/);
  if (arrM) {
    const n = arrM[1];
    return {
      type: 'ranking',
      kind: 'geographic',
      slug: `meilleurs-hotels-paris-${n}`,
      title: `Les meilleurs hôtels du ${n}e arrondissement de Paris`,
      city: 'Paris',
      region: 'Île-de-France',
      yonder_url: url,
    };
  }

  // Quartier parisien
  const qM = seg.match(QUARTIER_RX);
  if (qM) {
    const q = qM[1] ?? '';
    return {
      type: 'ranking',
      kind: 'geographic',
      slug: `meilleurs-hotels-${q}`,
      title: `Les meilleurs hôtels à ${q.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (Paris)`,
      city: 'Paris',
      region: 'Île-de-France',
      yonder_url: url,
    };
  }

  // Ville
  const cM = seg.match(CITY_RX);
  if (cM) {
    const c = cM[1] ?? '';
    return {
      type: 'ranking',
      kind: 'geographic',
      slug: `meilleurs-hotels-${c}`,
      title: `Les meilleurs hôtels à ${c.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
      city: c.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      yonder_url: url,
    };
  }

  // Région / cluster
  const rM = seg.match(REGION_RX);
  if (rM) {
    const r = rM[1] ?? '';
    const slug = `meilleurs-hotels-${r}`;
    return {
      type: 'ranking',
      kind: 'geographic',
      slug,
      title: `Les meilleurs hôtels de ${r.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
      region: r,
      yonder_url: url,
    };
  }

  // Thématique
  const tM = seg.match(THEME_RX);
  if (tM) {
    const t = tM[1] ?? '';
    return {
      type: 'ranking',
      kind: 'thematic',
      slug: `meilleurs-hotels-${t}-france`,
      title: `Les meilleurs hôtels ${t.replace(/-/g, ' ')} en France`,
      yonder_url: url,
    };
  }

  // Catégorie / type
  const tyM = seg.match(TYPE_RX);
  if (tyM) {
    const ty = tyM[1] ?? '';
    return {
      type: 'ranking',
      kind: ty.includes('palace') ? 'best_of' : 'best_of',
      slug: `meilleurs-hotels-${ty}-france`,
      title: ty.includes('palace')
        ? `Les plus beaux Palaces de France`
        : `Les meilleurs hôtels ${ty.replace(/-/g, ' ')} en France`,
      yonder_url: url,
    };
  }

  // Fallback : generic best_of
  return {
    type: 'ranking',
    kind: 'best_of',
    slug: `meilleurs-hotels-${seg}`.slice(0, 80).replace(/-+$/, ''),
    title: `Sélection éditoriale — ${seg.replace(/-/g, ' ')}`,
    yonder_url: url,
  };
}

// ─── Load and process ─────────────────────────────────────────────────────

const pages: Array<{ url: string; count: number; hotels: string[] }> = JSON.parse(
  readFileSync(resolve(YONDER_DIR, 'pages.json'), 'utf8'),
);

const plans = new Map<string, Plan>();
for (const p of pages) {
  const plan = classifyUrl(p.url);
  if (!plan) continue;
  if (!plans.has(plan.slug)) plans.set(plan.slug, plan);
}

const planList = Array.from(plans.values());
const guides = planList.filter((p) => p.type === 'guide');
const rankings = planList.filter((p) => p.type === 'ranking');

console.log(`[scaffold] from ${pages.length} yonder listings:`);
console.log(`  guides   : ${guides.length}`);
console.log(`  rankings : ${rankings.length}`);
console.log(`    geographic : ${rankings.filter((r) => r.kind === 'geographic').length}`);
console.log(`    thematic   : ${rankings.filter((r) => r.kind === 'thematic').length}`);
console.log(`    best_of    : ${rankings.filter((r) => r.kind === 'best_of').length}`);
console.log(`    awarded    : ${rankings.filter((r) => r.kind === 'awarded').length}`);

writeFileSync(resolve(YONDER_DIR, 'scaffold-plans.json'), JSON.stringify(planList, null, 2));

// SQL preview
const sqlLines: string[] = [`-- Scaffold editorial guides + rankings derived from yonder.fr`];
const esc = (s: string) => s.replace(/'/g, "''");
function placeholderIntro(p: Plan): string {
  // Must be between 400 and 8000 chars (editorial_rankings_intro_fr_ck).
  const body = [
    `DRAFT — sélection éditoriale en cours de rédaction par l’équipe MyConciergeHotel pour le classement « ${p.title} ».`,
    `Cette page est destinée à présenter les meilleures adresses retenues par notre comité éditorial, à la voix du Concierge : tonalité experte, complice, jamais commerciale.`,
    `Méthodologie : sélection indépendante, recoupée avec les sources de référence (Atout France, Michelin, Relais & Châteaux, presse spécialisée). Aucune contrepartie financière n’est acceptée pour figurer dans nos classements.`,
    `Données d’inspiration initiale : ${p.yonder_url}.`,
    `Le contenu définitif (intro éditoriale 400-600 mots, justification par hôtel, FAQ AEO, JSON-LD ItemList + Article) sera produit par le pipeline éditorial Concierge dès que la sélection finale aura été validée et croisée avec notre catalogue interne d’hôtels 5★ et Palaces vérifiés.`,
    `Restez à l’écoute : la version finale est attendue prochainement, et bénéficiera des standards SEO/GEO/AEO du site MyConciergeHotel (Schema.org Hotel + AggregateRating + ItemList, FAQPage, freshness signal, Concierge voice).`,
  ].join('\n\n');
  return body.length < 400 ? body.padEnd(400, '.') : body;
}

for (const p of rankings) {
  const intro = placeholderIntro(p);
  sqlLines.push(
    `insert into public.editorial_rankings (slug, title_fr, kind, intro_fr, is_published)
values ('${esc(p.slug)}', '${esc(p.title)}', '${p.kind}', '${esc(intro)}', false)
on conflict (slug) do nothing;`,
  );
}
for (const p of guides) {
  sqlLines.push(
    `insert into public.editorial_guides (slug, name_fr, scope, country_code, summary_fr, is_published)
values ('${esc(p.slug)}', '${esc(p.title)}', '${p.scope}', 'FR', 'DRAFT — guide destination en préparation. Voix du Concierge à venir.', false)
on conflict (slug) do nothing;`,
  );
}
writeFileSync(resolve(YONDER_DIR, 'scaffold-guides-rankings.sql'), sqlLines.join('\n'));

if (DRY_RUN) {
  console.log('[scaffold] --dry-run, preview: yonder/scaffold-guides-rankings.sql');
  process.exit(0);
}

const conn = (env['SUPABASE_DB_POOLER_URL'] ?? env['DATABASE_URL'] ?? '').replace(
  /\?sslmode=require/,
  '',
);
const cli = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
await cli.connect();

let insR = 0,
  skR = 0;
for (const p of rankings) {
  const intro = placeholderIntro(p);
  const r = await cli.query(
    `insert into public.editorial_rankings (slug, title_fr, kind, intro_fr, is_published)
     values ($1, $2, $3, $4, false)
     on conflict (slug) do nothing
     returning id`,
    [p.slug, p.title, p.kind, intro],
  );
  if ((r.rowCount ?? 0) > 0) insR++;
  else skR++;
}
let insG = 0,
  skG = 0;
for (const p of guides) {
  const r = await cli.query(
    `insert into public.editorial_guides (slug, name_fr, scope, country_code, summary_fr, is_published)
     values ($1, $2, $3, 'FR', $4, false)
     on conflict (slug) do nothing
     returning id`,
    [
      p.slug,
      p.title,
      p.scope,
      'DRAFT — guide destination en préparation. Voix du Concierge à venir.',
    ],
  );
  if ((r.rowCount ?? 0) > 0) insG++;
  else skG++;
}

console.log(`[scaffold] rankings inserted : ${insR} / skipped: ${skR}`);
console.log(`[scaffold] guides inserted   : ${insG} / skipped: ${skG}`);
await cli.end();
