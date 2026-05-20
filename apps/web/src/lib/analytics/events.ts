/**
 * Typed analytics event catalogue for MyConciergeHotel.com.
 *
 * Each event is a discriminated union variant on `name`. Wire-ups
 * (GA4, PostHog, Vercel Analytics custom) consume the same shape so
 * we get a single source of truth for funnel definitions.
 *
 * Rules (skill: security-engineering §PII):
 *   - Never embed raw email, phone, full name, payment data.
 *   - `userIdHash` is a SHA-256 of the Supabase user UUID, salted via env.
 *   - Free-text fields (e.g. error messages) MUST be sanitised by the
 *     dispatcher before reaching downstream sinks.
 */
export type BookingMode = 'amadeus' | 'little' | 'email' | 'display_only';

export type HotelView = {
  readonly name: 'view_hotel';
  readonly hotelId: string;
  readonly slug: string;
  readonly locale: 'fr' | 'en';
  readonly bookingMode: BookingMode;
  readonly isPalace: boolean;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly hasPriceFrom: boolean;
};

export type PricingView = {
  readonly name: 'view_pricing';
  readonly hotelId: string;
  readonly source: 'amadeus_live' | 'editorial_indicative' | 'comparator' | 'on_request';
  readonly priceFromMinor: number | null;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
};

export type BookingStart = {
  readonly name: 'start_booking';
  readonly hotelId: string;
  readonly bookingMode: BookingMode;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
  readonly surface: 'sticky_widget' | 'mobile_bar' | 'inline_section' | 'room_widget';
};

export type LockSubmit = {
  readonly name: 'submit_lock';
  readonly hotelId: string;
  readonly offerId: string;
  readonly isFakeOffer: boolean;
};

export type BookingComplete = {
  readonly name: 'complete_booking';
  readonly hotelId: string;
  readonly bookingRef: string;
  readonly totalMinor: number;
  readonly currency: 'EUR' | 'USD' | 'GBP' | 'CHF';
};

export type QuoteRequest = {
  readonly name: 'request_quote';
  readonly hotelId: string;
  readonly bookingMode: 'email' | 'display_only';
  readonly requestId: string;
};

export type AnalyticsEvent =
  | HotelView
  | PricingView
  | BookingStart
  | LockSubmit
  | BookingComplete
  | QuoteRequest;

export type AnalyticsEventName = AnalyticsEvent['name'];
