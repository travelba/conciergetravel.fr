import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

import { CATALOGUE_COUNTRIES, CATALOGUE_PUBLISHED } from '@/lib/catalogue-stats';

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://myconciergehotel.com'),
  title: {
    default: "MyConciergeHotel — La sélection du Concierge, hôtels d'exception dans le monde",
    template: '%s · MyConciergeHotel',
  },
  description: `${CATALOGUE_PUBLISHED} adresses sélectionnées dans ${CATALOGUE_COUNTRIES} pays — Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World, boutiques-hôtels. Chaque fiche se termine par un Conseil du Concierge, signé par notre conciergerie. Agence IATA accréditée.`,
  applicationName: 'MyConciergeHotel',
  authors: [{ name: 'MyConciergeHotel' }],
  formatDetection: { email: false, address: false, telephone: false },
  // Brand SVG favicon (modern browsers); no legacy `.ico` shipped — the
  // SVG covers tab, bookmark and Apple touch surfaces. `/manifest.webmanifest`
  // is wired automatically by the `app/manifest.ts` file convention.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fafaf8',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The `[locale]` layout sets the actual <html lang="..">; this root layout
  // is only required by Next.js. We keep it minimal.
  return children;
}
