import { describe, expect, it } from 'vitest';

import {
  gateConciergeAdviceFormat,
  type ConciergeAdviceOutput,
} from './concierge-advice-generator.js';

/**
 * A clean, format-conforming advice pair used as the baseline. Each test
 * mutates one field to assert the gate's behaviour in isolation.
 */
function baseAdvice(): ConciergeAdviceOutput {
  return {
    fr: {
      title: 'Le secret du Concierge pour cette adresse',
      body: 'Mon conseil : réservez la chambre 412, la seule avec terrasse orientée sur le vieux port. Le room service tourne jusqu’à minuit, idéal après un dîner tardif au comptoir du bar. Demandez la voiture privée à sept heures pour éviter les embouteillages du centre et arriver détendu. Le concierge garde aussi quelques tables au restaurant étoilé pour ses habitués.',
      tip_for: 'room',
    },
    en: {
      title: 'The Concierge tip for this address',
      body: 'My tip: book room 412, the only one with a terrace facing the old harbour. Room service runs until midnight, perfect after a late dinner at the bar counter downstairs. Ask for the private car at seven in the morning to beat the city-centre traffic and arrive relaxed. The concierge also keeps a few tables at the starred restaurant for regulars.',
      tip_for: 'room',
    },
  };
}

/** Wrap a leaked phrase inside an otherwise length-conforming FR body. */
function frBodyWithLeak(leak: string): string {
  return `Mon conseil : réservez la chambre 412 avec terrasse sur le port, puis dînez tôt au comptoir du bar avant le service du soir. ${leak} Pour le reste, demandez la voiture privée à sept heures afin d’éviter les embouteillages du centre et d’arriver parfaitement détendu pour votre rendez-vous.`;
}

describe('gateConciergeAdviceFormat — anti-scaffolding write-guard (ADR-0029 I1)', () => {
  it('accepts a clean, format-conforming advice', () => {
    expect(gateConciergeAdviceFormat(baseAdvice())).toBeNull();
  });

  // Real leak shapes observed on the 110 published advices (2026-06 audit):
  // the LLM narrates the data dossier instead of giving operational advice.
  const FR_LEAKS = [
    'Je m’en tiens à l’adresse car ce dossier reste un repère, pas une fiche d’expérience.',
    'Le reste du dossier est encore en enrichissement manuel sur le spa et les tables.',
    'Je traite ce dossier comme une base administrative, pas comme une fiche de séjour finalisée.',
    'La mention cinq étoiles existe dans le registre, le niveau de confiance reste low pour le spa.',
  ];

  it.each(FR_LEAKS)('rejects a FR body that narrates the dossier: %s', (leak) => {
    const advice = baseAdvice();
    const reason = gateConciergeAdviceFormat({
      ...advice,
      fr: { ...advice.fr, body: frBodyWithLeak(leak) },
    });
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/fr\.body carries scaffolding/u);
  });

  it('rejects an EN body that narrates the brief', () => {
    const advice = baseAdvice();
    const reason = gateConciergeAdviceFormat({
      ...advice,
      en: {
        ...advice.en,
        body: 'My tip: book room 412 facing the old harbour and dine early at the bar counter downstairs. The dossier confirms only the address, and the rest is still pending verification before any stay. Ask the concierge for the private car at seven to beat the morning traffic across the city centre.',
      },
    });
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/en\.body carries scaffolding/u);
  });

  it('rejects a leaking title even when bodies are clean', () => {
    const advice = baseAdvice();
    const reason = gateConciergeAdviceFormat({
      ...advice,
      fr: { ...advice.fr, title: 'Le dossier reste en attente d’enrichissement manuel chez nous' },
    });
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/fr\.title carries scaffolding/u);
  });

  it('does not flag legitimate concierge prose mentioning a brief stroll', () => {
    const advice = baseAdvice();
    const reason = gateConciergeAdviceFormat({
      ...advice,
      en: {
        ...advice.en,
        body: 'My tip: after a brief stroll along the old quay, ask the concierge for the eight o’clock boat to the islands. It is the calmest crossing of the day, and the light over the bay is at its very best then. Book the corner table on the terrace afterwards for a long, unhurried lunch.',
      },
    });
    expect(reason).toBeNull();
  });
});
