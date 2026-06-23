import type { Clock } from '../shared/clock';
import type { RandomSource } from '../shared/random';
import { err, ok, type Result } from '../shared/result';
import { invariant, type DomainError } from '../shared/errors';

const REF_SUFFIX_LEN = 5;

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** Canonical shape of a customer-facing contact reference. */
export const CONTACT_REF_PATTERN = /^CR-\d{8}-[A-Z0-9]{5}$/;

/**
 * Generates a customer-facing contact reference of the shape
 * `CR-YYYYMMDD-XXXXX` (5 uppercase alphanumeric chars). Mirrors
 * {@link generateBookingRef} (booking context) but with a `CR` prefix so the
 * two lead surfaces (booking enquiry vs general contact) never collide in
 * support tooling. The date portion is UTC-based. Uniqueness is the caller's
 * responsibility — collisions retry one level up.
 */
export const generateContactRef = (
  clock: Clock,
  random: RandomSource,
): Result<string, DomainError> => {
  const now = clock.now();
  const datePart = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
  const suffix = random.randomAlphanumeric(REF_SUFFIX_LEN);
  if (!/^[A-Z0-9]{5}$/.test(suffix)) {
    return err(invariant(`random source returned invalid suffix: ${JSON.stringify(suffix)}`));
  }
  return ok(`CR-${datePart}-${suffix}`);
};
