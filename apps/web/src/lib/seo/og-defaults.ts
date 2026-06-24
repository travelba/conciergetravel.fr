/**
 * Default Open Graph / Twitter share image.
 *
 * The site-wide brand share card, served as a canonical 1200×630 JPEG
 * (1.91:1 — the ratio Facebook, LinkedIn, X, Slack and WhatsApp all crop
 * predictably). Used as a fallback on any page that does not provide its
 * own hero-derived `og:image` (notably the home and the institutional
 * pages). Content pages (hotel, ranking, lieu, itinerary) keep emitting
 * their own Cloudinary hero image and override this default.
 *
 * The path is resolved against `metadataBase` (set in `app/layout.tsx`),
 * so a root-relative path becomes an absolute URL in the rendered tags.
 */
export const DEFAULT_OG_IMAGE = {
  url: '/og/default.jpg',
  width: 1200,
  height: 630,
  type: 'image/jpeg',
} as const;

export const DEFAULT_OG_IMAGE_ALT: Record<'fr' | 'en', string> = {
  fr: "MyConciergeHotel — La sélection du Concierge, hôtels d'exception dans 127 pays",
  en: "MyConciergeHotel — The Concierge's selection of extraordinary hotels in 127 countries",
};
