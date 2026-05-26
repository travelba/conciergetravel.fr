import 'server-only';

import { unstable_cache } from 'next/cache';
import { z } from 'zod';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { pickByLocale, type SupportedLocale } from '@/i18n/supported-locale';

/**
 * Lieu-hub fallback data — for the regions AND cities that have zero
 * published rankings on `/classements/lieu/<slug>` (audit 2026-05-25)
 * but DO have published editorial guides + itineraries in the
 * catalogue.
 *
 * **Scope** (extended in P2B):
 *   - 4 hero regions: `champagne`, `provence`, `bordeaux`, `pays-basque`
 *   - 4 city slugs from `TOP_DESTINATION_NAV_ENTRIES` that have no
 *     hero alias: `cannes`, `aix-en-provence`, `reims`, `biarritz`
 *
 * Until rankings are produced for these slugs, clicking the
 * corresponding entry in the mega-menu lands on `/classements/lieu/<slug>`
 * and hits the generic `isEmpty` branch — two boilerplate CTAs that
 * ignore the fact we already have rich Concierge content there.
 *
 * This reader maps each slug to:
 *   - its parent editorial-guide slugs (`editorial_guides.slug`)
 *   - its parent itinerary slugs (`itineraries.slug_fr`)
 *
 * The bindings are explicit (not slug-pattern heuristics) so an
 * editor adding a "Champagne Premier Cru" itinerary doesn't suddenly
 * cross-link from the wrong hub. Update this file when a new
 * matching guide or itinerary is published.
 *
 * Returns `null` defensively on any error so a transient Supabase
 * outage degrades to "no fallback" rather than a 500.
 *
 * **Why we accept some duplication with the hero-region entries** —
 * cities like `biarritz` and `reims` produce the *same* guide +
 * itinerary as their hero (`pays-basque` and `champagne`). We could
 * deduplicate by aliasing, but the explicit duplicate keeps the
 * binding readable and survives the day where the city-specific
 * editorial content forks from the region-level one (very likely
 * to happen — Reims has a different POI set from broader Champagne).
 */

export type HeroRegionSlug =
  // Regions (hero mega-menu)
  | 'champagne'
  | 'provence'
  | 'bordeaux'
  | 'pays-basque'
  // The remaining hero regions are kept here so the type stays
  // exhaustive across `HERO_REGION_NAV_ENTRIES`, even though we
  // don't ship fallback bindings for them (they have published
  // rankings and the empty-state branch never fires).
  | 'cote-d-azur'
  | 'alpes'
  | 'corse'
  | 'loire'
  // Cities from TOP_DESTINATION_NAV_ENTRIES with no hero alias and
  // zero rankings (P2B extension 2026-05-26).
  | 'cannes'
  | 'aix-en-provence'
  | 'reims'
  | 'biarritz';

interface RegionHubDef {
  readonly labelFr: string;
  readonly labelEn: string;
  readonly guideSlugs: readonly string[];
  readonly itinerarySlugs: readonly string[];
  /** 30-50 word Concierge lede shown above the cards. */
  readonly introFr: string;
  readonly introEn: string;
}

/**
 * The 4 hero regions we currently produce fallback content for. The
 * other 4 hero regions are covered by published rankings — the
 * page never hits the empty branch for them.
 */
export const REGION_HUB_DEFS: Readonly<Partial<Record<HeroRegionSlug, RegionHubDef>>> = {
  champagne: {
    labelFr: 'Champagne',
    labelEn: 'Champagne',
    guideSlugs: ['reims-champagne'],
    itinerarySlugs: ['reims-champagne-week-end'],
    introFr:
      'La Champagne se vit sur quelques kilomètres carrés autour de Reims et d’Épernay. Notre conciergerie a sélectionné une poignée d’adresses 5★ pour goûter aux grandes maisons (Krug, Ruinart, Bollinger) sans renoncer au confort d’un Palace.',
    introEn:
      'Champagne unfolds over a few square kilometres between Reims and Épernay. Our concierge desk has hand-picked a handful of 5-star addresses to taste the great houses (Krug, Ruinart, Bollinger) without compromising on Palace-grade comfort.',
  },
  provence: {
    labelFr: 'Provence',
    labelEn: 'Provence',
    guideSlugs: ['provence', 'aix-en-provence', 'luberon', 'saint-remy-de-provence'],
    itinerarySlugs: ['provence-culture-gastronomie-10-jours'],
    introFr:
      'Entre les Alpilles et le Luberon, la Provence concentre l’une des plus fortes densités de Palaces et 5★ de France. Nos fiches couvrent Aix, Saint-Rémy, Gordes et la route des vignobles — chacune se ferme par un Conseil du Concierge.',
    introEn:
      'Between the Alpilles and the Luberon, Provence concentrates one of France’s densest Palace and 5-star footprints. Our pages cover Aix, Saint-Rémy, Gordes and the wine route — each closing with The Concierge’s Tip.',
  },
  bordeaux: {
    labelFr: 'Bordelais',
    labelEn: 'Bordeaux',
    guideSlugs: ['bordeaux'],
    itinerarySlugs: ['bordeaux-vignobles-gastronomie-5-jours'],
    introFr:
      'Bordeaux se découvre à la fois urbaine (place de la Bourse, Cité du Vin) et viticole (Saint-Émilion, Sauternes, Médoc). Notre conciergerie réunit ici les adresses 5★ de la ville et les châteaux-hôtels en plein vignoble.',
    introEn:
      'Bordeaux reveals itself as both urban (Place de la Bourse, Cité du Vin) and viticultural (Saint-Émilion, Sauternes, Médoc). Our concierge desk brings together the city’s 5-star addresses and the château-hotels nestled in the vineyards.',
  },
  'pays-basque': {
    labelFr: 'Pays basque',
    labelEn: 'Basque Country',
    guideSlugs: ['pays-basque', 'biarritz'],
    itinerarySlugs: ['biarritz-pays-basque-5-jours'],
    introFr:
      'De Biarritz à Saint-Jean-de-Luz, le Pays basque marie Belle Époque et Atlantique. Notre sélection rassemble les Palaces côtiers historiques et les domaines secrets de l’arrière-pays — sans oublier les passerelles vers San Sebastián.',
    introEn:
      'From Biarritz to Saint-Jean-de-Luz, the Basque Country marries Belle Époque heritage with the Atlantic. Our selection covers the coastal heritage Palaces and the secret domaines of the hinterland — including bridges to San Sebastián.',
  },
  cannes: {
    labelFr: 'Cannes',
    labelEn: 'Cannes',
    guideSlugs: ['cannes', 'cote-d-azur'],
    itinerarySlugs: ['cote-d-azur-luxe-7-jours'],
    introFr:
      'Cannes ne se résume pas à la Croisette du Festival — c’est une porte d’entrée sur Antibes, le Cap-Ferrat et Èze. Notre conciergerie réunit ici les adresses 5★ et Palaces côtiers ainsi que l’itinéraire de référence pour découvrir la Côte d’Azur en sept jours.',
    introEn:
      'Cannes is more than the festival Croisette — it’s the gateway to Antibes, Cap-Ferrat and Èze. Our concierge desk brings together the 5-star and Palace seafront addresses, plus the reference 7-day itinerary to discover the French Riviera.',
  },
  'aix-en-provence': {
    labelFr: 'Aix-en-Provence',
    labelEn: 'Aix-en-Provence',
    guideSlugs: ['aix-en-provence', 'provence'],
    itinerarySlugs: ['provence-culture-gastronomie-10-jours'],
    introFr:
      'Aix se vit comme un camp de base : à 20 minutes des Baux-de-Provence, 45 du Luberon, 1 h d’Avignon. Notre sélection associe les hôtels du centre historique aux domaines viticoles des coteaux d’Aix, et un itinéraire 10 jours pour la Provence éternelle.',
    introEn:
      'Aix works best as a base camp: 20 minutes from Les Baux-de-Provence, 45 from the Luberon, 1 h from Avignon. Our selection combines historic-centre hotels with wine estates of the coteaux d’Aix, plus a 10-day itinerary for eternal Provence.',
  },
  reims: {
    labelFr: 'Reims',
    labelEn: 'Reims',
    guideSlugs: ['reims-champagne'],
    itinerarySlugs: ['reims-champagne-week-end'],
    introFr:
      'Reims est la capitale du champagne — Pommery, Veuve Clicquot, Ruinart, Taittinger ouvrent leurs caves à quelques minutes. Notre conciergerie sélectionne les adresses 5★ du centre historique et les escapades week-end avec dégustations privées.',
    introEn:
      'Reims is Champagne’s capital — Pommery, Veuve Clicquot, Ruinart, Taittinger all open their cellars within minutes. Our concierge desk curates the 5-star addresses of the historic centre and the weekend escapes with private tastings.',
  },
  biarritz: {
    labelFr: 'Biarritz',
    labelEn: 'Biarritz',
    guideSlugs: ['biarritz', 'pays-basque'],
    itinerarySlugs: ['biarritz-pays-basque-5-jours'],
    introFr:
      'Biarritz cumule Belle Époque (l’Hôtel du Palais), spots de surf, et la passerelle vers San Sebastián (35 minutes). Notre sélection couvre les Palaces front de mer, les hôtels du centre et l’itinéraire 5 jours côté français + côté espagnol.',
    introEn:
      'Biarritz blends Belle Époque heritage (Hôtel du Palais), legendary surf spots, and the gateway to San Sebastián (35 minutes). Our selection covers seafront Palaces, town-centre hotels and the 5-day Franco-Spanish itinerary.',
  },
};

// ============================================================================
// Card shape — what the fallback renders.
// ============================================================================

export interface RegionHubGuideCard {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly heroImage: string | null;
}

export interface RegionHubItineraryCard {
  readonly slug: string;
  readonly title: string;
  readonly metaDesc: string | null;
  readonly destinationCity: string | null;
  readonly durationMinDays: number;
  readonly durationMaxDays: number | null;
  readonly heroCloudinaryId: string | null;
  readonly heroAlt: string | null;
}

export interface RegionHubContent {
  readonly label: string;
  readonly intro: string;
  readonly guides: readonly RegionHubGuideCard[];
  readonly itineraries: readonly RegionHubItineraryCard[];
}

const GuideRowSchema = z.object({
  slug: z.string(),
  name_fr: z.string(),
  name_en: z.string().nullable(),
  summary_fr: z.string(),
  summary_en: z.string().nullable(),
  hero_image: z.string().nullable(),
});

const ItineraryRowSchema = z.object({
  slug_fr: z.string(),
  title_fr: z.string(),
  title_en: z.string().nullable(),
  meta_desc_fr: z.string().nullable(),
  meta_desc_en: z.string().nullable(),
  destination_city: z.string().nullable(),
  duration_min_days: z.number().int().positive(),
  duration_max_days: z.number().int().positive().nullable(),
  hero_cloudinary_id: z.string().nullable(),
  hero_alt_fr: z.string().nullable(),
  hero_alt_en: z.string().nullable(),
});

async function fetchRegionHubContent(
  regionSlug: HeroRegionSlug,
  locale: SupportedLocale,
): Promise<RegionHubContent | null> {
  const def = REGION_HUB_DEFS[regionSlug];
  if (def === undefined) return null;
  const label = pickByLocale(locale, def.labelFr, def.labelEn);
  const intro = pickByLocale(locale, def.introFr, def.introEn);

  // Empty arrays here are fine — `.in()` with an empty list returns
  // `[]` from PostgREST without an error, but we short-circuit so we
  // don't roundtrip needlessly.
  if (def.guideSlugs.length === 0 && def.itinerarySlugs.length === 0) {
    return { label, intro, guides: [], itineraries: [] };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const [guidesRes, itinerariesRes] = await Promise.all([
      def.guideSlugs.length === 0
        ? Promise.resolve({ data: [] as unknown[], error: null })
        : supabase
            .from('editorial_guides')
            .select('slug, name_fr, name_en, summary_fr, summary_en, hero_image')
            .in('slug', def.guideSlugs as readonly string[])
            .eq('is_published', true),
      def.itinerarySlugs.length === 0
        ? Promise.resolve({ data: [] as unknown[], error: null })
        : supabase
            .from('itineraries')
            .select(
              'slug_fr, title_fr, title_en, meta_desc_fr, meta_desc_en, destination_city, ' +
                'duration_min_days, duration_max_days, hero_cloudinary_id, hero_alt_fr, hero_alt_en',
            )
            .in('slug_fr', def.itinerarySlugs as readonly string[])
            .eq('status', 'published'),
    ]);

    const guides: RegionHubGuideCard[] = [];
    if (guidesRes.error === null && Array.isArray(guidesRes.data)) {
      for (const raw of guidesRes.data) {
        const parsed = GuideRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        guides.push({
          slug: parsed.data.slug,
          name: pickByLocale(
            locale,
            parsed.data.name_fr,
            parsed.data.name_en ?? parsed.data.name_fr,
          ),
          summary: pickByLocale(
            locale,
            parsed.data.summary_fr,
            parsed.data.summary_en ?? parsed.data.summary_fr,
          ),
          heroImage: parsed.data.hero_image,
        });
      }
    }

    const itineraries: RegionHubItineraryCard[] = [];
    if (itinerariesRes.error === null && Array.isArray(itinerariesRes.data)) {
      for (const raw of itinerariesRes.data) {
        const parsed = ItineraryRowSchema.safeParse(raw);
        if (!parsed.success) continue;
        itineraries.push({
          slug: parsed.data.slug_fr,
          title: pickByLocale(
            locale,
            parsed.data.title_fr,
            parsed.data.title_en ?? parsed.data.title_fr,
          ),
          metaDesc: pickByLocale(
            locale,
            parsed.data.meta_desc_fr,
            parsed.data.meta_desc_en ?? parsed.data.meta_desc_fr,
          ),
          destinationCity: parsed.data.destination_city,
          durationMinDays: parsed.data.duration_min_days,
          durationMaxDays: parsed.data.duration_max_days,
          heroCloudinaryId: parsed.data.hero_cloudinary_id,
          heroAlt: pickByLocale(
            locale,
            parsed.data.hero_alt_fr,
            parsed.data.hero_alt_en ?? parsed.data.hero_alt_fr,
          ),
        });
      }
    }

    // Preserve the editorial order declared in REGION_HUB_DEFS rather
    // than the indeterminate order Supabase returns from an `.in()`.
    const orderedGuides = def.guideSlugs
      .map((s) => guides.find((g) => g.slug === s))
      .filter((g): g is RegionHubGuideCard => g !== undefined);
    const orderedItineraries = def.itinerarySlugs
      .map((s) => itineraries.find((i) => i.slug === s))
      .filter((i): i is RegionHubItineraryCard => i !== undefined);

    return {
      label,
      intro,
      guides: orderedGuides,
      itineraries: orderedItineraries,
    };
  } catch (e) {
    console.error(
      '[region-hubs] threw:',
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    return { label, intro, guides: [], itineraries: [] };
  }
}

/**
 * Public reader — cached for 1 h. Tags: `region-hub-<slug>` so editors
 * can `revalidateTag` precisely from a Payload hook when a guide or
 * itinerary publish state changes.
 */
export async function getRegionHubContent(
  regionSlug: HeroRegionSlug,
  locale: SupportedLocale,
): Promise<RegionHubContent | null> {
  const cached = unstable_cache(
    () => fetchRegionHubContent(regionSlug, locale),
    [`region-hub-${regionSlug}-${locale}`],
    {
      revalidate: 3600,
      tags: [`region-hub-${regionSlug}`],
    },
  );
  return cached();
}

/** Type guard usable from page components. */
export function isHeroRegionSlug(value: string): value is HeroRegionSlug {
  return value in REGION_HUB_DEFS || ['cote-d-azur', 'alpes', 'corse', 'loire'].includes(value);
}

/**
 * Type guard restricted to lieu slugs that ship a hub fallback. Use
 * this from the rankings page to decide whether to call
 * `getRegionHubContent` — it filters out hero regions that have
 * published rankings (cote-d-azur, alpes, corse, loire) and would
 * therefore return `null`.
 */
export function hasLieuHubFallback(value: string): boolean {
  return value in REGION_HUB_DEFS;
}
