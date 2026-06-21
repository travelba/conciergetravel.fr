import { describe, expect, it } from 'vitest';

import { fixedClock } from '../shared/clock';
import { fixedRandomSource, type RandomSource } from '../shared/random';
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

  it('zero-pads single-digit months and days (UTC)', () => {
    const res = generateContactRef(
      fixedClock('2026-03-05T08:00:00.000Z'),
      fixedRandomSource('ABCDE'),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.startsWith('CR-20260305-')).toBe(true);
  });

  it('uses the UTC date even when the local instant rolls into the next day', () => {
    // 23:30Z on Dec 31 is the same UTC day regardless of local TZ.
    const res = generateContactRef(
      fixedClock('2026-12-31T23:30:00.000Z'),
      fixedRandomSource('ABCDE'),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.startsWith('CR-20261231-')).toBe(true);
  });

  it('returns an error when the random source emits an invalid suffix', () => {
    const badRandom: RandomSource = { randomAlphanumeric: () => 'abcde' }; // lowercase ⇒ invalid
    const res = generateContactRef(fixedClock('2026-06-17T10:00:00.000Z'), badRandom);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.kind).toBe('invariant_violated');
  });

  it('returns an error when the random source emits the wrong length', () => {
    const shortRandom: RandomSource = { randomAlphanumeric: () => 'AB' };
    const res = generateContactRef(fixedClock('2026-06-17T10:00:00.000Z'), shortRandom);
    expect(res.ok).toBe(false);
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

  it('changes when only the subject differs (same sender + message)', () => {
    const a = buildContactRequestIdempotencyKey({
      email: 'alice@example.com',
      subject: 'Sujet A',
      message: 'Même message',
    });
    const b = buildContactRequestIdempotencyKey({
      email: 'alice@example.com',
      subject: 'Sujet B',
      message: 'Même message',
    });
    expect(a).not.toBe(b);
  });

  it('is insensitive to surrounding email whitespace and case only', () => {
    const key = buildContactRequestIdempotencyKey({
      email: '\tBob@Example.Com\n',
      subject: 'Hi',
      message: 'Hello there',
    });
    expect(key).toBe('{"email":"bob@example.com","message":"Hello there","subject":"Hi"}');
  });
});
