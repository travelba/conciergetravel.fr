import { describe, expect, it } from 'vitest';

import { parseGygSearchResponse } from './parse';
import { GygSearchResponseSchema } from './types';

describe('parseGygSearchResponse', () => {
  it('normalises the wrapped data.tours shape and builds an affiliate deeplink', () => {
    const raw = {
      data: {
        tours: [
          {
            tour_id: 12345,
            title: 'Skip-the-line Louvre guided tour',
            abstract: 'Beat the queues with an expert guide.',
            url: 'https://www.getyourguide.com/paris-l16/louvre-t12345',
            price: { values: { amount: '69.00' }, currency: 'EUR' },
            reviews: { rating: '4.6', rating_count: 2103 },
            photos: [{ url: 'https://img.gyg.com/a.jpg' }],
          },
        ],
      },
    };
    const parsed = GygSearchResponseSchema.parse(raw);
    const tours = parseGygSearchResponse(parsed, 'PARTNER42');

    expect(tours).toHaveLength(1);
    const tour = tours[0];
    expect(tour?.tourId).toBe('12345');
    expect(tour?.priceFromMinor).toBe(6900);
    expect(tour?.currency).toBe('EUR');
    expect(tour?.rating).toBe(4.6);
    expect(tour?.reviewCount).toBe(2103);
    expect(tour?.imageUrl).toBe('https://img.gyg.com/a.jpg');
    expect(tour?.deeplinkUrl).toContain('partner_id=PARTNER42');
  });

  it('drops entries without a tour id or title', () => {
    const raw = [
      { title: 'No id here' },
      { tour_id: 'abc' },
      { tour_id: 'ok1', title: 'Valid tour' },
    ];
    const parsed = GygSearchResponseSchema.parse(raw);
    const tours = parseGygSearchResponse(parsed, 'P1');
    expect(tours).toHaveLength(1);
    expect(tours[0]?.tourId).toBe('ok1');
  });

  it('falls back to the -t<id> short path when no canonical url is present', () => {
    const raw = [{ tour_id: 999, title: 'No url tour' }];
    const parsed = GygSearchResponseSchema.parse(raw);
    const tours = parseGygSearchResponse(parsed, 'PX');
    expect(tours[0]?.deeplinkUrl).toBe('https://www.getyourguide.com/-t999/?partner_id=PX');
  });
});
