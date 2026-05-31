/**
 * Parent-group mapping + domain whitelists/blocklists for the photo
 * pipeline.
 *
 * This module is the **single source of truth** for:
 *   - which "consortium / chain / parent group" a hotel belongs to
 *     (used to scope Tavily searches to the right press-kit CDN)
 *   - which CDNs are legitimate sources of official press-kit images
 *     (HOSTNAME_WHITELIST_GLOBAL — Contentful, Akamai, Cloudfront…)
 *   - which CDNs are NEVER official sources per
 *     `.cursor/rules/photo-quality.mdc` (HOSTNAME_BLOCKLIST_GLOBAL —
 *     TripAdvisor, Booking, Pinterest…)
 *
 * `discover-press-kit-images.ts`, `upload-press-kit-images.ts` and
 * `audit-photo-readiness.ts` all import from here so the rules stay
 * coherent and a single maintenance edit propagates everywhere.
 *
 * See `.cursor/skills/photo-pipeline/SKILL.md` §Tavily press-kit
 * discovery for the rationale on parent-group CDN matters.
 */

// ─── Parent groups (enum-like) ─────────────────────────────────────────────

/**
 * Closed enumeration of the groups we know how to source from. `null`
 * means "independent / boutique / palace local" — Tavily falls back
 * to the hotel's own `official_url` only.
 */
export type ParentGroup =
  | 'oetker'
  | 'cheval_blanc'
  | 'aman'
  | 'four_seasons'
  | 'mandarin_oriental'
  | 'belmond'
  | 'six_senses'
  | 'como'
  | 'rosewood'
  | 'bulgari'
  | 'relais_chateaux'
  | 'lhw'
  | 'hyatt' // Park Hyatt, Andaz, Alila, Grand Hyatt, Miraval…
  | 'marriott_lux' // Ritz-Carlton, St. Regis, Edition, W, Bulgari sub-brands…
  | 'ihg_lux' // Six Senses (since 2022), Regent, InterContinental
  | 'accor_lux' // Raffles, Fairmont, Sofitel Legend, Banyan Tree partners
  | 'auberge_resorts'
  | 'oberoi'
  | 'anantara';

// ─── Parent group → trusted source domains ─────────────────────────────────

/**
 * Press-kit + DAM domains by parent group. Tavily searches are scoped
 * to these domains so we crawl the consortium-level press kit (which
 * is consistently richer than the individual hotel's marketing site).
 *
 * Order matters: the first domain in the list is the primary press-kit
 * site; subsequent ones are fallbacks (sub-brands, regional sites).
 */
export const PARENT_DOMAINS_BY_GROUP: Readonly<Record<ParentGroup, readonly string[]>> = {
  oetker: ['oetkercollection.com', 'oetkerhotels.com'],
  cheval_blanc: ['chevalblanc.com'],
  aman: ['aman.com'],
  four_seasons: ['fourseasons.com'],
  mandarin_oriental: ['mandarinoriental.com'],
  belmond: ['belmond.com'],
  six_senses: ['sixsenses.com'],
  como: ['comohotels.com'],
  rosewood: ['rosewoodhotels.com'],
  bulgari: ['bulgarihotels.com'],
  relais_chateaux: ['relaischateaux.com'],
  lhw: ['lhw.com', 'lhw.fr'],
  hyatt: ['hyatt.com', 'park.hyatt.com', 'andaz.hyatt.com', 'alilahotels.com'],
  marriott_lux: [
    'ritzcarlton.com',
    'stregis.com',
    'editionhotels.com',
    'marriott.com',
    'luxurycollection.com',
    'jwmarriott.com',
  ],
  ihg_lux: ['ihg.com', 'regenthotels.com', 'intercontinental.com'],
  accor_lux: ['raffles.com', 'fairmont.com', 'sofitel.accor.com', 'all.accor.com'],
  auberge_resorts: ['aubergeresorts.com'],
  oberoi: ['oberoihotels.com'],
  anantara: ['anantara.com'],
};

// ─── Detection rules ───────────────────────────────────────────────────────

/**
 * Detect parent group from the hotel's `official_url` hostname.
 * Returns `null` when no rule matches (independent property).
 */
function detectFromOfficialUrl(officialUrl: string | null): ParentGroup | null {
  if (!officialUrl) return null;
  let host: string;
  try {
    host = new URL(officialUrl).hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    return null;
  }

  // Rules ordered by specificity: more specific sub-brands BEFORE the
  // parent group (Andaz before Hyatt).
  if (host.endsWith('aman.com')) return 'aman';
  if (host.endsWith('chevalblanc.com')) return 'cheval_blanc';
  if (host.endsWith('oetkercollection.com') || host.endsWith('oetkerhotels.com')) return 'oetker';
  if (host.endsWith('fourseasons.com')) return 'four_seasons';
  if (host.endsWith('mandarinoriental.com')) return 'mandarin_oriental';
  if (host.endsWith('belmond.com')) return 'belmond';
  if (host.endsWith('sixsenses.com')) return 'six_senses';
  if (host.endsWith('comohotels.com')) return 'como';
  if (host.endsWith('rosewoodhotels.com')) return 'rosewood';
  if (host.endsWith('bulgarihotels.com')) return 'bulgari';
  if (host.endsWith('relaischateaux.com')) return 'relais_chateaux';
  if (host.endsWith('lhw.com') || host.endsWith('lhw.fr')) return 'lhw';
  if (host.endsWith('aubergeresorts.com')) return 'auberge_resorts';
  if (host.endsWith('oberoihotels.com')) return 'oberoi';
  if (host.endsWith('anantara.com')) return 'anantara';

  // Hyatt umbrella (covers Park Hyatt, Andaz, Alila, Grand Hyatt, Miraval, Thompson, Hyatt Centric…)
  if (host.endsWith('hyatt.com') || host.endsWith('alilahotels.com')) return 'hyatt';

  // Marriott Luxury portfolio (Ritz-Carlton, St. Regis, Edition, W, Luxury Collection, JW Marriott)
  if (host.endsWith('ritzcarlton.com')) return 'marriott_lux';
  if (host.endsWith('stregis.com')) return 'marriott_lux';
  if (host.endsWith('editionhotels.com')) return 'marriott_lux';
  if (host.endsWith('luxurycollection.com')) return 'marriott_lux';
  if (host.endsWith('jwmarriott.com')) return 'marriott_lux';
  if (host.endsWith('marriott.com')) return 'marriott_lux';

  // IHG Luxury (Six Senses since 2022, Regent, InterContinental)
  if (host.endsWith('regenthotels.com')) return 'ihg_lux';
  if (host.endsWith('intercontinental.com')) return 'ihg_lux';
  if (host.endsWith('ihg.com')) return 'ihg_lux';

  // Accor Luxury (Raffles, Fairmont, Sofitel Legend)
  if (host.endsWith('raffles.com')) return 'accor_lux';
  if (host.endsWith('fairmont.com')) return 'accor_lux';
  if (host.endsWith('sofitel.accor.com')) return 'accor_lux';
  if (host.endsWith('all.accor.com')) return 'accor_lux';

  return null;
}

/**
 * Map well-known `hotels.luxury_tier` values to a parent group when
 * the `official_url` detection fails (or returns a thin domain).
 *
 * Note: `relais_chateaux` and `oetker_collection` ARE explicit
 * groups; `world_50_best`, `cn_gold_list`, `michelin_keys` are
 * curation lists, not groups — they default to `null` here and rely
 * on the official_url path.
 */
function detectFromLuxuryTier(luxuryTier: string | null): ParentGroup | null {
  if (!luxuryTier) return null;
  switch (luxuryTier) {
    case 'oetker_collection':
      return 'oetker';
    case 'cheval_blanc':
      return 'cheval_blanc';
    case 'relais_chateaux':
      return 'relais_chateaux';
    default:
      return null;
  }
}

/**
 * Compute the parent group for a hotel from all available signals.
 * Precedence: `official_url` > `luxury_tier` > slug overrides.
 *
 * `slugOverrides` lets callers (or future migrations) pin a small
 * number of properties that the heuristic can't resolve from their
 * URL alone (e.g. a hotel whose `official_url` points at a third-party
 * booking site instead of the group's DAM).
 */
export function inferParentGroup(input: {
  readonly slug: string;
  readonly officialUrl: string | null;
  readonly luxuryTier: string | null;
  readonly slugOverrides?: Readonly<Record<string, ParentGroup>>;
}): ParentGroup | null {
  const override = input.slugOverrides?.[input.slug];
  if (override) return override;

  const fromUrl = detectFromOfficialUrl(input.officialUrl);
  if (fromUrl) return fromUrl;

  const fromTier = detectFromLuxuryTier(input.luxuryTier);
  if (fromTier) return fromTier;

  return null;
}

/**
 * Per-slug parent group pins. Used when the heuristic gets the wrong
 * answer (rare). Keep this map small — every entry is a maintenance
 * debt.
 */
export const SLUG_PARENT_GROUP_OVERRIDES: Readonly<Record<string, ParentGroup>> = {
  // Akelarre is Relais & Châteaux but its `luxury_tier` is
  // `cn_gold_list` (Condé Nast list, not a group) and its
  // `official_url` is `akelarre.net` (its own thin site) — pin it.
  akelarre: 'relais_chateaux',
};

/**
 * Detect a corporate-root `official_url` — a URL whose hostname matches
 * a parent group's domain (e.g. `mandarinoriental.com`,
 * `sixsenses.com`, `fourseasons.com`) AND whose path is either empty,
 * `/`, or a locale-only prefix (`/en`, `/fr`).
 *
 * Why this matters: the 2026-05-31 Tier-A pilot uploaded photos of
 * Mandarin Oriental London onto `mandarin-oriental-cristallo-cortina`
 * because the latter's `official_url` was `https://www.mandarinoriental.com/`
 * — Tavily was free to crawl every Mandarin property worldwide and
 * Vision had no way to detect the mismatch. The 4 contaminated hotels
 * had to be SQL-reverted. See `photo-pipeline` skill §Critical
 * learnings #6 for the full incident report.
 *
 * Use this as a guard in any script that consumes `official_url` as a
 * Tavily seed: if `true`, drop the URL and rely on the parent-group
 * DAM fallback (still scoped to the same domain, but the discover
 * script can mark the hotel as "needs editorial review" instead of
 * over-trusting).
 */
/**
 * Multi-property corporate path fragments that NEVER identify a
 * single property. Even with a non-trivial path, a URL like
 * `sixsenses.com/en/corporate/media-center/press-releases/2025/...`
 * is a corporate aggregator: Tavily crawls it and mixes images from
 * every property in the chain. Discovered 2026-05-31 during the Tier
 * A re-launch: Six Senses Bangkok showed Yao Noi karst islands.
 */
const CORPORATE_PATH_FRAGMENTS: readonly string[] = [
  '/corporate/',
  '/press-releases/',
  '/press-release/',
  '/media-center/',
  '/media-centre/',
  '/news/',
  '/new-openings/',
  '/newsroom/',
  '/awards/',
  '/about/',
  '/about-us/',
  '/sustainability/',
  '/careers/',
];

export function isCorporateRootUrl(officialUrl: string | null): boolean {
  if (!officialUrl) return false;
  let parsed: URL;
  try {
    parsed = new URL(officialUrl);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./u, '');
  const cleanPath = parsed.pathname.replace(/\/$/u, '');

  // Check 1: hostname is a known parent group.
  let hostIsParent = false;
  for (const domains of Object.values(PARENT_DOMAINS_BY_GROUP)) {
    for (const d of domains) {
      if (host === d || host.endsWith(`.${d}`)) {
        hostIsParent = true;
        break;
      }
    }
    if (hostIsParent) break;
  }
  if (!hostIsParent) return false;

  // Check 2a: trivial path on a parent domain = pure corporate root.
  const pathIsRootOrLocaleOnly =
    cleanPath === '' || /^\/[a-z]{2}(?:[-_][a-z]{2})?$/iu.test(cleanPath);
  if (pathIsRootOrLocaleOnly) return true;

  // Check 2b: path contains a corporate aggregator fragment.
  // E.g. /en/corporate/media-center/press-releases/2025/<hotel>-announcement
  // → Tavily crawls the press kit and mixes other-property images.
  const pathLower = `${parsed.pathname.toLowerCase()}/`;
  for (const fragment of CORPORATE_PATH_FRAGMENTS) {
    if (pathLower.includes(fragment)) return true;
  }

  return false;
}

/**
 * Convenience: full list of trusted domains for a hotel (own + parent
 * group fallback). Empty when no parent group can be inferred AND no
 * official_url exists — in that case the caller should skip Tavily
 * (no legal sourcing possible).
 *
 * **Corporate-root protection**: if the hotel's `official_url` is
 * detected as a corporate root (per `isCorporateRootUrl`), the URL's
 * hostname is NOT added to the trusted set — the parent-group
 * fallback handles the same domain anyway, but the caller can now
 * surface a warning and skip the hotel for the auto-batch.
 */
export function trustedDomainsForHotel(input: {
  readonly slug: string;
  readonly officialUrl: string | null;
  readonly luxuryTier: string | null;
}): readonly string[] {
  const domains = new Set<string>();
  if (input.officialUrl && !isCorporateRootUrl(input.officialUrl)) {
    try {
      domains.add(new URL(input.officialUrl).hostname.toLowerCase().replace(/^www\./u, ''));
    } catch {
      // skip malformed URL
    }
  }
  const group = inferParentGroup({
    slug: input.slug,
    officialUrl: input.officialUrl,
    luxuryTier: input.luxuryTier,
    slugOverrides: SLUG_PARENT_GROUP_OVERRIDES,
  });
  if (group) {
    for (const d of PARENT_DOMAINS_BY_GROUP[group]) {
      domains.add(d);
    }
  }
  return [...domains];
}

// ─── Hostname blocklist (NEVER official sources) ──────────────────────────

/**
 * Hard blocklist — these domains are NEVER legitimate sources of
 * hotel press-kit images per `.cursor/rules/photo-quality.mdc`.
 * Substring-matched against the image URL hostname.
 */
export const HOSTNAME_BLOCKLIST_GLOBAL: readonly string[] = [
  // OTA + meta-search aggregators (substring match catches all TLDs:
  // tripadvisor.in / .ch / .ca / .com.au etc. via 'tripadvisor.').
  'tripadvisor.',
  'booking.com',
  'bstatic.com', // Booking CDN
  'expedia.',
  'hotels.com',
  'hotelscdn.com',
  'agoda.',
  'agoda.net',
  'kayak.',
  'trivago.',
  'priceline.com',
  'trip.com', // Trip.com (Ctrip)
  'us.trip.com',
  'baike.baidu.com', // Baidu Wikipedia clones
  // Travel magazines / industry sites that often top Tavily but
  // never represent the hotel's own voice.
  'forbestravelguide.com',
  'travelagentcentral.com',
  // User-generated social CDNs
  'pinimg.com',
  'pinterest.',
  'fbcdn.net',
  'cdninstagram.com',
  'instagram.com',
  'facebook.com',
  'twimg.com',
  'tiktokcdn.com',
];

// ─── Hostname whitelist (trusted CDNs) ────────────────────────────────────

/**
 * CDNs that we know host legitimate press-kit images for one or more
 * parent groups. Used by `upload-press-kit-images.ts` to second-guess
 * Tavily's `includeDomains` filter — even if Tavily returned the URL,
 * we re-check the image hostname is one we trust to commit to
 * Cloudinary + Supabase.
 *
 * Substring-matched. Order is alphabetical for diffability.
 */
export const HOSTNAME_WHITELIST_GLOBAL: readonly string[] = [
  // Generic CDNs used by the hotel industry
  'akamaihd.net',
  'akamaized.net',
  'amazonaws.com', // S3 buckets — usually OK for corporate DAMs
  'cloudfront.net',
  'cloudinary.com',
  'imgix.net',
  // Headless CMS image CDNs
  'ctfassets.net', // Contentful (Oetker, many others)
  'images.ctfassets.net',
  'images.eu.ctfassets.net',
  'cdn.contentful.com',
  'sanity.io',
  'cdn.sanity.io',
  'prismic.io',
  'images.prismic.io',
  'prismic.cloud',
  // Site-builder hosted images (often legitimate when on official_url)
  'static.wixstatic.com',
  'squarespace-cdn.com',
  'images.squarespace-cdn.com',
  // Parent-group CDNs
  'assets.hyatt.com',
  'cache.marriott.com',
  'marriottcontent.com',
  'static.fourseasons.com',
  'aman.com',
  'images.relaischateaux.com',
  'media.relaischateaux.com',
  'oetkercollection.com',
  'images.oetkercollection.com',
  'chevalblanc.com',
  'belmond.com',
  'cdn.belmond.com',
  'sixsenses.com',
  'cdn.sixsenses.com',
  'mandarinoriental.com',
  'photos.mandarinoriental.com',
  'rosewoodhotels.com',
  'comohotels.com',
  'bulgarihotels.com',
  'aubergeresorts.com',
  'oberoihotels.com',
  'anantara.com',
];

// ─── Quick checks ──────────────────────────────────────────────────────────

export function isBlocklistedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTNAME_BLOCKLIST_GLOBAL.some((b) => h.includes(b));
}

export function isWhitelistedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return HOSTNAME_WHITELIST_GLOBAL.some((w) => h.includes(w));
}

/**
 * Audit-friendly: returns the count of `gallery_images` rows whose
 * `public_id` looks like an external hotlink to a blocklisted CDN.
 * (Cloudinary `public_id` is always slug-shaped — `cct/hotels/...`
 * — so any URL-shaped row is suspicious by definition.)
 */
export function countSuspiciousGalleryRows(
  gallery: ReadonlyArray<{ readonly public_id?: unknown }>,
): number {
  let count = 0;
  for (const row of gallery) {
    const pid = row.public_id;
    if (typeof pid !== 'string') continue;
    if (pid.startsWith('http://') || pid.startsWith('https://')) {
      if (isBlocklistedHostname(pid)) count += 1;
    }
  }
  return count;
}
