import 'server-only';

import { generateContactRef } from '@mch/domain/contact';
import { err, ok, type Result } from '@mch/domain/shared';
import {
  ContactRequestGuest,
  ContactRequestOps,
  renderEmailHtml,
  renderEmailText,
} from '@mch/emails';
import { sendBrevoTransactionalEmail } from '@mch/integrations/brevo';
import { z } from 'zod';

import { env } from '@/lib/env';
// Generic infra ports (clock + Web-Crypto random) — shared from the booking
// module to avoid duplicating the rejection-sampling random source.
import { serverClock, webCryptoRandomSource } from '@/server/booking/ports';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

import {
  finaliseContactIdempotency,
  releaseContactIdempotency,
  reserveContactIdempotency,
} from './idempotency';
import { gateContactByEmail, gateContactByIp } from './rate-limit';

export const ContactRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(['fr', 'en']).default('fr'),
  phone: z.string().trim().min(5).max(40).optional(),
  source: z.string().trim().min(1).max(40).default('contact_page'),
  userId: z.string().uuid().optional(),
  /** Best-effort client IP from `x-forwarded-for` — used for rate-limiting. */
  clientIp: z.string().min(1).max(64).optional(),
});

export type ContactRequestInput = z.infer<typeof ContactRequestSchema>;

export type ContactRequestError =
  | { readonly kind: 'validation'; readonly field: string; readonly message: string }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSec: number;
      readonly scope: 'ip' | 'email';
    }
  | { readonly kind: 'duplicate'; readonly requestRef: string }
  | { readonly kind: 'database'; readonly details: string }
  | { readonly kind: 'internal'; readonly details: string };

export interface ContactRequestSuccess {
  readonly requestRef: string;
  readonly deduplicated: boolean;
}

/**
 * E2E seam — when the Playwright harness is active there is no real Supabase
 * or Brevo, so we short-circuit after validation + idempotency and return a
 * freshly-generated ref WITHOUT side effects. Mirrors the fake-offer seam
 * philosophy; never true in production (no `MCH_E2E_FAKE_HOTEL_ID` set).
 *
 * Keyed ONLY on `MCH_E2E_FAKE_HOTEL_ID` — never on `MCH_DISABLE_RATE_LIMITS`.
 * The latter is an ops lever to relieve rate limiting; conflating it with the
 * data-bypass would silently drop real leads if it were ever set in prod.
 * This matches the side-effect-bypass convention in `booking/rate-limit.ts`
 * and `lib/redis.ts` (rate-limit bypasses may honour both flags; data bypasses
 * honour only the dedicated E2E marker).
 */
const isE2EBypass = (): boolean => typeof process.env['MCH_E2E_FAKE_HOTEL_ID'] === 'string';

async function sendEmails(input: {
  readonly locale: 'fr' | 'en';
  readonly name: string;
  readonly email: string;
  readonly phone: string | undefined;
  readonly subject: string;
  readonly message: string;
  readonly source: string;
  readonly requestRef: string;
}): Promise<void> {
  const guestEl = ContactRequestGuest({
    locale: input.locale,
    name: input.name,
    subject: input.subject,
    requestRef: input.requestRef,
  });
  const opsEl = ContactRequestOps({
    requestRef: input.requestRef,
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
    locale: input.locale,
    source: input.source,
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  });

  const [guestHtml, guestText, opsHtml, opsText] = await Promise.all([
    renderEmailHtml(guestEl),
    renderEmailText(guestEl),
    renderEmailHtml(opsEl),
    renderEmailText(opsEl),
  ]);

  const brevo = { apiKey: env.BREVO_API_KEY };
  const sender = { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME };

  const guestSubject =
    input.locale === 'en'
      ? `Message received — ${input.requestRef}`
      : `Message reçu — ${input.requestRef}`;
  const opsSubject = `[CCT] Contact — ${input.subject} — ${input.requestRef}`;

  await Promise.allSettled([
    sendBrevoTransactionalEmail(brevo, {
      sender,
      to: [{ email: input.email }],
      subject: guestSubject,
      htmlContent: guestHtml,
      ...(guestText.length > 0 ? { textContent: guestText } : {}),
    }),
    sendBrevoTransactionalEmail(brevo, {
      sender,
      to: [{ email: env.BREVO_INTERNAL_OPS_EMAIL }],
      subject: opsSubject,
      htmlContent: opsHtml,
      ...(opsText.length > 0 ? { textContent: opsText } : {}),
    }),
  ]);
}

/**
 * Server-side entry point for the general concierge contact funnel
 * (`/le-concierge/contact`, `/api/agent/contact`). Mirrors
 * {@link submitEmailBookingRequest}:
 *
 *  1. Parse + validate (Zod).
 *  2. Rate-limit by IP and by sender email (Upstash sliding window).
 *  3. Idempotency reservation (Redis NX, 24h) keyed on email+subject+message.
 *  4. Generate `CR-YYYYMMDD-XXXXX` ref via the domain port.
 *  5. Insert `contact_requests` via service-role.
 *  6. Render React Email templates + send via Brevo (guest ack + ops relay).
 *  7. Finalise idempotency slot.
 *
 * Email send failures do not roll back the DB row — the operator queue can
 * still recover the lead from `contact_requests`.
 */
export async function submitContactRequest(
  raw: unknown,
): Promise<Result<ContactRequestSuccess, ContactRequestError>> {
  const parsed = ContactRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err({
      kind: 'validation',
      field: issue ? issue.path.join('.') : 'input',
      message: issue ? issue.message : 'invalid payload',
    });
  }
  const input = parsed.data;

  if (input.clientIp !== undefined) {
    const ipVerdict = await gateContactByIp(input.clientIp);
    if (!ipVerdict.ok) {
      return err({ kind: 'rate_limited', retryAfterSec: ipVerdict.retryAfterSec, scope: 'ip' });
    }
  }
  const emailVerdict = await gateContactByEmail(input.email);
  if (!emailVerdict.ok) {
    return err({ kind: 'rate_limited', retryAfterSec: emailVerdict.retryAfterSec, scope: 'email' });
  }

  const reservation = await reserveContactIdempotency({
    email: input.email,
    subject: input.subject,
    message: input.message,
  });
  if (reservation.outcome.kind === 'existing') {
    return err({ kind: 'duplicate', requestRef: reservation.outcome.requestRef });
  }

  const refResult = generateContactRef(serverClock, webCryptoRandomSource);
  if (!refResult.ok) {
    await releaseContactIdempotency(reservation.hash);
    return err({ kind: 'internal', details: refResult.error.kind });
  }
  const requestRef: string = refResult.value;

  // E2E: skip Supabase + Brevo (no real infra), confirm the happy path.
  if (isE2EBypass()) {
    await finaliseContactIdempotency(reservation.hash, requestRef);
    return ok({ requestRef, deduplicated: false });
  }

  const supabase = getSupabaseAdminClient();
  const insert = await supabase
    .from('contact_requests')
    .insert({
      request_ref: requestRef,
      submitted_by: input.userId ?? null,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      subject: input.subject,
      message: input.message,
      locale: input.locale,
      source: input.source,
      status: 'new',
    })
    .select('id')
    .single();

  if (insert.error) {
    await releaseContactIdempotency(reservation.hash);
    return err({ kind: 'database', details: insert.error.message });
  }

  await sendEmails({
    locale: input.locale,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: input.subject,
    message: input.message,
    source: input.source,
    requestRef,
  });

  await finaliseContactIdempotency(reservation.hash, requestRef);

  return ok({ requestRef, deduplicated: false });
}
