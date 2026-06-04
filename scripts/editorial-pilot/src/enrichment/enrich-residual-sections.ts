/**
 * enrich-residual-sections.ts — Deep, anti-scaffolding enrichment of the
 * RESIDUAL hotel sections (ADR-0029).
 *
 * Targets only sections whose `body_fr` is empty / whitespace OR still
 * carries a scaffolding leak marker (`emptied` / pure-scaffolding slots
 * kept by the de-scaffolding pass). For each gap section it:
 *
 *   1. Maps the section anchor → a factual DIMENSION
 *      (histoire / architecture / chambres / gastronomie / spa / services).
 *   2. Fetches REAL facts for that dimension via the existing multi-source
 *      pipeline — Wikidata (SPARQL), Wikipedia (REST), and the Tavily
 *      extractors (dining / capacity / wellness / services). Tavily is used
 *      "in depth": advanced search + advanced extract + tight queries.
 *   3. Applies the EEAT gate (I2): a section is regenerated ONLY if ≥ 2
 *      sourced facts were pinned for its dimension — otherwise the slot is
 *      kept empty (honest) rather than padded with invented prose.
 *   4. Generates the body with a HARDENED prompt that can never narrate a
 *      gap, then runs the shared anti-scaffolding gate (I1): if any leak
 *      marker survives the write is refused.
 *   5. Writes per-section (I4): untouched sections are preserved verbatim.
 *
 * Idempotent (I5): re-running skips sections already filled; only fetches
 * the dimensions actually needed (credit-frugal). Tavily HTTP cache makes
 * re-runs of the same hotel ~free.
 *
 * Usage:
 *   tsx src/enrichment/enrich-residual-sections.ts --slugs=a,b,c [--dry-run] [--show]
 *   tsx src/enrichment/enrich-residual-sections.ts --auto --limit=12 [--dry-run]
 */

import path from 'node:path';
import { appendFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

import { buildLlmClient } from '../llm.js';
import { loadEnv, resolveProvider } from '../env.js';
import { selectHotels, patchHotelById, type SupabaseRestConfig } from '../photos/supabase-rest.js';
import { hasLeak, wordCount, maxSentenceWords } from './scaffolding-gate.js';
import { searchHotel, fetchHotelByQid, type WdHotel } from './wikidata.js';
import { fetchSummaryWithFallbacks, type WpSummary } from './wikipedia.js';
import { extractDining, type DiningExtractionResult } from './dining-extractor.js';
import { extractCapacity, type CapacityExtractionResult } from './capacity-extractor.js';
import { extractWellness, type WellnessExtractionResult } from './wellness-extractor.js';
import { extractServices, type ServicesExtractionResult } from './services-extractor.js';
import { extractHistory, type HistoryExtractionResult } from './history-extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: path.resolve(__dirname, '../../../../.env') });

// ─── Types ───────────────────────────────────────────────────────────────

type Dimension = 'histoire' | 'architecture' | 'chambres' | 'gastronomie' | 'spa' | 'services';

interface Section {
  readonly anchor?: string;
  readonly title_fr?: string;
  readonly title_en?: string;
  readonly body_fr?: string;
  readonly body_en?: string;
  readonly [k: string]: unknown;
}

interface HotelRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly city: string;
  readonly region: string | null;
  readonly country_code: string | null;
  readonly official_url: string | null;
  readonly long_description_sections: unknown;
}

interface Gap {
  readonly index: number;
  readonly anchor: string;
  readonly title: string;
  readonly dimension: Dimension;
}

interface Fact {
  readonly label: string;
  readonly value: string;
}

interface SectionChange {
  readonly anchor: string;
  readonly dimension: Dimension;
  readonly before: string;
  readonly after: string | null;
  readonly status: 'written' | 'skipped_no_facts' | 'skipped_leak' | 'skipped_thin' | 'unmapped';
  readonly factCount: number;
  readonly reason?: string;
}

const HOTEL_COLS = 'id,slug,name,city,region,country_code,official_url,long_description_sections';

// ─── Anchor → dimension mapping ───────────────────────────────────────────

const DIMENSION_PATTERNS: ReadonlyArray<{ re: RegExp; dim: Dimension }> = [
  { re: /histoire|heritage|patrimoine|history|herit/iu, dim: 'histoire' },
  {
    re: /architect|design|demeure|etablissement|établissement|lieu|maison|batiment|bâtiment/iu,
    dim: 'architecture',
  },
  { re: /chambre|suite|hebergement|hébergement|room|accommodation/iu, dim: 'chambres' },
  { re: /gastronom|table|restaurant|cuisine|dining|bar|culinaire/iu, dim: 'gastronomie' },
  { re: /spa|bien-etre|bien-être|wellness|wellbeing/iu, dim: 'spa' },
  { re: /service|concierge|conciergerie|equipe|équipe|prestation/iu, dim: 'services' },
];

function mapAnchorToDimension(anchor: string, title: string): Dimension | null {
  const hay = `${anchor} ${title}`;
  for (const { re, dim } of DIMENSION_PATTERNS) {
    if (re.test(hay)) return dim;
  }
  return null;
}

function isGapBody(body: string | undefined): boolean {
  if (typeof body !== 'string') return true;
  if (body.trim().length === 0) return true;
  return hasLeak(body);
}

// ─── CLI args ──────────────────────────────────────────────────────────────

interface Args {
  readonly slugs: readonly string[];
  readonly auto: boolean;
  readonly limit: number;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly show: boolean;
  /** Wave targeting (auto mode only). */
  readonly palace: boolean;
  readonly country: string | null;
  readonly stars: number | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let slugs: string[] = [];
  let auto = false;
  let limit = 12;
  let concurrency = 2;
  let dryRun = false;
  let show = false;
  let palace = false;
  let country: string | null = null;
  let stars: number | null = null;
  for (const a of argv) {
    if (a === '--auto') auto = true;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--show') show = true;
    else if (a === '--palace') palace = true;
    else if (a.startsWith('--country='))
      country = a.slice('--country='.length).trim().toUpperCase() || null;
    else if (a.startsWith('--stars=')) {
      const n = Number.parseInt(a.slice('--stars='.length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 5) stars = n;
    } else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (a.startsWith('--slug=')) {
      const s = a.slice('--slug='.length).trim();
      if (s) slugs = [s];
    } else if (a.startsWith('--limit=')) {
      const n = Number.parseInt(a.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    } else if (a.startsWith('--concurrency=')) {
      const n = Number.parseInt(a.slice('--concurrency='.length), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = n;
    }
  }
  return { slugs, auto, limit, concurrency, dryRun, show, palace, country, stars };
}

function loadRestConfig(): SupabaseRestConfig {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL missing in .env.local');
  }
  if (typeof key !== 'string' || key.length < 40) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  return { url, serviceRoleKey: key };
}

// ─── Fiche selection ─────────────────────────────────────────────────────

function parseSections(raw: unknown): Section[] {
  return Array.isArray(raw) ? (raw as Section[]) : [];
}

function detectGaps(sections: readonly Section[]): Gap[] {
  const gaps: Gap[] = [];
  sections.forEach((s, index) => {
    if (!isGapBody(s.body_fr)) return;
    const anchor = typeof s.anchor === 'string' ? s.anchor : '';
    const title = typeof s.title_fr === 'string' ? s.title_fr : '';
    const dim = mapAnchorToDimension(anchor, title);
    if (dim === null) return; // unmappable → no external source → keep empty
    gaps.push({ index, anchor: anchor || dim, title: title || dim, dimension: dim });
  });
  return gaps;
}

async function fetchExplicitFiches(
  cfg: SupabaseRestConfig,
  slugs: readonly string[],
): Promise<HotelRow[]> {
  const rows: HotelRow[] = [];
  for (const slug of slugs) {
    const r = await selectHotels<HotelRow>(cfg, {
      columns: HOTEL_COLS,
      filters: [`slug=eq.${slug}`],
    });
    if (r[0]) rows.push(r[0]);
    else console.warn(`  ⚠ slug not found: ${slug}`);
  }
  return rows;
}

interface AutoTarget {
  readonly limit: number;
  readonly palace: boolean;
  readonly country: string | null;
  readonly stars: number | null;
}

async function fetchAutoResidualFiches(
  cfg: SupabaseRestConfig,
  target: AutoTarget,
): Promise<HotelRow[]> {
  // `selectHotels` paginates internally (handles the PostgREST 1000-row cap)
  // and `limit` caps the overall scan. We over-fetch a budget, filter for a
  // mappable gap client-side, and keep the first `limit` matches. Wave
  // targeting (palace / country / stars) is pushed down as PostgREST filters
  // so V1 (Palaces FR) only scans the relevant slice.
  const filters: string[] = ['is_published=eq.true', 'long_description_sections=not.is.null'];
  if (target.palace) filters.push('is_palace=eq.true');
  if (target.country !== null) filters.push(`country_code=eq.${target.country}`);
  if (target.stars !== null) filters.push(`stars=eq.${target.stars}`);
  const scanBudget = Math.max(target.limit * 80, 1000);
  const page = await selectHotels<HotelRow>(cfg, {
    columns: HOTEL_COLS,
    filters,
    order: 'is_palace.desc.nullslast,stars.desc.nullslast,slug.asc',
    limit: scanBudget,
  });
  const picked: HotelRow[] = [];
  for (const row of page) {
    if (detectGaps(parseSections(row.long_description_sections)).length > 0) picked.push(row);
    if (picked.length >= target.limit) break;
  }
  return picked;
}

// ─── Deep source fetch (per needed dimension) ──────────────────────────────

function officialDomainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

async function settle<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

async function resolveWikidata(name: string): Promise<WdHotel | null> {
  const results = await settle(searchHotel(name, { lang: 'fr', limit: 5 }));
  if (!results || results.length === 0) return null;
  const best =
    results.find(
      (r) => r.description !== null && /h[oô]tel|palace|h[ée]bergement|lodg/iu.test(r.description),
    ) ?? results[0];
  if (!best) return null;
  return await settle(fetchHotelByQid(best.qid));
}

async function resolveWikipedia(name: string, city: string): Promise<WpSummary | null> {
  const candidates = Array.from(
    new Set(
      [name, name.replace(/^Hôtel\s+/iu, ''), `Hôtel ${name}`, `${name} (${city})`]
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    ),
  );
  return await settle(fetchSummaryWithFallbacks(candidates, 'fr'));
}

interface SourceBundle {
  wikidata: WdHotel | null;
  wikipedia: WpSummary | null;
  history: HistoryExtractionResult | null;
  dining: DiningExtractionResult | null;
  capacity: CapacityExtractionResult | null;
  wellness: WellnessExtractionResult | null;
  services: ServicesExtractionResult | null;
  tavilyCalls: number;
}

async function fetchSourcesForDimensions(
  hotel: HotelRow,
  dims: ReadonlySet<Dimension>,
): Promise<SourceBundle> {
  const domain = officialDomainOf(hotel.official_url);
  const needHistory = dims.has('histoire') || dims.has('architecture');
  const needWd = needHistory;
  const needWp = needHistory;
  const needDining = dims.has('gastronomie');
  const needCapacity = dims.has('chambres');
  const needWellness = dims.has('spa');
  const needServices = dims.has('services');

  const [wikidata, wikipedia, history, dining, capacity, wellness, services] = await Promise.all([
    needWd ? resolveWikidata(hotel.name) : Promise.resolve(null),
    needWp ? resolveWikipedia(hotel.name, hotel.city) : Promise.resolve(null),
    needHistory
      ? settle(extractHistory({ hotelName: hotel.name, city: hotel.city, officialDomain: domain }))
      : Promise.resolve(null),
    needDining
      ? settle(extractDining({ hotelName: hotel.name, city: hotel.city, officialDomain: domain }))
      : Promise.resolve(null),
    needCapacity
      ? settle(
          extractCapacity({
            hotelName: hotel.name,
            city: hotel.city,
            officialDomain: domain,
            fallbackNarrative: null,
          }),
        )
      : Promise.resolve(null),
    needWellness
      ? settle(extractWellness({ hotelName: hotel.name, city: hotel.city, officialDomain: domain }))
      : Promise.resolve(null),
    needServices
      ? settle(extractServices({ hotelName: hotel.name, city: hotel.city, officialDomain: domain }))
      : Promise.resolve(null),
  ]);

  const tavilyCalls =
    (dining ? dining.searchCount + dining.extractCount : 0) +
    (history ? history.searchCount + history.extractCount : 0) +
    (needCapacity ? 2 : 0) +
    (needWellness ? 2 : 0) +
    (needServices ? 2 : 0);

  return { wikidata, wikipedia, history, dining, capacity, wellness, services, tavilyCalls };
}

// ─── Per-dimension fact assembly (EEAT gate input) ─────────────────────────

function factsForDimension(dim: Dimension, src: SourceBundle): Fact[] {
  const facts: Fact[] = [];
  switch (dim) {
    case 'histoire': {
      const wd = src.wikidata;
      const h = src.history?.history;
      const year = wd?.inception?.year ?? h?.openingYear ?? null;
      if (year !== null)
        facts.push({ label: 'Année d’ouverture / construction', value: String(year) });
      if (wd?.owner) facts.push({ label: 'Propriétaire / groupe', value: wd.owner });
      else if (h?.founder) facts.push({ label: 'Fondateur / opérateur', value: h.founder });
      if (wd?.partOf) facts.push({ label: 'Appartenance', value: wd.partOf });
      const heritage =
        wd && wd.heritageDesignations.length > 0
          ? wd.heritageDesignations.join(', ')
          : (h?.heritageStatus ?? null);
      if (heritage !== null) facts.push({ label: 'Distinction patrimoniale', value: heritage });
      if (h?.notableEvent) facts.push({ label: 'Fait marquant', value: h.notableEvent });
      const narrative =
        src.wikipedia?.extract && src.wikipedia.extract.length > 40
          ? src.wikipedia.extract.trim().slice(0, 600)
          : (h?.narrative ?? null);
      if (narrative !== null) facts.push({ label: 'Notice', value: narrative });
      break;
    }
    case 'architecture': {
      const wd = src.wikidata;
      const h = src.history?.history;
      const architect =
        wd && wd.architects.length > 0 ? wd.architects.join(', ') : (h?.architect ?? null);
      if (architect !== null) facts.push({ label: 'Architecte(s)', value: architect });
      if (h?.architecturalStyle)
        facts.push({ label: 'Style architectural', value: h.architecturalStyle });
      const year = wd?.inception?.year ?? h?.openingYear ?? null;
      if (year !== null) facts.push({ label: 'Époque', value: String(year) });
      if (h?.heritageStatus)
        facts.push({ label: 'Distinction patrimoniale', value: h.heritageStatus });
      const narrative =
        src.wikipedia?.extract && src.wikipedia.extract.length > 40
          ? src.wikipedia.extract.trim().slice(0, 600)
          : (h?.narrative ?? null);
      if (narrative !== null) facts.push({ label: 'Notice', value: narrative });
      break;
    }
    case 'chambres': {
      const c = src.capacity?.capacity;
      if (c) {
        if (c.totalKeys !== null)
          facts.push({ label: 'Nombre total de clés', value: String(c.totalKeys) });
        if (c.roomsCount !== null) facts.push({ label: 'Chambres', value: String(c.roomsCount) });
        if (c.suitesCount !== null) facts.push({ label: 'Suites', value: String(c.suitesCount) });
        if (c.signatureSuitesCount !== null)
          facts.push({ label: 'Suites signature', value: String(c.signatureSuitesCount) });
        if (c.minRoomSurfaceM2 !== null || c.maxRoomSurfaceM2 !== null)
          facts.push({
            label: 'Surface des chambres (m²)',
            value: `${c.minRoomSurfaceM2 ?? '?'}–${c.maxRoomSurfaceM2 ?? '?'}`,
          });
      }
      break;
    }
    case 'gastronomie': {
      for (const o of src.dining?.outlets ?? []) {
        const bits = [o.name];
        if (o.type) bits.push(`(${o.type})`);
        if (o.chef) bits.push(`chef ${o.chef}`);
        if (o.michelinStars !== null && o.michelinStars > 0)
          bits.push(`${o.michelinStars}★ Michelin`);
        if (o.cuisine) bits.push(o.cuisine);
        if (o.signature) bits.push(`signature : ${o.signature}`);
        facts.push({ label: 'Table / bar', value: bits.filter(Boolean).join(' — ') });
      }
      break;
    }
    case 'spa': {
      const w = src.wellness?.wellness;
      if (w) {
        if (w.spaName) facts.push({ label: 'Nom du spa', value: w.spaName });
        if (w.partnerBrand) facts.push({ label: 'Marque partenaire', value: w.partnerBrand });
        if (w.surfaceM2 !== null) facts.push({ label: 'Surface (m²)', value: String(w.surfaceM2) });
        if (w.hasPool === true) facts.push({ label: 'Piscine', value: w.poolType ?? 'oui' });
        if (w.numberOfTreatmentRooms !== null)
          facts.push({ label: 'Cabines de soin', value: String(w.numberOfTreatmentRooms) });
        if (w.hasHammam === true) facts.push({ label: 'Hammam', value: 'oui' });
        if (w.hasSauna === true) facts.push({ label: 'Sauna', value: 'oui' });
        if (w.signatureTreatments.length > 0)
          facts.push({ label: 'Soins signature', value: w.signatureTreatments.join(', ') });
      }
      break;
    }
    case 'services': {
      const s = src.services?.services;
      if (s) {
        if (s.languagesSpoken.length > 0)
          facts.push({ label: 'Langues parlées', value: s.languagesSpoken.join(', ') });
        if (s.hasValetParking === true) facts.push({ label: 'Voiturier', value: 'oui' });
        else if (s.hasParking === true) facts.push({ label: 'Parking', value: 'oui' });
        if (s.hasAirportTransfer === true)
          facts.push({ label: 'Transfert aéroport', value: s.airportTransferNote ?? 'oui' });
        if (s.conciergeClefsDor === true)
          facts.push({ label: 'Conciergerie', value: 'Clefs d’Or' });
        else if (s.hasConcierge === true) facts.push({ label: 'Conciergerie', value: 'oui' });
        if (s.has24hRoomService === true) facts.push({ label: 'Room-service 24h', value: 'oui' });
        if (s.hasButlerService === true) facts.push({ label: 'Majordome', value: 'oui' });
        if (s.petsAllowed !== null)
          facts.push({
            label: 'Animaux',
            value: s.petsAllowed ? (s.petPolicyNote ?? 'admis') : 'non admis',
          });
      }
      break;
    }
  }
  return facts;
}

// ─── Hardened generation ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es le Concierge éditorial de MyConciergeHotel.com, spécialiste de l'hôtellerie de luxe française.

Tu rédiges UNE section éditoriale (prose française) pour une fiche Palace / 5★, à partir UNIQUEMENT des faits fournis et de ta connaissance générale VÉRIFIABLE (niveau encyclopédique). Style long-read sobre, précis, intemporel, voix de concierge complice — jamais de superlatifs creux.

RÈGLES ABSOLUES (toute violation = sortie inutilisable) :
- INTERDIT de mentionner : un « brief », des « sources », « Wikidata », « AUTO_DRAFT », un « niveau de confiance », « à vérifier », « non vérifié », « pending », « selon les sources publiques », ou toute backtick / identifiant technique.
- Si un fait n'est PAS fourni, tu l'OMETS purement et simplement. Tu n'écris JAMAIS qu'une information manque, est incomplète, ou reste à confirmer.
- Tu n'inventes AUCUN chiffre, date, nom de chef, distinction ou marque qui ne soit pas dans les faits fournis.
- Phrases COURTES : 25 mots maximum par phrase.
- Aucune injonction commerciale (« découvrez », « réservez »), aucune première personne du pluriel marketing.

Sortie : le corps de la section en texte brut (français), sans titre, sans guillemets englobants, sans JSON. Vise 130 à 260 mots.`;

function buildUserPrompt(hotel: HotelRow, gap: Gap, facts: readonly Fact[]): string {
  const lines: string[] = [];
  lines.push(`Hôtel : ${hotel.name}`);
  lines.push(`Ville : ${hotel.region ? `${hotel.city} (${hotel.region})` : hotel.city}`);
  lines.push(`Section à rédiger : « ${gap.title} » (thème : ${gap.dimension})`);
  lines.push('');
  lines.push('Faits vérifiés disponibles (utilise-les, omets le reste) :');
  for (const f of facts) lines.push(`- ${f.label} : ${f.value}`);
  lines.push('');
  lines.push('Rédige le corps de cette section en respectant toutes les règles.');
  return lines.join('\n');
}

interface LlmClientLike {
  call(args: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxOutputTokens: number;
    responseFormat: 'text' | 'json';
  }): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number } }>;
}

interface GenResult {
  body: string | null;
  reason?: string;
  tokensIn: number;
  tokensOut: number;
}

const MIN_WORDS = 110;

async function generateSection(
  llm: LlmClientLike,
  hotel: HotelRow,
  gap: Gap,
  facts: readonly Fact[],
): Promise<GenResult> {
  let tokensIn = 0;
  let tokensOut = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await llm.call({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt:
        attempt === 0
          ? buildUserPrompt(hotel, gap, facts)
          : `${buildUserPrompt(hotel, gap, facts)}\n\n[Rappel : aucune mention de source/brief/manque ; phrases ≤ 25 mots.]`,
      temperature: 0.4,
      maxOutputTokens: 1200,
      responseFormat: 'text',
    });
    tokensIn += res.usage.inputTokens;
    tokensOut += res.usage.outputTokens;
    const body = res.content.replace(/^["'`]+|["'`]+$/gu, '').trim();
    if (hasLeak(body)) continue; // I1 — retry once
    if (wordCount(body) < MIN_WORDS) {
      return { body: null, reason: `thin (${wordCount(body)} mots)`, tokensIn, tokensOut };
    }
    return { body, tokensIn, tokensOut };
  }
  return { body: null, reason: 'leak survived 2 attempts', tokensIn, tokensOut };
}

// ─── Per-fiche processing ──────────────────────────────────────────────────

interface FicheResult {
  readonly slug: string;
  readonly changes: readonly SectionChange[];
  readonly written: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly tavilyCalls: number;
}

async function processFiche(
  llm: LlmClientLike,
  cfg: SupabaseRestConfig,
  hotel: HotelRow,
  dryRun: boolean,
): Promise<FicheResult> {
  const sections = parseSections(hotel.long_description_sections);
  const gaps = detectGaps(sections);
  const changes: SectionChange[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  if (gaps.length === 0) {
    return { slug: hotel.slug, changes, written: 0, tokensIn, tokensOut, tavilyCalls: 0 };
  }

  const dims = new Set<Dimension>(gaps.map((g) => g.dimension));
  const src = await fetchSourcesForDimensions(hotel, dims);

  const next = sections.map((s) => ({ ...s }));
  let written = 0;

  for (const gap of gaps) {
    const before =
      typeof sections[gap.index]?.body_fr === 'string'
        ? (sections[gap.index]!.body_fr as string)
        : '';
    const facts = factsForDimension(gap.dimension, src);
    if (facts.length < 2) {
      changes.push({
        anchor: gap.anchor,
        dimension: gap.dimension,
        before,
        after: null,
        status: 'skipped_no_facts',
        factCount: facts.length,
        reason: `EEAT gate: ${facts.length} fait(s) < 2`,
      });
      continue;
    }
    const gen = await generateSection(llm, hotel, gap, facts);
    tokensIn += gen.tokensIn;
    tokensOut += gen.tokensOut;
    if (gen.body === null) {
      changes.push({
        anchor: gap.anchor,
        dimension: gap.dimension,
        before,
        after: null,
        status: gen.reason?.startsWith('leak') ? 'skipped_leak' : 'skipped_thin',
        factCount: facts.length,
        reason: gen.reason ?? '',
      });
      continue;
    }
    const target = next[gap.index];
    if (target) {
      target['body_fr'] = gen.body;
      // EN is regenerated in a later pass. We must NOT store an empty string:
      // the frontend schema (`body_en: z.string().min(1).optional()`) rejects
      // `""`, which makes the WHOLE long_description_sections array fail
      // safeParse and the hotel story vanish. Drop the key instead (absent =
      // valid optional). Same guard for any leaked empty `title_en`.
      delete target['body_en'];
      if (target['title_en'] === '') delete target['title_en'];
    }
    written += 1;
    changes.push({
      anchor: gap.anchor,
      dimension: gap.dimension,
      before,
      after: gen.body,
      status: 'written',
      factCount: facts.length,
    });
  }

  if (written > 0 && !dryRun) {
    await patchHotelById(cfg, hotel.id, { long_description_sections: next });
  }

  return { slug: hotel.slug, changes, written, tokensIn, tokensOut, tavilyCalls: src.tavilyCalls };
}

// ─── Concurrency ────────────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  if (args.slugs.length === 0 && !args.auto) {
    console.error(
      'Usage: tsx enrich-residual-sections.ts --slugs=a,b,c | --auto --limit=N [--dry-run] [--show]',
    );
    process.exit(1);
  }
  const cfg = loadRestConfig();
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider) as unknown as LlmClientLike;

  const fiches = args.auto
    ? await fetchAutoResidualFiches(cfg, {
        limit: args.limit,
        palace: args.palace,
        country: args.country,
        stars: args.stars,
      })
    : await fetchExplicitFiches(cfg, args.slugs);

  console.log(
    `\n[enrich-residual] ${fiches.length} fiche(s) — ${args.dryRun ? 'DRY-RUN' : 'WRITE'} — concurrency=${args.concurrency}\n`,
  );

  const outDir = path.resolve(process.cwd(), 'out');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const runlog = path.resolve(outDir, `enrich-residual-runlog-${stamp}.jsonl`);

  let totalWritten = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalTavily = 0;

  const results = await runWithConcurrency(fiches, args.concurrency, async (hotel, idx) => {
    const tag = `[${idx + 1}/${fiches.length} ${hotel.slug}]`;
    try {
      const r = await processFiche(llm, cfg, hotel, args.dryRun);
      const summary = r.changes
        .map(
          (c) => `${c.dimension}:${c.status}${c.status === 'written' ? '' : `(${c.factCount}f)`}`,
        )
        .join(' ');
      console.log(`${tag} ✓ written=${r.written}/${r.changes.length} — ${summary || 'no gap'}`);
      if (args.show) {
        for (const c of r.changes) {
          if (c.status === 'written' && c.after) {
            console.log(`   ── ${c.anchor} (${c.factCount} faits) ──`);
            console.log(`   ${c.after.slice(0, 400)}${c.after.length > 400 ? '…' : ''}\n`);
          }
        }
      }
      await appendFile(
        runlog,
        JSON.stringify({ ts: new Date().toISOString(), ...r, dryRun: args.dryRun }) + '\n',
        'utf-8',
      );
      return r;
    } catch (err) {
      console.error(`${tag} ✗ ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });

  for (const r of results) {
    if (!r) continue;
    totalWritten += r.written;
    totalTokensIn += r.tokensIn;
    totalTokensOut += r.tokensOut;
    totalTavily += r.tavilyCalls;
  }

  console.log(
    `\nDone — sections written=${totalWritten}, tokens in/out=${totalTokensIn}/${totalTokensOut}, tavily calls≈${totalTavily}. Runlog → ${path.relative(process.cwd(), runlog)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
