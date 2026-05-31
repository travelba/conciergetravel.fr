import 'server-only';

/**
 * Editorial **label** facets surfaced as `/label/[facetSlug]` landing
 * pages — distinct from **brands** (`/marque/[brandSlug]`) which are
 * operational chains. A label is a stackable distinction:
 *
 *   - `kind: 'label'` → consortium / certification (R&C, SLH, LHW, Forbes,
 *     Michelin Keys, Atout France Palaces).
 *   - `kind: 'ranking'` → annual editorial classement (T+L World's Best,
 *     Condé Nast Gold List, World's 50 Best).
 *
 * Slugs MUST stay aligned with `facet_slug` values written by migration
 * 0063 so the JSON-LD `Hotel.award[]` strings, the future per-hotel
 * `<TrustSignals>` link badges, and the `/label/<slug>` route resolve to
 * the same canonical URL.
 *
 * The editorial copy lives here (not in `messages/*.json`) because each
 * label carries a precise factual descriptor — surfaced inside the AEO
 * answer block and the FAQ. Translating it through a generic
 * `t('label.descriptor')` would lose the precision.
 *
 * Skill: `seo-technical`, `geo-llm-optimization`, `structured-data-schema-org`.
 * Migration: `packages/db/migrations/0063_hotels_affiliations_complete_backfill.sql`.
 */

export type KnownLabelKind = 'label' | 'ranking';

export interface KnownLabel {
  /** Kebab-case slug — matches `affiliations[].facet_slug` in the DB. */
  readonly slug: string;
  /** Discriminator surfaced in the eyebrow + JSON-LD `award` semantics. */
  readonly kind: KnownLabelKind;
  /** Human-readable label (used in H1, ItemList `name`, breadcrumbs). */
  readonly label: string;
  /** Factual one-liner for AEO + meta description (≤ 25 words). */
  readonly descriptorFr: string;
  readonly descriptorEn: string;
  /** Issuing authority — surfaced in the FAQ "who awards this label?". */
  readonly issuerFr: string;
  readonly issuerEn: string;
  /** Official URL of the awarding body (used for EEAT `sameAs`). */
  readonly officialUrl: string;
}

/**
 * Catalogue of supported label facets — must mirror every distinct
 * `affiliations[].facet_slug` value emitted by migration 0063 for which
 * `kind ∈ {'label', 'ranking'}`. Add a new entry here BEFORE you start
 * ingesting a new label (otherwise the JSON-LD URL points to a 404).
 */
export const KNOWN_LABELS: readonly KnownLabel[] = [
  {
    slug: 'relais-chateaux',
    kind: 'label',
    label: 'Relais & Châteaux',
    descriptorFr:
      "association indépendante fondée en 1954 — 580+ hôtels et restaurants d'auteur dans 65 pays, chartés autour des Cinq C (caractère, courtoisie, calme, charme, cuisine)",
    descriptorEn:
      'independent association founded in 1954 — 580+ owner-led hotels and restaurants in 65 countries, organised around the Five Cs (character, courtesy, calm, charm, cuisine)',
    issuerFr: 'Relais & Châteaux (association)',
    issuerEn: 'Relais & Châteaux (association)',
    officialUrl: 'https://www.relaischateaux.com',
  },
  {
    slug: 'small-luxury-hotels',
    kind: 'label',
    label: 'Small Luxury Hotels of the World',
    descriptorFr:
      "consortium fondé en 1991 — 560+ hôtels indépendants de petite taille (moins de 100 chambres) dans 90 pays, sélectionnés sur l'expérience et le caractère",
    descriptorEn:
      'consortium founded in 1991 — 560+ small independent hotels (fewer than 100 rooms) in 90 countries, selected on experience and character',
    issuerFr: 'Small Luxury Hotels of the World (SLH)',
    issuerEn: 'Small Luxury Hotels of the World (SLH)',
    officialUrl: 'https://www.slh.com',
  },
  {
    slug: 'leading-hotels-of-the-world',
    kind: 'label',
    label: 'The Leading Hotels of the World',
    descriptorFr:
      "collection fondée en 1928 (Lucerne) — 460+ hôtels indépendants distingués sur le service, l'authenticité et l'expérience d'auteur, présents dans 80 pays",
    descriptorEn:
      'collection founded in 1928 in Lucerne — 460+ independent hotels recognised for service, authenticity and signature experience across 80 countries',
    issuerFr: 'The Leading Hotels of the World (LHW)',
    issuerEn: 'The Leading Hotels of the World (LHW)',
    officialUrl: 'https://www.lhw.com',
  },
  {
    slug: 'forbes-5-star',
    kind: 'label',
    label: 'Forbes Travel Guide Five-Star',
    descriptorFr:
      'distinction décernée depuis 1958 par Forbes Travel Guide — audits anonymes Forbes sur 900+ standards de service, renouvelés chaque année',
    descriptorEn:
      'distinction awarded since 1958 by Forbes Travel Guide — anonymous Forbes audits across 900+ service standards, renewed yearly',
    issuerFr: 'Forbes Travel Guide',
    issuerEn: 'Forbes Travel Guide',
    officialUrl: 'https://www.forbestravelguide.com',
  },
  {
    slug: 'michelin-3-keys',
    kind: 'label',
    label: 'Michelin Keys — Three Keys',
    descriptorFr:
      "distinction lancée en 2024 par le Guide Michelin — Trois Clés signalent un séjour d'exception, comparable à Trois Étoiles dans l'univers gastronomique",
    descriptorEn:
      'distinction launched in 2024 by the Michelin Guide — Three Keys signal an exceptional stay, comparable to Three Stars in the gastronomy world',
    issuerFr: 'Guide Michelin',
    issuerEn: 'Michelin Guide',
    officialUrl: 'https://guide.michelin.com',
  },
  {
    slug: 'palace-atout-france',
    kind: 'label',
    label: 'Palace — distinction Atout France',
    descriptorFr:
      'distinction ministérielle française créée en 2010 par Atout France — 31 Palaces actuellement, classification au-dessus des 5★ basée sur architecture, service et histoire',
    descriptorEn:
      'French ministerial distinction created in 2010 by Atout France — 31 current Palaces, classification above 5★ based on architecture, service and history',
    issuerFr: 'Atout France (ministère délégué chargé du Tourisme)',
    issuerEn: 'Atout France (French Ministry for Tourism)',
    officialUrl: 'https://www.atout-france.fr',
  },
  // ── Rankings ──────────────────────────────────────────────────────────
  {
    slug: 'world-50-best',
    kind: 'ranking',
    label: "The World's 50 Best Hotels",
    descriptorFr:
      'classement annuel publié depuis 2023 par William Reed Business Media — votes de 600+ experts internationaux (hôteliers, journalistes, influenceurs)',
    descriptorEn:
      'annual ranking published since 2023 by William Reed Business Media — votes from 600+ international experts (hoteliers, journalists, influencers)',
    issuerFr: '50 Best (William Reed Business Media)',
    issuerEn: '50 Best (William Reed Business Media)',
    officialUrl: 'https://www.theworlds50best.com/hotels',
  },
  {
    slug: 'travel-leisure-worlds-best',
    kind: 'ranking',
    label: "Travel + Leisure World's Best Awards",
    descriptorFr:
      'classement annuel publié depuis 1995 par Travel + Leisure — voté chaque année par les lecteurs du magazine américain, plus de 180 000 réponses en 2024',
    descriptorEn:
      'annual ranking published since 1995 by Travel + Leisure — voted by the American magazine readers, more than 180,000 responses in 2024',
    issuerFr: 'Travel + Leisure (Dotdash Meredith)',
    issuerEn: 'Travel + Leisure (Dotdash Meredith)',
    officialUrl: 'https://www.travelandleisure.com/worlds-best',
  },
  {
    slug: 'conde-nast-gold-list',
    kind: 'ranking',
    label: 'Condé Nast Gold List',
    descriptorFr:
      'classement annuel publié depuis 1995 par Condé Nast Traveler — sélection éditoriale des hôtels favoris des journalistes et de la rédaction',
    descriptorEn:
      'annual ranking published since 1995 by Condé Nast Traveler — editorial selection of the journalists and editors favourite hotels',
    issuerFr: 'Condé Nast Traveler',
    issuerEn: 'Condé Nast Traveler',
    officialUrl: 'https://www.cntraveler.com/gallery/gold-list',
  },
];

/** Lookup helper — O(n) but `KNOWN_LABELS` is tiny (~10 entries). */
export function findKnownLabel(slug: string): KnownLabel | null {
  return KNOWN_LABELS.find((l) => l.slug === slug) ?? null;
}
