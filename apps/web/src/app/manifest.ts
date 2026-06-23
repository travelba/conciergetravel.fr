import type { MetadataRoute } from 'next';

/**
 * `/manifest.webmanifest` — minimal PWA manifest (Next.js file-based
 * metadata convention; the `<link rel="manifest">` tag is injected
 * automatically). Kept intentionally lightweight: name + branding
 * colours + the brand SVG icon. No installable-app ambition yet, but a
 * present, valid manifest removes the Lighthouse/PWA warning and lets
 * Android home-screen shortcuts pick up the brand mark.
 *
 * Colours mirror `app/layout.tsx` `viewport.themeColor` (cream `#fafaf8`)
 * and the dark brand mark used in the icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyConciergeHotel — La sélection du Concierge',
    short_name: 'MyConciergeHotel',
    description:
      "Hôtels d'exception dans le monde, sélectionnés et signés par notre conciergerie. Agence IATA accréditée.",
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#fafaf8',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
