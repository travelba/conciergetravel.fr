/**
 * dry-run-eligibility.ts — READ-ONLY proof of the C1 eligibility refinement.
 *
 * For a handful of control rankings it prints the eligible-hotel count BEFORE
 * (the legacy permissive `city.includes(key)` rule) and AFTER (the new
 * whole-word `cityMatchesKey` rule in `combinator.ts`), and lists the hotels
 * dropped — i.e. the cross-country false positives the C1 audit flagged. It
 * also proves a Relais & Châteaux ranking now filters on
 * `luxury_tier='relais_chateaux'` rather than a name heuristic.
 *
 * No DB write, no LLM call.
 *
 * Run:
 *   pnpm --filter @mch/editorial-pilot exec tsx src/rankings/dry-run-eligibility.ts
 */

import { loadHotelsCatalog, type HotelCatalogRow } from './load-hotels-catalog.js';
import { eligibilityFor } from './combinator.js';
import { resolveLieu, type LieuDef, type RankingAxes } from './axes.js';

const lc = (s: string): string => s.toLowerCase();

/** Legacy lieu predicate — the pre-C1 behaviour (permissive `city.includes`). */
function legacyLieuMatches(h: HotelCatalogRow, lieu: LieuDef): boolean {
  if (lieu.slug === 'france') return true;
  const countryCodes = lieu.countryCodes;
  if (countryCodes !== undefined && countryCodes.length > 0) {
    const cc = (h.country_code ?? '').toUpperCase();
    if (!countryCodes.some((t) => t.toUpperCase() === cc)) return false;
    if (lieu.hotelCityKeys.length === 0) return true;
  }
  const c = lc(h.city);
  const cityMatch = lieu.hotelCityKeys.some((k) => c === lc(k) || c.includes(lc(k)));
  if (!cityMatch) return false;
  if (lieu.postalCodePrefixes !== undefined && lieu.postalCodePrefixes.length > 0) {
    const pc = (h.postal_code ?? '').replace(/\s+/gu, '');
    return lieu.postalCodePrefixes.some((prefix) => pc.startsWith(prefix));
  }
  return true;
}

function geoAxes(slug: string, scope: RankingAxes['lieu']['scope']): RankingAxes {
  return {
    types: ['all'],
    lieu: { scope, slug, label: slug },
    themes: [],
    occasions: [],
    saison: 'toute-annee',
  };
}

async function main(): Promise<void> {
  const catalog = await loadHotelsCatalog();
  console.log(`Catalog: ${catalog.length} published hotels\n`);

  // ── Control "ville homonyme" slugs (the C1 false-positive sources) ──────────
  const controls: ReadonlyArray<{ slug: string; scope: RankingAxes['lieu']['scope'] }> = [
    { slug: 'cote-d-azur', scope: 'cluster' },
    { slug: 'provence', scope: 'cluster' },
    { slug: 'rome', scope: 'ville' },
    { slug: 'paris', scope: 'ville' },
  ];

  console.log('━━━ City whole-word match: BEFORE (.includes) → AFTER (whole-word) ━━━');
  for (const ctl of controls) {
    const lieu = resolveLieu(ctl.slug);
    if (lieu === null) {
      console.log(`  [${ctl.slug}] unknown lieu — skipped`);
      continue;
    }
    const afterPred = eligibilityFor(geoAxes(ctl.slug, ctl.scope));
    const before = catalog.filter((h) => legacyLieuMatches(h, lieu));
    const after = catalog.filter(afterPred);
    const afterSlugs = new Set(after.map((h) => h.slug));
    const dropped = before.filter((h) => !afterSlugs.has(h.slug));
    console.log(
      `  [${ctl.slug.padEnd(12)}] before=${before.length}  after=${after.length}  dropped=${dropped.length}`,
    );
    for (const d of dropped) {
      console.log(`      − ${d.slug} (city="${d.city}", ${d.country_code ?? '??'})`);
    }
  }

  // ── Relais & Châteaux: luxury_tier filter vs name heuristic ─────────────────
  console.log('\n━━━ Relais & Châteaux eligibility: name heuristic → luxury_tier filter ━━━');
  const franceAll = geoAxes('france', 'france');
  const byTier = catalog.filter(eligibilityFor(franceAll, { luxuryTiers: ['relais_chateaux'] }));
  const byAffiliation = catalog.filter(
    eligibilityFor(franceAll, { affiliationFacets: ['relais-chateaux'] }),
  );
  const nameRe = /relais|ch[âa]teau/iu;
  const byName = catalog.filter((h) => nameRe.test(h.name));
  const tierSlugs = new Set(byTier.map((h) => h.slug));
  const nameFalsePos = byName.filter((h) => !tierSlugs.has(h.slug)).length;
  const nameMisses = byTier.filter((h) => !nameRe.test(h.name)).length;
  console.log(`  name heuristic /relais|château/ : ${byName.length} hotels`);
  console.log(`  luxury_tier='relais_chateaux'   : ${byTier.length} hotels`);
  console.log(`  affiliation facet relais-chateaux: ${byAffiliation.length} hotels`);
  console.log(
    `  → name heuristic would WRONGLY include ${nameFalsePos} non-R&C and MISS ${nameMisses} real R&C`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
