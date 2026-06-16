/**
 * GetYourGuide affiliate deeplink builder (Palier A monetisation).
 *
 * Every outbound link to GYG MUST carry the `partner_id` so the
 * conversion is attributed. We never surface a bare GYG URL. The
 * partner deeplink format is the canonical activity URL with the
 * `partner_id` query param appended; when we only have a tour id we
 * fall back to the `-t<id>` short path GYG accepts.
 */
const GYG_PUBLIC_BASE = 'https://www.getyourguide.com';

function withPartnerId(rawUrl: string, partnerId: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set('partner_id', partnerId);
    return u.toString();
  } catch {
    // Not an absolute URL — treat as a tour id path fragment.
    return `${GYG_PUBLIC_BASE}/-t${rawUrl}/?partner_id=${encodeURIComponent(partnerId)}`;
  }
}

/**
 * Build the affiliate deeplink for a tour. Prefers the canonical `url`
 * returned by the API; falls back to the short `-t<tourId>` path.
 */
export function buildGygDeeplink(args: {
  readonly partnerId: string;
  readonly tourId: string;
  readonly canonicalUrl?: string | null;
}): string {
  const base =
    args.canonicalUrl !== undefined && args.canonicalUrl !== null && args.canonicalUrl.length > 0
      ? args.canonicalUrl
      : args.tourId;
  return withPartnerId(base, args.partnerId);
}
