import { describe, expect, it } from 'vitest';

import {
  MIN_PUBLISHABLE_ENTRIES,
  rankingAdmitsEmptySelection,
  rankingProseLeaks,
  resolveEffectivePublish,
} from './push-ranking-v2.js';

function makeProse(overrides: Partial<Parameters<typeof rankingProseLeaks>[0]> = {}) {
  return {
    intro_fr: 'Notre sélection des plus belles adresses de la région.',
    intro_en: 'Our selection of the finest addresses in the region.',
    outro_fr: 'Réservez via notre conciergerie pour un accès privilégié.',
    outro_en: 'Book through our concierge desk for privileged access.',
    factual_summary_fr: 'Classement éditorial de 8 hôtels d’exception.',
    factual_summary_en: 'Editorial ranking of 8 extraordinary hotels.',
    editorial_sections: [
      {
        title_fr: 'Pourquoi cette sélection',
        title_en: 'Why this selection',
        body_fr: 'Chaque adresse a été visitée par notre conciergerie.',
        body_en: 'Each address was visited by our concierge desk.',
      },
    ],
    faq: [
      {
        question_fr: 'Comment réserver ?',
        question_en: 'How to book?',
        answer_fr: 'Via notre conciergerie, sans supplément.',
        answer_en: 'Through our concierge desk, no markup.',
      },
    ],
    ...overrides,
  };
}

describe('resolveEffectivePublish — zero/thin ranking publish gate', () => {
  it('blocks publishing an empty ranking (the "0 hôtels" prod incident)', () => {
    expect(resolveEffectivePublish(true, 0)).toBe(false);
  });

  it('blocks publishing a thin ranking below the floor', () => {
    expect(resolveEffectivePublish(true, 1)).toBe(false);
    expect(resolveEffectivePublish(true, MIN_PUBLISHABLE_ENTRIES - 1)).toBe(false);
  });

  it('allows publishing at or above the floor', () => {
    expect(resolveEffectivePublish(true, MIN_PUBLISHABLE_ENTRIES)).toBe(true);
    expect(resolveEffectivePublish(true, 10)).toBe(true);
  });

  it('never publishes when the caller did not ask to, regardless of count', () => {
    expect(resolveEffectivePublish(false, 50)).toBe(false);
    expect(resolveEffectivePublish(false, 0)).toBe(false);
  });

  it('honours a custom floor (deliberate small curated ranking)', () => {
    expect(resolveEffectivePublish(true, 1, 1)).toBe(true);
    expect(resolveEffectivePublish(true, 2, 5)).toBe(false);
  });

  it('default floor matches the documented ≥3 eligibility policy', () => {
    expect(MIN_PUBLISHABLE_ENTRIES).toBe(3);
  });
});

describe('rankingProseLeaks — scaffolding leak gate', () => {
  it('passes clean editorial prose', () => {
    expect(rankingProseLeaks(makeProse())).toBe(false);
  });

  it('catches a leak in the intro', () => {
    expect(rankingProseLeaks(makeProse({ intro_fr: 'Le brief confirme une sélection.' }))).toBe(
      true,
    );
  });

  it('catches a leak in a section body', () => {
    const prose = makeProse({
      editorial_sections: [
        {
          title_fr: 'Contexte',
          title_en: 'Context',
          body_fr: 'Cette rubrique reste en attente de vérification.',
          body_en: 'Pending verification.',
        },
      ],
    });
    expect(rankingProseLeaks(prose)).toBe(true);
  });

  it('catches a leak in a FAQ answer (EN)', () => {
    const prose = makeProse({
      faq: [
        {
          question_fr: 'Détails ?',
          question_en: 'Details?',
          answer_fr: 'Oui.',
          answer_en: 'The dossier confirms the opening year.',
        },
      ],
    });
    expect(rankingProseLeaks(prose)).toBe(true);
  });

  it('catches the "0 hôtels" scaffold factual summary class via leak markers', () => {
    // AUTO_DRAFT / niveau de confiance etc. — the stored scaffold summaries.
    expect(rankingProseLeaks(makeProse({ factual_summary_fr: 'AUTO_DRAFT placeholder' }))).toBe(
      true,
    );
  });
});

describe('rankingAdmitsEmptySelection — empty/off-theme summary gate', () => {
  it('flags the real 2026-06-26 incident summaries', () => {
    expect(
      rankingAdmitsEmptySelection(
        'Classement éditorial de 0 hôtels à la montagne à Bordeaux, 2026 : aucune adresse de montagne, cluster urbain, sélection à réorienter.',
        '',
      ),
    ).toBe(true);
    expect(
      rankingAdmitsEmptySelection(
        'Sélection éditoriale de 4 hôtels en bord de mer à Champs-Élysées, 2026 : aucune adresse côtière, Paris 8e.',
        '',
      ),
    ).toBe(true);
    expect(
      rankingAdmitsEmptySelection(
        'Sélection éditoriale de 0 hôtels à la montagne en Île-de-France, 2026 : sélection vide.',
        '',
      ),
    ).toBe(true);
  });

  it('flags an EN empty admission', () => {
    expect(
      rankingAdmitsEmptySelection('', 'Editorial selection of 0 hotels in the mountains.'),
    ).toBe(true);
  });

  it('does NOT flag a healthy summary that mentions a real count', () => {
    expect(
      rankingAdmitsEmptySelection(
        'Sélection éditoriale de 10 hôtels de luxe à Bali, 2026 : villas avec piscine, spas reconnus.',
        'Editorial selection of 10 luxury hotels in Bali, 2026: pool villas, acclaimed spas.',
      ),
    ).toBe(false);
    // "10 hôtels" contains "0 hôtel" as a substring but NOT as a standalone word
    expect(rankingAdmitsEmptySelection('Sélection de 10 hôtels.', '')).toBe(false);
  });
});
