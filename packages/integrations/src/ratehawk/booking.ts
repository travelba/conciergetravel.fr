/**
 * RateHawk / ETG (worldota) booking flow (b2b/v3):
 *   prebook -> order/booking/form -> order/booking/finish -> (status) ; cancel.
 *
 * NOTE — sandbox validation pending: the finish payload shape (guest rooms,
 * payment type) follows ETG docs but has not yet been exercised against live
 * sandbox credentials. `capabilities.book` gates real usage; the orchestrator
 * never auto-books without an explicit confirm path. Validate end-to-end in
 * sandbox (`ratehawk:probe` + a dedicated book script) before production
 * routing.
 *
 * Docs: https://docs.emergingtravel.com/docs/booking-process/
 */
import { err, ok, type Result } from '@mch/domain/shared';
import { retryingJsonRequest } from '@mch/integrations/http';
import { z } from 'zod';

import type { RateHawkClientConfig } from './client';
import type { RateHawkError } from './errors';

function basicAuthHeader(cfg: RateHawkClientConfig): string {
  return `Basic ${btoa(`${cfg.keyId}:${cfg.apiKey}`)}`;
}

async function postJson<T>(
  cfg: RateHawkClientConfig,
  path: string,
  payload: unknown,
  parse: (raw: unknown) => Result<T, RateHawkError>,
  idempotencyKey?: string,
): Promise<Result<T, RateHawkError>> {
  const url = new URL(path, cfg.baseUrl).toString();
  const res = await retryingJsonRequest({
    url,
    method: 'POST',
    headers: { Authorization: basicAuthHeader(cfg), Accept: 'application/json' },
    body: { kind: 'json', value: payload },
    timeoutMs: 20_000,
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  });
  if (!res.ok) return err({ kind: 'http', error: res.error });
  if (res.value.json === undefined)
    return err({ kind: 'parse_failure', details: 'empty response' });
  return parse(res.value.json);
}

// --- prebook -----------------------------------------------------------------

export interface RateHawkPrebookResult {
  readonly bookHash: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly changed: boolean;
}

const PrebookResponseSchema = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    data: z
      .object({
        changes: z
          .object({ price_changed: z.boolean().optional() })
          .passthrough()
          .nullable()
          .optional(),
        hotels: z
          .array(
            z
              .object({
                rates: z
                  .array(
                    z
                      .object({
                        book_hash: z.string().optional(),
                        payment_options: z
                          .object({
                            payment_types: z
                              .array(
                                z
                                  .object({
                                    show_amount: z.string().optional(),
                                    amount: z.string().optional(),
                                    show_currency_code: z.string().optional(),
                                    currency_code: z.string().optional(),
                                  })
                                  .passthrough(),
                              )
                              .optional(),
                          })
                          .passthrough()
                          .optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export async function prebook(
  cfg: RateHawkClientConfig,
  bookHash: string,
): Promise<Result<RateHawkPrebookResult, RateHawkError>> {
  return postJson(
    cfg,
    '/api/b2b/v3/hotel/prebook/',
    { hash: bookHash, price_increase_percent: 20 },
    (raw) => {
      const parsed = PrebookResponseSchema.safeParse(raw);
      if (!parsed.success) return err({ kind: 'parse_failure', details: 'prebook shape' });
      if (parsed.data.status !== undefined && parsed.data.status !== 'ok') {
        return err({
          kind: 'api_error',
          status: parsed.data.status,
          details: parsed.data.error ?? 'prebook error',
        });
      }
      const rate = parsed.data.data?.hotels?.[0]?.rates?.[0];
      const refreshed = rate?.book_hash ?? bookHash;
      const pt = rate?.payment_options?.payment_types?.[0];
      const amountStr = pt?.show_amount ?? pt?.amount;
      const amount = amountStr !== undefined ? Number.parseFloat(amountStr) : NaN;
      return ok({
        bookHash: refreshed,
        priceMinor: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
        currency: pt?.show_currency_code ?? pt?.currency_code ?? 'EUR',
        changed: parsed.data.data?.changes?.price_changed === true,
      });
    },
  );
}

// --- book (form + finish) ----------------------------------------------------

export interface RateHawkGuest {
  readonly firstName: string;
  readonly lastName: string;
}

export interface RateHawkBookInput {
  readonly bookHash: string;
  readonly partnerOrderId: string;
  readonly leadGuest: RateHawkGuest;
  readonly guests: readonly RateHawkGuest[];
  readonly email: string;
  readonly phone: string;
  readonly language?: string;
}

export interface RateHawkBookResult {
  readonly partnerOrderId: string;
  readonly orderId: string;
  readonly status: 'confirmed' | 'processing' | 'failed';
}

const BookingFormResponseSchema = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    data: z
      .object({ order_id: z.union([z.string(), z.number()]).optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const BookingFinishResponseSchema = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
    data: z.unknown().nullable().optional(),
  })
  .passthrough();

export async function book(
  cfg: RateHawkClientConfig,
  input: RateHawkBookInput,
): Promise<Result<RateHawkBookResult, RateHawkError>> {
  const language = input.language ?? 'en';

  // Step 1 — booking form (creates the order shell, returns order_id).
  const form = await postJson(
    cfg,
    '/api/b2b/v3/hotel/order/booking/form/',
    { partner_order_id: input.partnerOrderId, language, user_ip: '127.0.0.1' },
    (raw) => {
      const parsed = BookingFormResponseSchema.safeParse(raw);
      if (!parsed.success) return err({ kind: 'parse_failure', details: 'booking form shape' });
      if (parsed.data.status !== undefined && parsed.data.status !== 'ok') {
        return err({
          kind: 'api_error',
          status: parsed.data.status,
          details: parsed.data.error ?? 'booking form error',
        });
      }
      const orderId = parsed.data.data?.order_id;
      return ok(orderId !== undefined ? String(orderId) : '');
    },
    input.partnerOrderId,
  );
  if (!form.ok) return err(form.error);

  // Step 2 — finish (commit the booking; deposit/partner balance payment).
  const rooms = [
    {
      guests: input.guests.map((g) => ({ first_name: g.firstName, last_name: g.lastName })),
    },
  ];
  const finishPayload = {
    partner_order_id: input.partnerOrderId,
    book_hash: input.bookHash,
    language,
    user: { email: input.email, phone: input.phone },
    rooms,
    payment_type: { type: 'deposit', amount: '0', currency_code: 'EUR' },
  };

  return postJson(
    cfg,
    '/api/b2b/v3/hotel/order/booking/finish/',
    finishPayload,
    (raw) => {
      const parsed = BookingFinishResponseSchema.safeParse(raw);
      if (!parsed.success) return err({ kind: 'parse_failure', details: 'booking finish shape' });
      if (parsed.data.status !== undefined && parsed.data.status !== 'ok') {
        return err({
          kind: 'api_error',
          status: parsed.data.status,
          details: parsed.data.error ?? 'booking finish error',
        });
      }
      return ok({
        partnerOrderId: input.partnerOrderId,
        orderId: form.value,
        status: 'processing' as const,
      });
    },
    input.partnerOrderId,
  );
}

// --- cancel ------------------------------------------------------------------

export interface RateHawkCancelResult {
  readonly cancelled: boolean;
  readonly status: string;
}

const CancelResponseSchema = z
  .object({
    status: z.string().optional(),
    error: z.string().nullable().optional(),
  })
  .passthrough();

export async function cancel(
  cfg: RateHawkClientConfig,
  partnerOrderId: string,
): Promise<Result<RateHawkCancelResult, RateHawkError>> {
  return postJson(
    cfg,
    '/api/b2b/v3/hotel/order/cancel/',
    { partner_order_id: partnerOrderId },
    (raw) => {
      const parsed = CancelResponseSchema.safeParse(raw);
      if (!parsed.success) return err({ kind: 'parse_failure', details: 'cancel shape' });
      const status = parsed.data.status ?? 'unknown';
      if (status !== 'ok') {
        return err({ kind: 'api_error', status, details: parsed.data.error ?? 'cancel error' });
      }
      return ok({ cancelled: true, status });
    },
    partnerOrderId,
  );
}
