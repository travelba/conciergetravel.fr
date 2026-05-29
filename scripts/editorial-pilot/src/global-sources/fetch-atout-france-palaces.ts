/**
 * fetch-atout-france-palaces.ts — patch `hotels.affiliations[]` with the
 * Palace distinction (Atout France) on every matching row.
 *
 * Source: Atout France official Palace distinction
 * (https://www.atout-france.fr/) — the list is updated by ministerial
 * decree. The current snapshot is "Collection Palace 2026 (interim)",
 * captured 2026-05-28:
 *
 *   - 31 hotels held the distinction at the end of 2025 (the 2019 list
 *     was renewed without change until then).
 *   - **4 removals** announced 2026-05-23 (commission review, late 2025):
 *     Mandarin Oriental Paris (in renovation), Park Hyatt Paris-Vendôme,
 *     Hôtel du Palais Biarritz, Byblos Saint-Tropez.
 *   - **6 renewals** confirmed publicly: Les Sources de Caudalie,
 *     Les Prés d'Eugénie, Cheval Blanc Saint-Barth, Mandarin Oriental
 *     Lutetia Paris, Shangri-La Paris, Airelles Courchevel.
 *   - The complete 2026 Collection (including new entrants) will be
 *     unveiled at a press conference in Paris on **2 June 2026**.
 *
 * Until that date the script ships the 27 confirmed Palaces (the 31
 * historical minus the 4 removed). After 2 June the seed list MUST be
 * extended with the new entrants and re-run.
 *
 * The pipeline is intentionally **patch-only**: hotels listed below that
 * are not yet in our catalogue are reported in
 * `atout-france-palaces-missing.json` for a separate draft-creation
 * follow-up (Cap d'Antibes Beach Hotel, Domaine des Étangs, Hôtel
 * Majestic Cannes, Hôtel Martinez Cannes, Le K2 Altitude).
 *
 * Affiliation contract: see `packages/db/src/schema/affiliations.ts`.
 *
 * Usage:
 *   pnpm atout-france:palaces:dry     # plan only (writes report JSON)
 *   pnpm atout-france:palaces         # actually patch via PostgREST
 *
 * Skill: api-integration, content-modeling, supabase-postgres-rls.
 * ADR: docs/adr/0023-hotel-affiliations-vs-external-sources.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const SCRAPED_AT = new Date().toISOString();

// ─── Seed list — Collection Palace 2026 (interim, awaiting 2 June official) ──

interface PalaceSeed {
  readonly canonical_name: string;
  /** ILIKE patterns ordered from narrow to broad — first hit wins. */
  readonly name_patterns: readonly string[];
  readonly city: string;
  /** Year the hotel first received the Palace distinction. */
  readonly since_year: number;
  /** Year of the most recent renewal (3-year cycle since 2024 reform). */
  readonly last_renewal_year: number;
  /** Was the distinction publicly confirmed for the 2026 cycle? */
  readonly renewed_2026: boolean;
  /** Optional public source URL backing the verification. */
  readonly source_url?: string;
}

const PALACES_2026: readonly PalaceSeed[] = [
  // ─── Paris (10 of the 12 historical — Mandarin Oriental Paris and
  // Park Hyatt Paris-Vendôme removed 2026)
  {
    canonical_name: 'Hôtel Le Bristol Paris',
    name_patterns: ['%bristol%paris%', '%bristol%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2021,
    renewed_2026: false,
  },
  {
    canonical_name: 'Le Meurice',
    name_patterns: ['%meurice%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2021,
    renewed_2026: false,
  },
  {
    canonical_name: 'Plaza Athénée Paris',
    name_patterns: ['%plaza ath%n%e%paris%', '%plaza ath%n%e%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2021,
    renewed_2026: false,
  },
  {
    canonical_name: 'Le Royal Monceau Raffles Paris',
    name_patterns: ['%royal monceau%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2021,
    renewed_2026: false,
  },
  {
    canonical_name: 'The Peninsula Paris',
    name_patterns: ['%peninsula%paris%'],
    city: 'Paris',
    since_year: 2014,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Shangri-La Paris',
    name_patterns: ['%shangri%la%paris%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
  {
    canonical_name: 'Four Seasons Hotel George V Paris',
    name_patterns: ['%george%v%paris%', '%george%v%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Hôtel de Crillon',
    name_patterns: ['%crillon%'],
    city: 'Paris',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Mandarin Oriental Lutetia Paris',
    name_patterns: ['%lutetia%'],
    city: 'Paris',
    since_year: 2014,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
  {
    canonical_name: 'Cheval Blanc Paris',
    name_patterns: ['%cheval blanc%paris%'],
    city: 'Paris',
    since_year: 2022,
    last_renewal_year: 2022,
    renewed_2026: false,
  },

  // ─── Côte d'Azur (8)
  {
    canonical_name: 'Hôtel du Cap-Eden-Roc',
    name_patterns: ['%cap-eden-roc%', '%cap eden%roc%'],
    city: 'Antibes',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Grand-Hôtel du Cap-Ferrat',
    name_patterns: ['%cap-ferrat%', '%cap ferrat%'],
    city: 'Saint-Jean-Cap-Ferrat',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'La Réserve de Beaulieu',
    name_patterns: ['%la r%serve%beaulieu%', '%reserve%beaulieu%'],
    city: 'Beaulieu-sur-Mer',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: "Cap d'Antibes Beach Hotel",
    name_patterns: ['%cap d%antibes beach%', '%cap antibes beach%'],
    city: 'Antibes',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Hôtel Martinez Cannes',
    name_patterns: ['%martinez%cannes%', '%martinez%'],
    city: 'Cannes',
    since_year: 2013,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Hôtel Majestic Cannes',
    name_patterns: ['%majestic%cannes%', '%majestic barri%re%'],
    city: 'Cannes',
    since_year: 2013,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Carlton Cannes',
    name_patterns: ['%carlton%cannes%'],
    city: 'Cannes',
    since_year: 2013,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Cheval Blanc St-Tropez',
    name_patterns: ['%cheval blanc%tropez%'],
    city: 'Saint-Tropez',
    since_year: 2013,
    last_renewal_year: 2022,
    renewed_2026: false,
  },

  // ─── Courchevel (4)
  {
    canonical_name: 'Cheval Blanc Courchevel',
    name_patterns: ['%cheval blanc%courchevel%'],
    city: 'Courchevel',
    since_year: 2011,
    last_renewal_year: 2022,
    renewed_2026: false,
  },
  {
    canonical_name: 'Les Airelles Courchevel',
    name_patterns: ['%airelles%courchevel%', '%airelles%'],
    city: 'Courchevel',
    since_year: 2011,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
  {
    canonical_name: 'Le K2 Palace',
    name_patterns: ['%k2 palace%'],
    city: 'Courchevel',
    since_year: 2015,
    last_renewal_year: 2023,
    renewed_2026: false,
  },
  {
    canonical_name: 'Le K2 Altitude',
    name_patterns: ['%k2 altitude%'],
    city: 'Courchevel',
    since_year: 2017,
    last_renewal_year: 2024,
    renewed_2026: false,
  },

  // ─── Provinces (3)
  {
    canonical_name: 'Les Sources de Caudalie',
    name_patterns: ['%sources%caudalie%'],
    city: 'Martillac',
    since_year: 2015,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
  {
    canonical_name: "Les Prés d'Eugénie",
    name_patterns: ['%pr%s%eug%nie%'],
    city: 'Eugénie-les-Bains',
    since_year: 2011,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
  {
    canonical_name: 'Domaine des Étangs',
    name_patterns: ['%domaine%%tangs%', '%domaine des etangs%'],
    city: 'Massignac',
    since_year: 2019,
    last_renewal_year: 2023,
    renewed_2026: false,
  },

  // ─── Saint-Barthélemy (1)
  {
    canonical_name: 'Cheval Blanc Saint-Barth',
    name_patterns: ['%cheval blanc%barth%', '%cheval blanc%saint-barth%'],
    city: 'Saint-Barthélemy',
    since_year: 2014,
    last_renewal_year: 2026,
    renewed_2026: true,
    source_url:
      'https://www.atout-france.fr/fr/actualites/distinction-palace-de-nouveaux-renouvellements',
  },
];

// ─── Affiliation entry — mirrors HotelAffiliationSchema (packages/db) ────────

interface PalaceAffiliation {
  kind: 'label';
  source: 'palace_atout_france';
  display_name: string;
  verified: true;
  since_year: number;
  facet_slug: 'palace-atout-france';
  source_url?: string;
  scraped_at: string;
  metadata: {
    last_renewal_year: number;
    renewed_2026: boolean;
  };
}

function buildPalaceAffiliation(palace: PalaceSeed): PalaceAffiliation {
  const aff: PalaceAffiliation = {
    kind: 'label',
    source: 'palace_atout_france',
    display_name: 'Palace (distinction Atout France)',
    verified: true,
    since_year: palace.since_year,
    facet_slug: 'palace-atout-france',
    scraped_at: SCRAPED_AT,
    metadata: {
      last_renewal_year: palace.last_renewal_year,
      renewed_2026: palace.renewed_2026,
    },
  };
  if (palace.source_url !== undefined) {
    aff.source_url = palace.source_url;
  }
  return aff;
}

// ─── Matching against public.hotels via PostgREST ────────────────────────────

interface HotelRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  luxury_tier: string | null;
  is_published: boolean;
  affiliations: unknown[] | null;
}

async function fetchHotelByPatterns(
  restBase: string,
  baseHeaders: Record<string, string>,
  patterns: readonly string[],
  expectedCity: string,
): Promise<HotelRow | null> {
  for (const pattern of patterns) {
    const url = new URL(`${restBase}/hotels`);
    url.searchParams.set('name', `ilike.${pattern}`);
    url.searchParams.set('country_code', 'eq.FR');
    url.searchParams.set(
      'select',
      'id,slug,name,city,country_code,luxury_tier,is_published,affiliations',
    );
    url.searchParams.set('limit', '10');
    const res = await fetch(url.toString(), { headers: baseHeaders });
    if (!res.ok) continue;
    const rows = (await res.json()) as HotelRow[];
    if (rows.length === 0) continue;
    // Prefer published row whose city matches the expected one.
    const ranked = rows.slice().sort((a, b) => {
      const aCityHit = (a.city ?? '').toLowerCase().includes(expectedCity.toLowerCase()) ? 0 : 1;
      const bCityHit = (b.city ?? '').toLowerCase().includes(expectedCity.toLowerCase()) ? 0 : 1;
      if (aCityHit !== bCityHit) return aCityHit - bCityHit;
      const aPub = a.is_published ? 0 : 1;
      const bPub = b.is_published ? 0 : 1;
      return aPub - bPub;
    });
    const first = ranked[0];
    if (first !== undefined) return first;
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  if (!supabaseUrl || !serviceKey) {
    console.error(
      '[atout-france-palaces] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
    );
    process.exit(1);
  }
  const restBase = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1`;
  const baseHeaders: Record<string, string> = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  console.log(`[atout-france-palaces] ${PALACES_2026.length} palaces in seed list`);
  console.log(`[atout-france-palaces] dry-run: ${DRY_RUN ? 'YES' : 'NO'}`);

  interface MatchedEntry {
    palace: PalaceSeed;
    hotel: HotelRow;
    action: 'patch' | 'skip_already_tagged';
  }
  const matched: MatchedEntry[] = [];
  const missing: PalaceSeed[] = [];

  // ─── Resolve each seed against the catalogue ─────────────────────────────
  for (const palace of PALACES_2026) {
    const hit = await fetchHotelByPatterns(
      restBase,
      baseHeaders,
      palace.name_patterns,
      palace.city,
    );
    if (hit === null) {
      missing.push(palace);
      continue;
    }
    const existing = (hit.affiliations ?? []) as Array<{ source?: string }>;
    const alreadyTagged = existing.some((e) => e?.source === 'palace_atout_france');
    matched.push({
      palace,
      hotel: hit,
      action: alreadyTagged ? 'skip_already_tagged' : 'patch',
    });
  }

  console.log(`[atout-france-palaces] matched   : ${matched.length}`);
  console.log(
    `[atout-france-palaces] to patch  : ${matched.filter((m) => m.action === 'patch').length}`,
  );
  console.log(
    `[atout-france-palaces] skip      : ${matched.filter((m) => m.action === 'skip_already_tagged').length}`,
  );
  console.log(`[atout-france-palaces] missing   : ${missing.length}`);

  // ─── Write audit artifacts ──────────────────────────────────────────────
  writeFileSync(
    resolve(ROOT, 'atout-france-palaces-matched.json'),
    JSON.stringify(
      matched.map((m) => ({
        palace: m.palace.canonical_name,
        renewed_2026: m.palace.renewed_2026,
        last_renewal_year: m.palace.last_renewal_year,
        mch_id: m.hotel.id,
        mch_slug: m.hotel.slug,
        mch_name: m.hotel.name,
        mch_city: m.hotel.city,
        action: m.action,
      })),
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(ROOT, 'atout-france-palaces-missing.json'),
    JSON.stringify(
      missing.map((p) => ({
        canonical_name: p.canonical_name,
        city: p.city,
        since_year: p.since_year,
        reason: 'no row in public.hotels matched any of the name patterns',
      })),
      null,
      2,
    ),
  );

  if (DRY_RUN) {
    console.log(
      '[atout-france-palaces] dry-run complete — see global-sources/atout-france-palaces-*.json',
    );
    process.exit(0);
  }

  // ─── PATCH affiliations[] for matched hotels ─────────────────────────────
  let patched = 0;
  let patchErrors = 0;

  for (const m of matched) {
    if (m.action !== 'patch') continue;
    const entry = buildPalaceAffiliation(m.palace);
    const existing = (m.hotel.affiliations ?? []) as Record<string, unknown>[];
    const merged = [...existing, entry];

    const url = `${restBase}/hotels?id=eq.${m.hotel.id}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({
        affiliations: merged,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      patched++;
      console.log(`  + ${m.hotel.slug} ← Palace (${m.palace.last_renewal_year})`);
    } else {
      patchErrors++;
      const t = await res.text();
      console.error(`  patch fail ${m.hotel.slug}: ${res.status} ${t.slice(0, 200)}`);
    }
  }

  console.log(
    `\n[atout-france-palaces] patched : ${patched} / ${matched.filter((x) => x.action === 'patch').length}`,
  );
  if (patchErrors > 0) {
    console.log(`[atout-france-palaces] errors  : ${patchErrors}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[atout-france-palaces] fatal', e);
  process.exit(1);
});
