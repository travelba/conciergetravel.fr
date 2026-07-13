import 'server-only';

import type { JourneyTouchpoint } from './templates';

/**
 * Lifecycle channel orchestrator — email (Brevo) and WhatsApp are siblings.
 * WhatsApp when the guest opted in at booking; otherwise email. Never both
 * for the same touchpoint (skill: whatsapp-concierge-journey).
 */

export type NotificationChannel = 'email' | 'whatsapp' | 'none';

export type GuestChannelPreferences = {
  readonly email: string;
  readonly whatsappOptIn: boolean;
  readonly whatsappOptOut: boolean;
  readonly locale: 'fr' | 'en';
  readonly phoneE164?: string;
};

export type JourneyEvent = {
  readonly bookingRef: string;
  readonly touchpoint: JourneyTouchpoint;
  readonly scheduledAt: string;
  readonly hotelSlug: string;
  readonly hotelName: string;
  readonly guestFirstName: string;
  readonly placeholderValues: Readonly<Record<string, string>>;
};

export type ChannelDispatchPlan =
  | {
      readonly channel: 'whatsapp';
      readonly touchpoint: JourneyTouchpoint;
      readonly locale: 'fr' | 'en';
      readonly phoneE164: string;
      readonly placeholderValues: Readonly<Record<string, string>>;
    }
  | {
      readonly channel: 'email';
      readonly touchpoint: JourneyTouchpoint;
      readonly locale: 'fr' | 'en';
      readonly email: string;
      readonly placeholderValues: Readonly<Record<string, string>>;
    }
  | {
      readonly channel: 'none';
      readonly reason: 'opt_out' | 'no_contact' | 'touchpoint_suppressed';
    };

/**
 * Pick the channel for a journey touchpoint. Returns `none` when the guest
 * opted out or no reachable address exists.
 */
export function planJourneyDispatch(
  prefs: GuestChannelPreferences,
  event: JourneyEvent,
): ChannelDispatchPlan {
  if (prefs.whatsappOptOut) {
    return { channel: 'none', reason: 'opt_out' };
  }

  if (prefs.whatsappOptIn && prefs.phoneE164 !== undefined && prefs.phoneE164.length > 0) {
    return {
      channel: 'whatsapp',
      touchpoint: event.touchpoint,
      locale: prefs.locale,
      phoneE164: prefs.phoneE164,
      placeholderValues: event.placeholderValues,
    };
  }

  if (prefs.email.length > 0) {
    return {
      channel: 'email',
      touchpoint: event.touchpoint,
      locale: prefs.locale,
      email: prefs.email,
      placeholderValues: event.placeholderValues,
    };
  }

  return { channel: 'none', reason: 'no_contact' };
}

export type InboundWhatsAppAction =
  | { readonly kind: 'opt_out'; readonly bookingRef: string | null }
  | { readonly kind: 'service_request'; readonly body: string; readonly waMessageId: string }
  | { readonly kind: 'status_receipt'; readonly messageId: string; readonly status: string }
  | { readonly kind: 'ignored' };

/**
 * Classify an inbound webhook message for async processing.
 * Does not perform LLM replies — enqueue to worker after fast-ack.
 */
export function classifyInboundWhatsApp(input: {
  readonly body: string;
  readonly isOptOut: boolean;
  readonly bookingRef: string | null;
  readonly waMessageId: string;
}): InboundWhatsAppAction {
  if (input.isOptOut) {
    return { kind: 'opt_out', bookingRef: input.bookingRef };
  }

  if (input.body.length === 0) {
    return { kind: 'ignored' };
  }

  return {
    kind: 'service_request',
    body: input.body,
    waMessageId: input.waMessageId,
  };
}

/** Idempotency key for journey sends — one message per (booking, touchpoint). */
export function journeySendIdempotencyKey(
  bookingRef: string,
  touchpoint: JourneyTouchpoint,
): string {
  return `mch:whatsapp:journey:${bookingRef}:${touchpoint}`;
}

/** Map touchpoint to Brevo template slug (email sibling). */
export function emailTemplateSlugForTouchpoint(touchpoint: JourneyTouchpoint): string {
  switch (touchpoint) {
    case 'booking_confirmed':
      return 'journey-booking-confirmed';
    case 'pre_arrival_j7':
      return 'journey-pre-arrival-j7';
    case 'pre_arrival_j1':
      return 'journey-pre-arrival-j1';
    case 'arrival_day':
      return 'journey-arrival-day';
    case 'mid_stay':
      return 'journey-mid-stay';
    case 'post_stay_j1':
      return 'journey-post-stay-j1';
    case 'post_stay_j7_club':
      return 'journey-post-stay-club';
    default: {
      const _exhaustive: never = touchpoint;
      throw new Error(`Unknown touchpoint: ${String(_exhaustive)}`);
    }
  }
}
