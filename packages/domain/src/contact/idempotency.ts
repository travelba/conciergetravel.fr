/**
 * Idempotency key derivation for the general contact funnel. Mirrors the
 * booking-context helper (`buildEmailRequestIdempotencyKey`): keys-sorted
 * JSON, no whitespace, lowercase-normalised email, NO hashing (hashing
 * belongs to the integration / apps layer which has Web Crypto access).
 *
 * The key set is `{ email, subject, message }` so a visitor who double-submits
 * the identical message within the dedup window reuses the same reference,
 * but a genuinely different message (even same sender) creates a new lead.
 */
export interface ContactRequestIdempotencyInput {
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function canonicalise(value: JsonValue): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }
  if (typeof value === 'object') {
    const out: { [k: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v !== undefined) {
        out[key] = canonicalise(v);
      }
    }
    return out;
  }
  return value;
}

const normaliseEmail = (s: string): string => s.trim().toLowerCase();

/** Deterministic, JSON-canonical idempotency key for a contact submission. */
export const buildContactRequestIdempotencyKey = (
  input: ContactRequestIdempotencyInput,
): string => {
  const payload: JsonValue = {
    email: normaliseEmail(input.email),
    message: input.message.trim(),
    subject: input.subject.trim(),
  };
  return JSON.stringify(canonicalise(payload));
};
