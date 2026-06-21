import { describe, expect, it } from 'vitest';

import { fixedClock } from '../shared/clock';
import { fixedRandomSource } from '../shared/random';
import { CONTACT_REF_PATTERN, generateContactRef } from './contact-ref';
import { buildContactRequestIdempotencyKey } from './idempotency';

describe('generateContactRef', () => {
  it('produces a CR-YYYYMMDD-XXXXX reference (UTC date)', () => {
    const res = generateContactRef(
      fixedClock('2026-06-17T10:00:00.000Z'),
      fixedRandomSource('ABCDE'),
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toMatch(CONTACT_REF_PATTERN);
      expect(res.value.startsWith('CR-20260617-')).toBe(true);
    }
  });

  it('is deterministic for a fixed clock + random source', () => {
    const a = generateContactRef(fixedClock('2026-01-02T00:00:00Z'), fixedRandomSource('seed1'));
    const b = generateContactRef(fixedClock('2026-01-02T00:00:00Z'), fixedRandomSource('seed1'));
    expect(a).toEqual(b);
  });
});

describe('buildContactRequestIdempotencyKey', () => {
  it('normalises email case/whitespace and trims subject/message', () => {
    const a = buildContactRequestIdempotencyKey({
      email: '  Alice@Example.COM ',
      subject: ' Séjour à Paris ',
      message: ' Bonjour, je cherche une suite. ',
    });
    const b = buildContactRequestIdempotencyKey({
      email: 'alice@example.com',
      subject: 'Séjour à Paris',
      message: 'Bonjour, je cherche une suite.',
    });
    expect(a).toBe(b);
  });

  it('changes when the message differs (same sender)', () => {
    const a = buildContactRequestIdempotencyKey({
      email: 'alice@example.com',
      subject: 'Demande',
      message: 'Message un',
    });
    const b = buildContactRequestIdempotencyKey({
      email: 'alice@example.com',
      subject: 'Demande',
      message: 'Message deux',
    });
    expect(a).not.toBe(b);
  });

  it('emits sorted-keys canonical JSON without whitespace', () => {
    const key = buildContactRequestIdempotencyKey({
      email: 'a@b.com',
      subject: 's',
      message: 'm',
    });
    expect(key).toBe('{"email":"a@b.com","message":"m","subject":"s"}');
  });
});
