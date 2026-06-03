import type { ReactElement } from 'react';

import type { Locale } from '@/i18n/routing';

interface HotelGeoSectionProps {
  readonly locale: Locale;
}

interface GeoBlock {
  readonly id: string;
  readonly question: string;
  readonly paragraphs: readonly string[];
}

/**
 * GEO / AEO question blocks for the Airelles Gordes fiche (ACTION 5,
 * branch `seo/fix-airelles-gordes-test`). Three short H2-led answers built
 * for AI Overviews / answer engines: each question mirrors a real long-tail
 * query and is answered in 2-3 ≤ 25-word sentences (concierge-voice skill).
 *
 * Factual integrity: the hotel holds the regulated Atout France *Palace*
 * distinction, **not** a Michelin star — Clover Gordes is the Provençal table
 * of multi-starred chef Jean-François Piège but the restaurant itself is not
 * starred (see `dev-override-airelles.ts` + hotel-detail-page.mdc Hard Rule 7).
 * The copy therefore avoids the "restaurant étoilé" wording.
 *
 * Pure RSC, no client JS. Gated to the single slug at the call site.
 */
const BLOCKS: Record<Locale, readonly GeoBlock[]> = {
  fr: [
    {
      id: 'geo-meilleur-palace-gordes',
      question: 'Quel est le meilleur hôtel Palace à Gordes ?',
      paragraphs: [
        'Airelles Gordes, La Bastide est le seul Palace de Gordes, distinction officielle d’Atout France.',
        'Cette bastide du XVIIIᵉ siècle domine le village perché et la vallée du Luberon, avec 34 chambres et 6 suites.',
      ],
    },
    {
      id: 'geo-palace-luberon-spa',
      question: 'Hôtel Palace Luberon avec spa et table de chef',
      paragraphs: [
        'Le Spa Airelles by Guerlain s’étend sous des voûtes en pierre, avec piscine intérieure, hammam et sauna.',
        'La table provençale de Clover Gordes est signée du chef multi-étoilé Jean-François Piège.',
        'L’hôtel compte trois piscines, dont un bassin en terrasse panoramique face à la vallée.',
      ],
    },
    {
      id: 'geo-prix-airelles-gordes',
      question: 'Prix et disponibilités — Airelles Gordes',
      paragraphs: [
        'Les nuitées à La Bastide démarrent autour de 649 € la nuit, selon la saison et la catégorie de chambre.',
        'L’établissement est saisonnier ; la conciergerie organise réservations, tables et soins au +33 4 90 72 12 12.',
      ],
    },
  ],
  en: [
    {
      id: 'geo-meilleur-palace-gordes',
      question: 'What is the best Palace hotel in Gordes?',
      paragraphs: [
        'Airelles Gordes, La Bastide is the only Palace in Gordes, an official Atout France distinction.',
        'This 18th-century bastide overlooks the hilltop village and the Luberon valley, with 34 rooms and 6 suites.',
      ],
    },
    {
      id: 'geo-palace-luberon-spa',
      question: 'Luberon Palace hotel with a spa and a chef’s table',
      paragraphs: [
        'The Airelles Spa by Guerlain unfolds under stone vaults, with an indoor pool, a hammam and a sauna.',
        'The Provençal table at Clover Gordes is run by multi-Michelin-starred chef Jean-François Piège.',
        'The hotel has three pools, including a panoramic terrace pool facing the valley.',
      ],
    },
    {
      id: 'geo-prix-airelles-gordes',
      question: 'Prices and availability — Airelles Gordes',
      paragraphs: [
        'Nights at La Bastide start at around €649, depending on the season and the room category.',
        'The property is seasonal; the concierge arranges rooms, tables and treatments at +33 4 90 72 12 12.',
      ],
    },
  ],
};

export function HotelGeoSection({ locale }: HotelGeoSectionProps): ReactElement {
  const blocks = BLOCKS[locale] ?? BLOCKS.fr;
  return (
    <section
      aria-label={
        locale === 'en'
          ? 'Key questions about Airelles Gordes'
          : 'Questions clés sur Airelles Gordes'
      }
      data-geo="airelles-gordes"
      className="mb-12 flex flex-col gap-8"
    >
      {blocks.map((block) => (
        <div key={block.id} id={block.id} className="scroll-mt-28">
          <h2 className="text-fg mb-3 font-serif text-2xl">{block.question}</h2>
          {block.paragraphs.map((p, i) => (
            <p key={i} className="text-muted max-w-prose leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
