/**
 * Contact bounded context — public surface for the general lead funnel
 * (`/le-concierge/contact`). Pure helpers only: reference generation +
 * idempotency key derivation. Persistence / Brevo relay live in `apps/web`.
 */
export * from './contact-ref';
export * from './idempotency';
