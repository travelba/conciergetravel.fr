import { describe, expect, it } from 'vitest';

import { memberProgramJsonLd } from './member-program';

const baseInput = {
  name: 'Le Concierge Club',
  description:
    'Programme de fidélité MyConciergeHotel.com — adhésion gratuite, attentions Concierge à chaque séjour.',
  url: 'https://myconciergehotel.com/fr/le-concierge-club',
  hostingOrganization: {
    name: 'MyConciergeHotel.com',
    url: 'https://myconciergehotel.com',
  },
};

describe('memberProgramJsonLd', () => {
  it('emits free tier without priceSpecification', () => {
    const node = memberProgramJsonLd({
      ...baseInput,
      tiers: [
        {
          id: 'club',
          name: 'Le Concierge Club',
          description: 'Tier gratuit avec attentions Concierge sur les hôtels éligibles.',
          requiresSubscription: false,
          benefits: ['Petit-déjeuner offert', 'Late check-out 14h', 'Crédit hôtel 50€'],
        },
      ],
    });
    expect(node['@type']).toBe('MemberProgram');
    expect(node.hasTiers).toHaveLength(1);
    expect(node.hasTiers[0]?.requiresSubscription).toBe(false);
    expect(node.hasTiers[0]?.priceSpecification).toBeUndefined();
    expect(node.hasTiers[0]?.tierBenefits).toEqual([
      'Petit-déjeuner offert',
      'Late check-out 14h',
      'Crédit hôtel 50€',
    ]);
    expect(node.hasTiers[0]?.['@id']).toBe(
      'https://myconciergehotel.com/fr/le-concierge-club#club',
    );
  });

  it('emits priceSpecification for paid tier with positive annualPriceEur', () => {
    const node = memberProgramJsonLd({
      ...baseInput,
      tiers: [
        {
          id: 'prestige',
          name: 'Le Concierge Club Prestige',
          description: 'Tier payant — €99/an, surclassements confirmés et transfert aéroport.',
          requiresSubscription: true,
          annualPriceEur: 99,
          benefits: ['Surclassement confirmé', 'Transfert aéroport offert'],
        },
      ],
    });
    expect(node.hasTiers[0]?.priceSpecification).toEqual({
      '@type': 'PriceSpecification',
      price: 99,
      priceCurrency: 'EUR',
      eligibleDuration: { '@type': 'QuantitativeValue', value: 1, unitCode: 'ANN' },
    });
  });

  it('drops zero / negative / non-finite prices', () => {
    const node = memberProgramJsonLd({
      ...baseInput,
      tiers: [
        {
          id: 'prestige',
          name: 'Le Concierge Club Prestige',
          description: 'desc',
          requiresSubscription: true,
          annualPriceEur: 0,
          benefits: ['perk'],
        },
        {
          id: 'broken',
          name: 'broken',
          description: 'desc',
          requiresSubscription: true,
          annualPriceEur: -1,
          benefits: ['perk'],
        },
        {
          id: 'nan',
          name: 'nan',
          description: 'desc',
          requiresSubscription: true,
          annualPriceEur: Number.NaN,
          benefits: ['perk'],
        },
      ],
    });
    for (const tier of node.hasTiers) {
      expect(tier.priceSpecification).toBeUndefined();
    }
  });

  it('drops empty / whitespace-only / too-long perk entries', () => {
    const node = memberProgramJsonLd({
      ...baseInput,
      tiers: [
        {
          id: 'club',
          name: 'Le Concierge Club',
          description: 'desc',
          requiresSubscription: false,
          benefits: ['', '   ', 'Real perk', 'x'.repeat(220)],
        },
      ],
    });
    expect(node.hasTiers[0]?.tierBenefits).toEqual(['Real perk']);
  });

  it('drops the tierBenefits field entirely when no perks survive sanitisation', () => {
    const node = memberProgramJsonLd({
      ...baseInput,
      tiers: [
        {
          id: 'club',
          name: 'Le Concierge Club',
          description: 'desc',
          requiresSubscription: false,
          benefits: ['', '   '],
        },
      ],
    });
    expect(node.hasTiers[0]?.tierBenefits).toBeUndefined();
  });
});
