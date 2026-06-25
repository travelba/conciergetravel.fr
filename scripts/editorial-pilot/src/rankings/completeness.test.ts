import { describe, expect, it } from 'vitest';

import {
  completenessStatus,
  isComplete,
  summarizeCompleteness,
  type CompletenessStatus,
} from './completeness';

describe('isComplete', () => {
  it('is true when entries meet or exceed the target', () => {
    expect(isComplete(10, 10)).toBe(true);
    expect(isComplete(11, 10)).toBe(true);
  });

  it('is false when entries fall short', () => {
    expect(isComplete(9, 10)).toBe(false);
    expect(isComplete(0, 5)).toBe(false);
  });
});

describe('completenessStatus', () => {
  it('reports a positive gap and incomplete for an underfilled ranking', () => {
    const s = completenessStatus('meilleurs-hotels-paris', 6, 10);
    expect(s).toEqual({
      slug: 'meilleurs-hotels-paris',
      entries: 6,
      target: 10,
      gap: 4,
      complete: false,
    });
  });

  it('clamps the gap at 0 when over-filled', () => {
    const s = completenessStatus('meilleurs-hotels-rome', 12, 8);
    expect(s.gap).toBe(0);
    expect(s.complete).toBe(true);
  });
});

describe('summarizeCompleteness', () => {
  const rows: CompletenessStatus[] = [
    completenessStatus('a', 10, 10), // complete
    completenessStatus('b', 3, 10), // gap 7
    completenessStatus('c', 0, 5), // empty, gap 5
    completenessStatus('d', 8, 8), // complete
    completenessStatus('e', 7, 10), // gap 3
  ];

  it('counts complete / underfilled / empty', () => {
    const sum = summarizeCompleteness(rows);
    expect(sum.total).toBe(5);
    expect(sum.complete).toBe(2);
    expect(sum.underfilled).toBe(3);
    expect(sum.empty).toBe(1);
  });

  it('sorts worstGaps by descending gap', () => {
    const sum = summarizeCompleteness(rows);
    expect(sum.worstGaps.map((r) => r.slug)).toEqual(['b', 'c', 'e']);
  });

  it('honours the topN cap', () => {
    const sum = summarizeCompleteness(rows, 2);
    expect(sum.worstGaps).toHaveLength(2);
    expect(sum.worstGaps[0]?.slug).toBe('b');
  });
});
