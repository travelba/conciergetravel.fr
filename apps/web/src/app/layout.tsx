import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://myconciergehotel.com'),
  title: {
    default: "MyConciergeHotel — La sélection du Concierge, hôtels d'exception dans le monde",
    template: '%s · MyConciergeHotel',
  },
  description:
    '615 adresses sélectionnées dans 91 pays — Palaces, Relais & Châteaux, Forbes Five Star, Michelin Keys, Leading Hotels of the World, boutiques-hôtels. Chaque fiche se termine par un Conseil du Concierge, signé par notre conciergerie. Agence IATA accréditée.',
  applicationName: 'MyConciergeHotel',
  authors: [{ name: 'MyConciergeHotel' }],
  formatDetection: { email: false, address: false, telephone: false },
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
