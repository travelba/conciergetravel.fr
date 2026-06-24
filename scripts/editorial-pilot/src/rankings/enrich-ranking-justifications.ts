/**
 * enrich-ranking-justifications.ts — concrete-specifics + EN-parity rewrite of
 * the per-hotel justifications on EXISTING published `editorial_rankings`.
 *
 * Why this exists (audit `docs/audits/competitor-travellers-yonder-audit-2026-06-23.md`):
 *   1. EN parity is broken — ranking entries average ~172 words FR but only
 *      ~15 words EN per entry (a ~91 % gap). Competitors ship full bilingual.
 *   2. FR justifications are generic ("s'impose naturellement dans ce
 *      classement") where competitors name the architect, the room to book,
 *      the signature Michelin table, a verifiable anecdote, the location.
 *
 * This pass does BOTH in a SINGLE grounded LLM call per entry: it rewrites
 * `justification_fr` to be concrete (named facts only, grounded in the hotel
 * row — no invention, EEAT) and produces an equally-rich faithful
 * `justification_en`. Both touch the same DB row, so doing them together
 * avoids double-writing / write collisions.
 *
 * SURGICAL — it PATCHes only `justification_fr`/`justification_en` per entry
 * by entry id. It NEVER deletes-and-replaces entries (that is what the bulk
 * runner `run-rankings-v2-bulk.ts` → `push-ranking-v2.ts` does, which would
 * destroy curated entry ordering). It never touches `combinator.ts`, never
 * creates slugs, never edits sections/intro/outro/meta.
 *
 * Grounding: the LLM is fed the hotel's own facts (description_fr/en,
 * long_description_sections, awards, affiliations, concierge_advice, scalar
 * specifics). It is told to invent nothing — if the architect/chef/suite is
 * not in the source, it must not state it.
 *
 * Anti-scaffolding: every output runs through the shared `hasLeak()` gate; a
 * leaking sentence is stripped, and if the remainder is too thin the entry is
 * skipped (the pre-existing value is kept) rather than persisting a leak.
 *
 * DB CHECK: justification_fr/_en must be 40-1200 chars — output is clamped at
 * a sentence boundary if the LLM overshoots.
 *
 * PostgREST path only (the pg direct host is IPv6-only and fails on the
 * Windows dev box). Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *
 * CLI:
 *   --slug=foo                 single ranking
 *   --slugs=a,b,c              explicit list
 *   --priority                 only rankings whose slug matches a priority city
 *   --all                      every published ranking (default when no slug given)
 *   --limit=N                  cap the number of rankings processed (default 0 = no cap)
 *   --min-en=N                 only rewrite entries whose justification_en is shorter
 *                              than N chars (default 120). Use with --force to ignore.
 *   --force                    rewrite every entry regardless of current EN length
 *   --generic-only             rewrite only entries whose justification_fr names
 *                              NO hard fact (no architect/Michelin/dated distinction/
 *                              year/suite/dimension), OR omits its starred table
 *                              while the hotel row carries chef/Michelin data. The
 *                              right target now that EN length is no longer a proxy
 *                              for quality (the catalogue is already EN-rich).
 *   --entry-concurrency=N      parallel entries within a ranking (default 3, max 5)
 *   --dry-run                  generate + validate, print, do NOT persist
 *
 * Priority order (highest-traffic first, per the audit): Paris, Venise,
 * Marrakech, Dubai, Côte d'Azur, Nice, Saint-Tropez, Courchevel, Monaco,
 * Londres, New York, Rome — then the rest, alphabetically.
 *
 * Skill: editorial-pilot, editorial-rankings-matrix, llm-output-robustness,
 * concierge-voice-pipeline, editorial-voice.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { loadEnv, resolveProvider } from '../env.js';
import { buildLlmClient, type LlmClient } from '../llm.js';
import { hasLeak, splitSentences } from '../enrichment/scaffolding-gate.js';
import { callLlm } from './generate-ranking-v2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadDotenv({ path: resolve(__dirname, '../../../../.env.local') });
loadDotenv({ path: resolve(__dirname, '../../../../.env') });

/* ── Priority cities (highest search volume, per the 2026-06-23 audit) ────── */

const PRIORITY_TOKENS: readonly string[] = [
  'paris',
  'venise',
  'marrakech',
  'dubai',
  'cote-d-azur',
  'nice',
  'saint-tropez',
  'courchevel',
  'monaco',
  'londres',
  'new-york',
  'rome',
];

/** Index of the first priority token the slug contains, or +∞ if none. */
function priorityIndex(slug: string): number {
  for (let i = 0; i < PRIORITY_TOKENS.length; i += 1) {
    if (slug.includes(PRIORITY_TOKENS[i] as string)) return i;
  }
  return Number.POSITIVE_INFINITY;
}

/* ── PostgREST ─────────────────────────────────────────────────────────────*/

interface PgEnv {
  readonly restBase: string;
  readonly apikey: string;
}

function loadPgEnv(): PgEnv {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (url.length === 0 || key.length === 0) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  }
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  return { restBase: `${url.replace(/\/+$/u, '')}/rest/v1`, apikey: key };
}

function pgHeaders(env: PgEnv, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: env.apikey,
    Authorization: `Bearer ${env.apikey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extra,
  };
}

interface RankingRow {
  readonly id: string;
  readonly slug: string;
  readonly title_fr: string;
  readonly title_en: string;
  readonly kind: string;
}

async function fetchRankings(
  env: PgEnv,
  opts: { readonly slugs?: readonly string[] },
): Promise<RankingRow[]> {
  const params = new URLSearchParams();
  params.set('select', 'id,slug,title_fr,title_en,kind');
  params.set('is_published', 'eq.true');
  params.set('order', 'slug.asc');
  if (opts.slugs !== undefined && opts.slugs.length > 0) {
    params.set('slug', `in.(${opts.slugs.map((s) => encodeURIComponent(s)).join(',')})`);
  }
  const r = await fetch(`${env.restBase}/editorial_rankings?${params.toString()}`, {
    headers: pgHeaders(env),
  });
  if (!r.ok) throw new Error(`GET rankings failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as RankingRow[];
}

/** Hotel facts embedded with each entry — the grounding surface. */
interface HotelFacts {
  readonly slug?: unknown;
  readonly name?: unknown;
  readonly name_en?: unknown;
  readonly city?: unknown;
  readonly district?: unknown;
  readonly stars?: unknown;
  readonly is_palace?: unknown;
  readonly luxury_tier?: unknown;
  readonly number_of_rooms?: unknown;
  readonly number_of_suites?: unknown;
  readonly opened_at?: unknown;
  readonly last_renovated_at?: unknown;
  readonly atout_france_id?: unknown;
  readonly description_fr?: unknown;
  readonly description_en?: unknown;
  readonly long_description_sections?: unknown;
  readonly awards?: unknown;
  readonly affiliations?: unknown;
  readonly concierge_advice?: unknown;
  readonly signature_experiences?: unknown;
  readonly restaurant_info?: unknown;
  readonly spa_info?: unknown;
  readonly points_of_interest?: unknown;
}

interface EntryRow {
  readonly hotel_id: string;
  readonly rank: number;
  readonly justification_fr: string | null;
  readonly justification_en: string | null;
  readonly hotels: HotelFacts | null;
}

const HOTEL_EMBED_COLUMNS = [
  'slug',
  'name',
  'name_en',
  'city',
  'district',
  'stars',
  'is_palace',
  'luxury_tier',
  'number_of_rooms',
  'number_of_suites',
  'opened_at',
  'last_renovated_at',
  'atout_france_id',
  'description_fr',
  'description_en',
  'long_description_sections',
  'awards',
  'affiliations',
  'concierge_advice',
  'signature_experiences',
  'restaurant_info',
  'spa_info',
  'points_of_interest',
].join(',');

async function fetchEntries(env: PgEnv, rankingId: string): Promise<EntryRow[]> {
  const select = `hotel_id,rank,justification_fr,justification_en,hotels(${HOTEL_EMBED_COLUMNS})`;
  const url = `${env.restBase}/editorial_ranking_entries?select=${encodeURIComponent(
    select,
  )}&ranking_id=eq.${encodeURIComponent(rankingId)}&order=rank.asc`;
  const r = await fetch(url, { headers: pgHeaders(env) });
  if (!r.ok) throw new Error(`GET entries failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as EntryRow[];
}

/**
 * PATCH one entry by its composite key. `editorial_ranking_entries` has no
 * surrogate `id` — its primary key is (ranking_id, hotel_id), so the filter
 * must carry both to target a single row.
 */
async function patchEntry(
  env: PgEnv,
  rankingId: string,
  hotelId: string,
  patch: { justification_fr: string; justification_en: string },
): Promise<void> {
  const r = await fetch(
    `${env.restBase}/editorial_ranking_entries?ranking_id=eq.${encodeURIComponent(
      rankingId,
    )}&hotel_id=eq.${encodeURIComponent(hotelId)}`,
    {
      method: 'PATCH',
      headers: pgHeaders(env, { Prefer: 'return=minimal' }),
      body: JSON.stringify(patch),
    },
  );
  if (!r.ok)
    throw new Error(
      `PATCH entry ${rankingId}/${hotelId} failed: ${r.status} ${(await r.text()).slice(0, 200)}`,
    );
}

/* ── Grounding builders ───────────────────────────────────────────────────*/

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n).trimEnd()}…`;
}

interface NamedAward {
  readonly name_fr?: unknown;
  readonly name_en?: unknown;
  readonly issuer?: unknown;
  readonly verified?: unknown;
}

function awardsLine(awards: unknown): string {
  if (!Array.isArray(awards)) return '';
  const names = awards
    .map((a) => {
      if (typeof a !== 'object' || a === null) return '';
      const aw = a as NamedAward;
      const nm = str(aw.name_fr) || str(aw.name_en);
      const issuer = str(aw.issuer);
      return nm.length > 0 ? (issuer.length > 0 ? `${nm} (${issuer})` : nm) : '';
    })
    .filter((s) => s.length > 0);
  return names.join(' · ');
}

interface NamedAffiliation {
  readonly kind?: unknown;
  readonly display_name?: unknown;
  readonly since_year?: unknown;
}

function affiliationsLine(affiliations: unknown): string {
  if (!Array.isArray(affiliations)) return '';
  const out = affiliations
    .map((a) => {
      if (typeof a !== 'object' || a === null) return '';
      const af = a as NamedAffiliation;
      const nm = str(af.display_name);
      if (nm.length === 0) return '';
      const year = num(af.since_year);
      const kind = str(af.kind);
      const suffix = [kind, year !== null ? String(year) : '']
        .filter((x) => x.length > 0)
        .join(' ');
      return suffix.length > 0 ? `${nm} [${suffix}]` : nm;
    })
    .filter((s) => s.length > 0);
  return out.join(' · ');
}

interface SectionLike {
  readonly title_fr?: unknown;
  readonly body_fr?: unknown;
}

function sectionsBlock(sections: unknown): string {
  if (!Array.isArray(sections)) return '';
  const out: string[] = [];
  for (const s of sections) {
    if (typeof s !== 'object' || s === null) continue;
    const sec = s as SectionLike;
    const t = str(sec.title_fr);
    const b = str(sec.body_fr);
    if (b.length === 0) continue;
    out.push(`### ${t}\n${truncate(b, 480)}`);
  }
  return out.join('\n\n');
}

function namesFromArray(value: unknown, keys: readonly string[], max: number): string {
  if (!Array.isArray(value)) return '';
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim().length > 0) {
        out.push(v.trim());
        break;
      }
    }
    if (out.length >= max) break;
  }
  return out.join(' · ');
}

interface RestaurantVenue {
  readonly name?: unknown;
  readonly chef?: unknown;
  readonly michelin_stars?: unknown;
  readonly type_fr?: unknown;
  readonly features?: unknown;
}

interface RestaurantInfo {
  readonly michelin_stars?: unknown;
  readonly venues?: unknown;
}

/**
 * Render the named dining surface — the single richest "beat yonder" signal.
 * Each venue can carry a chef and a Michelin star count; surfacing them lets
 * the LLM name the starred table instead of writing generic prose. Hotel's own
 * structured data, so no invention.
 */
function restaurantBlock(info: unknown): string {
  if (typeof info !== 'object' || info === null) return '';
  const ri = info as RestaurantInfo;
  if (!Array.isArray(ri.venues)) return '';
  const venues: string[] = [];
  for (const v of ri.venues) {
    if (typeof v !== 'object' || v === null) continue;
    const venue = v as RestaurantVenue;
    const name = str(venue.name);
    if (name.length === 0) continue;
    const chef = str(venue.chef);
    const stars = num(venue.michelin_stars);
    const type = str(venue.type_fr);
    const qual: string[] = [];
    if (chef.length > 0) qual.push(`chef ${chef}`);
    if (stars !== null && stars > 0) qual.push(`${stars}★ Michelin`);
    const suffix = qual.length > 0 ? ` (${qual.join(', ')})` : type.length > 0 ? ` [${type}]` : '';
    venues.push(`${name}${suffix}`);
    if (venues.length >= 6) break;
  }
  if (venues.length === 0) return '';
  return `Restauration : ${venues.join(' · ')}`;
}

interface SpaInfo {
  readonly name?: unknown;
  readonly surface_m2?: unknown;
  readonly partner_brand?: unknown;
  readonly features_fr?: unknown;
  readonly signature_treatments?: unknown;
}

/** Render the named wellness surface (brand, surface, facilities) from the row. */
function spaBlock(info: unknown): string {
  if (typeof info !== 'object' || info === null) return '';
  const si = info as SpaInfo;
  const name = str(si.name);
  const bits: string[] = [];
  const surface = num(si.surface_m2);
  if (surface !== null && surface > 0) bits.push(`${surface} m²`);
  const brand = str(si.partner_brand);
  if (brand.length > 0) bits.push(`partenaire ${brand}`);
  if (Array.isArray(si.features_fr)) {
    const feats = si.features_fr.filter((f): f is string => typeof f === 'string' && f.length > 0);
    if (feats.length > 0) bits.push(feats.slice(0, 5).join(', '));
  }
  if (name.length === 0 && bits.length === 0) return '';
  const head = name.length > 0 ? name : 'Spa';
  return `Spa : ${head}${bits.length > 0 ? ` — ${bits.join(' · ')}` : ''}`;
}

/** Build the compact grounded fact-sheet for one hotel. */
function buildHotelFacts(h: HotelFacts): string {
  const lines: string[] = [];
  const name = str(h.name);
  const nameEn = str(h.name_en);
  lines.push(`Nom : ${name}${nameEn.length > 0 && nameEn !== name ? ` (EN: ${nameEn})` : ''}`);
  const loc = [str(h.city), str(h.district)].filter((x) => x.length > 0).join(' — ');
  if (loc.length > 0) lines.push(`Localisation : ${loc}`);
  const stars = num(h.stars);
  const tierBits = [
    stars !== null ? `${stars}★` : '',
    h.is_palace === true ? 'Palace' : '',
    str(h.luxury_tier),
  ].filter((x) => x.length > 0);
  if (tierBits.length > 0) lines.push(`Catégorie : ${tierBits.join(' · ')}`);
  const rooms = num(h.number_of_rooms);
  const suites = num(h.number_of_suites);
  const roomBits = [
    rooms !== null ? `${rooms} chambres` : '',
    suites !== null ? `${suites} suites` : '',
  ].filter((x) => x.length > 0);
  if (roomBits.length > 0) lines.push(`Capacité : ${roomBits.join(', ')}`);
  const opened = str(h.opened_at);
  const renov = str(h.last_renovated_at);
  const timeBits = [
    opened.length > 0 ? `ouvert ${opened.slice(0, 10)}` : '',
    renov.length > 0 ? `rénové ${renov.slice(0, 10)}` : '',
  ].filter((x) => x.length > 0);
  if (timeBits.length > 0) lines.push(`Dates : ${timeBits.join(', ')}`);
  const aw = awardsLine(h.awards);
  if (aw.length > 0) lines.push(`Distinctions : ${aw}`);
  const af = affiliationsLine(h.affiliations);
  if (af.length > 0) lines.push(`Affiliations : ${af}`);
  const resto = restaurantBlock(h.restaurant_info);
  if (resto.length > 0) lines.push(resto);
  const spa = spaBlock(h.spa_info);
  if (spa.length > 0) lines.push(spa);
  const sig = namesFromArray(h.signature_experiences, ['title_fr', 'title', 'name', 'name_fr'], 5);
  if (sig.length > 0) lines.push(`Expériences signature : ${sig}`);
  const poi = namesFromArray(h.points_of_interest, ['name', 'name_fr', 'title'], 6);
  if (poi.length > 0) lines.push(`Points d'intérêt proches : ${poi}`);
  const conc = str(h.concierge_advice);
  if (conc.length > 0) lines.push(`Conseil du Concierge (source) : ${truncate(conc, 400)}`);
  const descFr = str(h.description_fr);
  if (descFr.length > 0) lines.push(`\nDESCRIPTION FR :\n${truncate(descFr, 1400)}`);
  const sections = sectionsBlock(h.long_description_sections);
  if (sections.length > 0) lines.push(`\nSECTIONS LONGUES (FR) :\n${truncate(sections, 2600)}`);
  return lines.join('\n');
}

/* ── LLM ──────────────────────────────────────────────────────────────────*/

const SYSTEM_PROMPT = `Tu es le Concierge éditorial de MyConciergeHotel.com, agence de voyage accréditée IATA spécialiste des hôtels d'exception (Palaces Atout France, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World).

Tu réécris la JUSTIFICATION d'un hôtel dans un classement éditorial. Objectif : expliquer pourquoi CET hôtel mérite sa place dans CE classement, avec des FAITS CONCRETS ET NOMMÉS, dans la voix du Concierge.

VOIX DU CONCIERGE (règles dures, non négociables) :
- Expert complice, initié — jamais commercial, jamais journalistique creux.
- Détails concrets NOMMÉS : l'architecte, l'année d'ouverture/rénovation, le nom d'une suite ou chambre signature, le restaurant et son chef + nombre d'étoiles Michelin, le spa, une référence culturelle précise (Atout France + millésime, Relais & Châteaux, LHW), une anecdote vérifiable, la précision de localisation (distance/quartier).
- Phrases courtes : 25 mots MAXIMUM par phrase, voix active.
- INTERDITS absolus : "incroyable", "magnifique", "exceptionnel" (sauf classification Atout France), "magique", "sublime", "s'impose naturellement", "adresse de référence", "incontournable", "véritable", "n'hésitez pas", "notamment". Aucun superlatif vide.
- Ne JAMAIS inventer un fait. Si l'architecte / le chef / la suite n'est pas dans les FAITS fournis, ne le mentionne pas. Tu es une agence IATA : exactitude = EEAT.
- INTERDIT (hors périmètre) : aucun prix, aucun tarif, aucune mention "à partir de", aucune réservation, aucune offre.
- Aucun méta-commentaire de pipeline, aucun backtick, aucun identifiant Wikidata, aucune balise HTML, aucun emoji.

LONGUEUR : justification_fr ≈ 110-160 mots (entre 600 et 1100 caractères). C'est une réécriture RICHE, pas un résumé.

ANGLAIS (en-GB) : justification_en est une réécriture native fidèle du NOUVEAU justification_fr, même richesse et même longueur, registre "Condé Nast Traveler". Préserve EXACTEMENT chiffres, noms propres, noms de chefs, distinctions, distances. Ce n'est pas du mot-à-mot. N'ajoute aucun fait absent du français.

SORTIE : un objet JSON STRICT { "justification_fr": "...", "justification_en": "..." } — rien d'autre.`;

function buildUserPrompt(input: {
  readonly rankingTitle: string;
  readonly rank: number;
  readonly facts: string;
  readonly currentFr: string;
}): string {
  return `CLASSEMENT : « ${input.rankingTitle} »
RANG de cet hôtel : #${input.rank}

JUSTIFICATION ACTUELLE (FR, à enrichir et concrétiser — ne la recopie pas si elle est générique) :
${input.currentFr.length > 0 ? input.currentFr : '(vide)'}

FAITS VÉRIFIÉS SUR L'HÔTEL (source unique de vérité — n'invente rien au-delà) :
${input.facts}

Réécris maintenant justification_fr (concrète, nommée, voix Concierge, ≤25 mots/phrase) et produis justification_en (anglais britannique fidèle, même richesse). JSON strict.`;
}

const JustificationSchema = z.object({
  justification_fr: z.string().min(40),
  justification_en: z.string().min(40),
});

/* ── Validation / clamp / leak salvage ─────────────────────────────────────*/

const MAX_CHARS = 1180; // DB CHECK is 40-1200; stay safely under.
const MIN_CHARS = 40;

/** Clamp to `max` chars at a sentence boundary; fall back to a word boundary. */
function clampToSentence(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastTerm = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('… '),
  );
  if (lastTerm > max * 0.5) return slice.slice(0, lastTerm + 1).trim();
  const sp = slice.lastIndexOf(' ');
  return (sp > max * 0.6 ? slice.slice(0, sp) : slice).trim();
}

/** Drop only the leaking sentence(s), keep the clean remainder. */
function stripLeakSentences(text: string): string {
  return splitSentences(text)
    .filter((s) => !hasLeak(s))
    .join(' ')
    .trim();
}

/**
 * Clean one locale string: strip leaks if present, clamp to the DB ceiling.
 * Returns null when nothing publishable survives (too short / still leaking).
 */
function cleanLocale(raw: string): string | null {
  let v = raw.trim();
  if (hasLeak(v)) v = stripLeakSentences(v);
  if (hasLeak(v)) return null;
  v = clampToSentence(v, MAX_CHARS);
  if (v.length < MIN_CHARS) return null;
  return v;
}

/* ── Generic-entry detection (targeting for --generic-only) ────────────────*/

/**
 * A justification is "concrete enough" when it names at least one hard fact:
 * architect/designer, a Michelin table/star/key, a dated distinction, an open
 * year, a named suite/room, or a measured dimension. Entries that name none of
 * these read as generic prose and are the targets for a grounded rewrite.
 */
const CONCRETE_MARKER =
  /(architect|designer|sign[ée]\s+par|con[çc]u par|dessin[ée]|\bMichelin\b|[ée]toil|\bclés?\b|Three Keys|Trois Cl[ée]s|Atout France|Relais\s*&|Forbes|Leading Hotels|World'?s 50|ouvert(?:e)? en\s+\d|inaugur[ée]\s+en\s+\d|cr[ée][ée]\s+en\s+\d|r[ée]nov|\b1[5-9]\d\d\b|\b20[0-2]\d\b|\bm²\b|\bm2\b|\d+\s*m[èe]tres?\b|\d+\s*(?:chambres|suites|cabines)|suite\s+[A-ZÉ])/u;

function hasConcreteMarkers(fr: string): boolean {
  return fr.length >= 250 && CONCRETE_MARKER.test(fr);
}

/** True when the hotel row carries dining facts (chef / Michelin) the prose could surface. */
function hasSurfaceableDining(h: HotelFacts | null): boolean {
  if (h === null || typeof h.restaurant_info !== 'object' || h.restaurant_info === null) {
    return false;
  }
  const ri = h.restaurant_info as RestaurantInfo;
  const top = num(ri.michelin_stars);
  if (top !== null && top > 0) return true;
  if (!Array.isArray(ri.venues)) return false;
  for (const v of ri.venues) {
    if (typeof v !== 'object' || v === null) continue;
    const venue = v as RestaurantVenue;
    if (str(venue.chef).length > 0) return true;
    const s = num(venue.michelin_stars);
    if (s !== null && s > 0) return true;
  }
  return false;
}

/** Whether an entry should be rewritten in --generic-only mode. */
function isGenericTarget(e: EntryRow): boolean {
  const fr = e.justification_fr ?? '';
  if (!hasConcreteMarkers(fr)) return true;
  // Concrete-ish but never mentions its starred table while the row has one.
  if (!/Michelin|[ée]toil/u.test(fr) && hasSurfaceableDining(e.hotels)) return true;
  return false;
}

/* ── Timeouts (every LLM call inside the batch loop MUST be bounded) ────────*/

/**
 * Hard ceiling for a single grounded LLM rewrite. A run on 2026-06-23 froze
 * for ~8 h on ONE unbounded LLM call (`top-relais-chateaux-allemagne`): the
 * provider socket hung, `callLlm` never settled, and the enclosing concurrency
 * map waited on that `await` forever — freezing the whole run. Any LLM /
 * network call inside a batch loop MUST be bounded so a single stuck request
 * degrades to a skipped entry, never a frozen run. Override via env if a slow
 * model legitimately needs more headroom.
 * Cf. `.cursor/skills/llm-output-robustness/SKILL.md`.
 */
const LLM_TIMEOUT_MS: number = (() => {
  const raw = Number(process.env['ENRICH_JUSTIF_LLM_TIMEOUT_MS']);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120_000;
})();

class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Race a promise against a timer that rejects with a `TimeoutError`. The timer
 * is unref'd so it never keeps the process alive, and is always cleared so a
 * fast settle does not leak a pending handle. The underlying promise may still
 * settle later (the provider SDK has its own socket timeout) — we simply stop
 * awaiting it, which unblocks the batch.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/* ── Concurrency ───────────────────────────────────────────────────────────*/

/**
 * Bounded-parallel map that ISOLATES per-item failures: a rejected `fn` is
 * routed to `onError` (which must synthesise a fallback result) so one bad
 * entry can never poison its siblings, and `Promise.allSettled` guarantees the
 * batch always resolves even if a worker rejects unexpectedly. Combined with
 * `withTimeout`, this is what stops a single stuck call from freezing the run.
 */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (t: T, i: number) => Promise<R>,
  onError: (t: T, i: number, err: unknown) => R,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      const item = items[i] as T;
      try {
        results[i] = await fn(item, i);
      } catch (err) {
        results[i] = onError(item, i, err);
      }
    }
  });
  await Promise.allSettled(workers);
  return results;
}

/* ── Per-entry ─────────────────────────────────────────────────────────────*/

interface EntryResult {
  readonly hotelId: string;
  readonly rank: number;
  readonly hotelSlug: string;
  readonly enBefore: number;
  readonly enAfter: number;
  readonly frBefore: number;
  readonly frAfter: number;
  readonly status: 'updated' | 'skipped' | 'leak-skip' | 'no-facts' | 'error';
  readonly detail?: string;
}

async function enrichEntry(
  llm: LlmClient,
  env: PgEnv,
  rankingId: string,
  rankingTitle: string,
  entry: EntryRow,
  dryRun: boolean,
): Promise<EntryResult> {
  const hotelSlug = str(entry.hotels?.slug);
  const enBefore = (entry.justification_en ?? '').length;
  const frBefore = (entry.justification_fr ?? '').length;
  const base = {
    hotelId: entry.hotel_id,
    rank: entry.rank,
    hotelSlug,
    enBefore,
    frBefore,
  } as const;

  if (entry.hotels === null) {
    return { ...base, enAfter: enBefore, frAfter: frBefore, status: 'no-facts' };
  }
  const facts = buildHotelFacts(entry.hotels);
  if (facts.length < 80) {
    return { ...base, enAfter: enBefore, frAfter: frBefore, status: 'no-facts' };
  }

  const userPrompt = buildUserPrompt({
    rankingTitle,
    rank: entry.rank,
    facts,
    currentFr: entry.justification_fr ?? '',
  });

  const label = `justif ${hotelSlug}#${entry.rank}`;
  let parsed: z.infer<typeof JustificationSchema>;
  try {
    parsed = await withTimeout(
      callLlm(llm, SYSTEM_PROMPT, userPrompt, JustificationSchema, label),
      LLM_TIMEOUT_MS,
      label,
    );
  } catch (err) {
    return {
      ...base,
      enAfter: enBefore,
      frAfter: frBefore,
      status: 'error',
      detail: err instanceof Error ? err.message.slice(0, 160) : String(err),
    };
  }

  const fr = cleanLocale(parsed.justification_fr);
  const en = cleanLocale(parsed.justification_en);
  if (fr === null || en === null) {
    return { ...base, enAfter: enBefore, frAfter: frBefore, status: 'leak-skip' };
  }

  if (!dryRun) {
    try {
      await patchEntry(env, rankingId, entry.hotel_id, {
        justification_fr: fr,
        justification_en: en,
      });
    } catch (err) {
      return {
        ...base,
        enAfter: enBefore,
        frAfter: frBefore,
        status: 'error',
        detail: err instanceof Error ? err.message.slice(0, 160) : String(err),
      };
    }
  } else {
    console.log(`\n  ── DRY-RUN ${hotelSlug} #${entry.rank} ──`);
    console.log(`  FR (${fr.length}c): ${fr}`);
    console.log(`  EN (${en.length}c): ${en}\n`);
  }
  return { ...base, enAfter: en.length, frAfter: fr.length, status: 'updated' };
}

/* ── CLI ───────────────────────────────────────────────────────────────────*/

interface CliArgs {
  readonly slugs: readonly string[];
  readonly priority: boolean;
  readonly all: boolean;
  readonly limit: number;
  readonly minEn: number;
  readonly force: boolean;
  readonly genericOnly: boolean;
  readonly entryConcurrency: number;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let slugs: string[] = [];
  let priority = false;
  let all = false;
  let limit = 0;
  let minEn = 120;
  let force = false;
  let genericOnly = false;
  let entryConcurrency = 3;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a === '--priority') priority = true;
    else if (a === '--all') all = true;
    else if (a === '--force') force = true;
    else if (a === '--generic-only') genericOnly = true;
    else if (a.startsWith('--slug=')) slugs = [a.slice('--slug='.length)];
    else if (a.startsWith('--slugs=')) {
      slugs = a
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (Number.isFinite(n) && n >= 0) limit = Math.floor(n);
    } else if (a.startsWith('--min-en=')) {
      const n = Number(a.slice('--min-en='.length));
      if (Number.isFinite(n) && n >= 0) minEn = Math.floor(n);
    } else if (a.startsWith('--entry-concurrency=')) {
      const n = Number(a.slice('--entry-concurrency='.length));
      if (Number.isFinite(n) && n > 0) entryConcurrency = Math.min(5, Math.floor(n));
    }
  }
  return { slugs, priority, all, limit, minEn, force, genericOnly, entryConcurrency, dryRun };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const provider = resolveProvider(env);
  const llm = buildLlmClient(env, provider);
  const pg = loadPgEnv();

  // Resolve target rankings.
  let rankings = await fetchRankings(pg, args.slugs.length > 0 ? { slugs: args.slugs } : {});

  if (args.priority) {
    rankings = rankings.filter((r) => Number.isFinite(priorityIndex(r.slug)));
  }

  // Always order priority-first, then alphabetical — so a kill mid-run has
  // already shipped the highest-traffic cities.
  rankings = [...rankings].sort((a, b) => {
    const pa = priorityIndex(a.slug);
    const pb = priorityIndex(b.slug);
    if (pa !== pb) return pa - pb;
    return a.slug.localeCompare(b.slug);
  });

  if (args.limit > 0) rankings = rankings.slice(0, args.limit);

  console.log(
    `[enrich-ranking-justifications] rankings=${rankings.length} minEn=${args.minEn} force=${args.force} genericOnly=${args.genericOnly} entryConcurrency=${args.entryConcurrency} dryRun=${args.dryRun} provider=${provider} model=${llm.model}`,
  );
  if (rankings.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const allResults: Array<EntryResult & { ranking: string }> = [];
  let rankingsTouched = 0;

  for (let i = 0; i < rankings.length; i += 1) {
    const ranking = rankings[i] as RankingRow;
    let entries: EntryRow[];
    try {
      entries = await fetchEntries(pg, ranking.id);
    } catch (err) {
      console.error(`  ✗ [${ranking.slug}] fetch entries: ${(err as Error).message}`);
      continue;
    }

    const targets = args.force
      ? entries
      : args.genericOnly
        ? entries.filter(isGenericTarget)
        : entries.filter((e) => (e.justification_en ?? '').length < args.minEn);

    if (targets.length === 0) {
      console.log(
        `  [${i + 1}/${rankings.length}] ${ranking.slug} — ${entries.length} entries, 0 need work (skip)`,
      );
      continue;
    }

    console.log(
      `  [${i + 1}/${rankings.length}] ${ranking.slug} — ${targets.length}/${entries.length} entries to enrich…`,
    );

    const results = await runWithConcurrency(
      targets,
      args.entryConcurrency,
      (entry) => enrichEntry(llm, pg, ranking.id, ranking.title_fr, entry, args.dryRun),
      (entry, _i, err): EntryResult => ({
        hotelId: entry.hotel_id,
        rank: entry.rank,
        hotelSlug: str(entry.hotels?.slug),
        enBefore: (entry.justification_en ?? '').length,
        enAfter: (entry.justification_en ?? '').length,
        frBefore: (entry.justification_fr ?? '').length,
        frAfter: (entry.justification_fr ?? '').length,
        status: 'error',
        detail: err instanceof Error ? err.message.slice(0, 160) : String(err),
      }),
    );

    let updated = 0;
    for (const r of results) {
      allResults.push({ ...r, ranking: ranking.slug });
      if (r.status === 'updated') updated += 1;
      if (r.status === 'error') console.error(`      ✗ ${r.hotelSlug}#${r.rank}: ${r.detail}`);
      if (r.status === 'leak-skip') console.warn(`      ⚠ leak-skip ${r.hotelSlug}#${r.rank}`);
    }

    // Checkpoint: verify the writes landed (cheap re-read of EN lengths).
    if (!args.dryRun && updated > 0) {
      try {
        const after = await fetchEntries(pg, ranking.id);
        const enriched = after.filter(
          (e) => (e.justification_en ?? '').length >= args.minEn,
        ).length;
        console.log(
          `      ✓ ${ranking.slug}: ${updated} updated • verified ${enriched}/${after.length} entries now EN≥${args.minEn}`,
        );
      } catch {
        console.log(`      ✓ ${ranking.slug}: ${updated} updated (verify re-read failed)`);
      }
    }
    rankingsTouched += 1;
  }

  // Summary + word-count delta sample.
  const updatedRes = allResults.filter((r) => r.status === 'updated');
  const sample = updatedRes.slice(0, 5);
  console.log('\n──────── SUMMARY ────────');
  console.log(
    `rankings touched: ${rankingsTouched} • entries updated: ${updatedRes.length} • leak-skip: ${allResults.filter((r) => r.status === 'leak-skip').length} • errors: ${allResults.filter((r) => r.status === 'error').length}`,
  );
  for (const s of sample) {
    console.log(
      `  ${s.ranking} #${s.rank} ${s.hotelSlug}: EN ${s.enBefore}→${s.enAfter} chars, FR ${s.frBefore}→${s.frAfter} chars`,
    );
  }

  const RUNLOG_DIR = resolve(__dirname, '../../runs');
  mkdirSync(RUNLOG_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(
    resolve(RUNLOG_DIR, `enrich-ranking-justifications-${ts}.json`),
    `${JSON.stringify(
      { finishedAt: new Date().toISOString(), args, rankingsTouched, results: allResults },
      null,
      2,
    )}\n`,
  );
}

main().catch((err: unknown) => {
  console.error(
    '[enrich-ranking-justifications] FATAL',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
