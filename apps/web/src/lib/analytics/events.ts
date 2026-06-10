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
export type BookingMode =
  | 'amadeus'
  | 'little'
  | 'travelport'
  | 'email'
  | 'display_only'
  | 'multi_supplier';

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

/**
 * `club.*` client-side custom events. Mirrors the server-side
 * Sentry emitter so both sinks (Vercel Analytics, GA4 via dataLayer)
 * report the same funnel. Surfaces match the server taxonomy.
 *
 * Skill: membership-program §Sentry custom events.
 */
export type ClubBenefitsViewed = {
  readonly name: 'club_benefits_viewed';
  readonly surface: 'hotel_fiche' | 'club_landing' | 'dashboard';
  readonly tier: 'anon' | 'club' | 'prestige';
  readonly hotelId?: string;
};

export type ClubSignupCtaClicked = {
  readonly name: 'club_signup_cta_clicked';
  readonly surface: 'hotel_fiche' | 'club_landing' | 'header' | 'footer';
  readonly cta: 'join_free' | 'join_prestige' | 'learn_more';
};

export type AnalyticsEvent =
  | HotelView
  | PricingView
  | BookingStart
  | LockSubmit
  | BookingComplete
  | QuoteRequest
  | ClubBenefitsViewed
  | ClubSignupCtaClicked;

export type AnalyticsEventName = AnalyticsEvent['name'];
