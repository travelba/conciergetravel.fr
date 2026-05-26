/**
 * `MemberProgram` JSON-LD builder (Schema.org / Le Concierge Club).
 *
 * Schema.org defines `MemberProgram` (https://schema.org/MemberProgram) as the
 * canonical envelope for membership / loyalty programs. Each tier is a
 * `MemberProgramTier` (https://schema.org/MemberProgramTier).
 *
 * We emit one `MemberProgram` per hotel page (Schema.org allows it via
 * `Organization.hasMemberProgram` and surfaces as a `mentions`-style link
 * inside the `Hotel` graph). It tells crawlers + LLM ingestion pipelines
 * (ChatGPT Search, Perplexity, Bing Chat) that the loyalty program exists,
 * what perks each tier carries, and where the canonical landing page lives —
 * without polluting the Hotel envelope with marketing copy.
 *
 * `tierBenefits` carries the free-form perk catalogue (one short string per
 * benefit). When the price is set (Prestige), `tierBenefitsList` would be
 * a stronger node — kept for Phase 6 once we ship the priced offer.
 *
 * `schema-dts` predates `MemberProgram` so we hand-roll a small structural
 * type. The shape matches the Schema.org spec verbatim.
 */

export interface MemberProgramTierInput {
  /** Internal tier identifier (e.g. `club`, `prestige`) — surfaced as the URL fragment. */
  readonly id: string;
  /** Editorial label ("Le Concierge Club", "Le Concierge Club Prestige"). */
  readonly name: string;
  /** Short description (60-140 chars) — surfaces in AI overview cards. */
  readonly description: string;
  /**
   * Whether this tier requires a paid subscription. `false` = free signup.
   * `true` = paid tier (Schema.org `requiresSubscription`).
   */
  readonly requiresSubscription: boolean;
  /** Optional annual price in EUR (only set for paid tiers, currently `null` in Phase 1). */
  readonly annualPriceEur?: number;
  /**
   * Free-form perk catalogue — one short string per benefit. Editorial copy
   * stays short (≤ 120 chars per entry) so the JSON-LD envelope stays compact.
   */
  readonly benefits: readonly string[];
}

export interface MemberProgramInput {
  /** Canonical program name ("Le Concierge Club"). */
  readonly name: string;
  /** Short program description (60-160 chars) — surfaces in AI overview cards. */
  readonly description: string;
  /** Canonical landing page URL (absolute). */
  readonly url: string;
  /**
   * Hosting organisation — typically `{ name: 'MyConciergeHotel.com',
   * url: 'https://myconciergehotel.com' }`. Required by Schema.org so
   * crawlers can attribute the program to a known legal entity.
   */
  readonly hostingOrganization: { readonly name: string; readonly url: string };
  /** Available tiers, in display order (free → paid). */
  readonly tiers: readonly MemberProgramTierInput[];
}

type MemberProgramTierNode = {
  '@type': 'MemberProgramTier';
  '@id': string;
  name: string;
  description: string;
  requiresSubscription: boolean;
  /** Loose array (Schema.org doesn't define a strict shape here). */
  tierBenefits?: readonly string[];
  /** Membership price as a PriceSpecification (only emitted when > 0). */
  priceSpecification?: {
    '@type': 'PriceSpecification';
    price: number;
    priceCurrency: 'EUR';
    /** ISO 8601 duration — yearly = `P1Y`. */
    eligibleDuration: { '@type': 'QuantitativeValue'; value: 1; unitCode: 'ANN' };
  };
};

export type MemberProgramNode = {
  '@type': 'MemberProgram';
  '@id': string;
  name: string;
  description: string;
  url: string;
  hostingOrganization: { '@type': 'Organization'; name: string; url: string };
  hasTiers: readonly MemberProgramTierNode[];
};

/**
 * Build a `MemberProgram` JSON-LD node.
 *
 * Defensive contract:
 *   - Empty perks lists are dropped (the tier still surfaces, perks just don't render).
 *   - Negative / non-finite prices are silently dropped (no price emission).
 *   - The URL is NOT re-validated — callers must pass an absolute HTTPS URL.
 */
export const memberProgramJsonLd = (input: MemberProgramInput): MemberProgramNode => {
  const tiers: MemberProgramTierNode[] = input.tiers.map((tier) => {
    const node: MemberProgramTierNode = {
      '@type': 'MemberProgramTier',
      '@id': `${input.url}#${tier.id}`,
      name: tier.name,
      description: tier.description,
      requiresSubscription: tier.requiresSubscription,
    };
    const cleanedBenefits = tier.benefits
      .map((b) => b.trim())
      .filter((b) => b.length > 0 && b.length <= 200);
    if (cleanedBenefits.length > 0) {
      node.tierBenefits = cleanedBenefits;
    }
    if (
      tier.annualPriceEur !== undefined &&
      Number.isFinite(tier.annualPriceEur) &&
      tier.annualPriceEur > 0
    ) {
      node.priceSpecification = {
        '@type': 'PriceSpecification',
        price: tier.annualPriceEur,
        priceCurrency: 'EUR',
        eligibleDuration: { '@type': 'QuantitativeValue', value: 1, unitCode: 'ANN' },
      };
    }
    return node;
  });

  return {
    '@type': 'MemberProgram',
    '@id': input.url,
    name: input.name,
    description: input.description,
    url: input.url,
    hostingOrganization: {
      '@type': 'Organization',
      name: input.hostingOrganization.name,
      url: input.hostingOrganization.url,
    },
    hasTiers: tiers,
  };
};
