import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://myconciergehotel.com'),
  title: {
    default: 'MyConciergeHotel — La sélection du Concierge',
    template: '%s · MyConciergeHotel',
  },
  description:
    "Hôtels d'exception sélectionnés par le Concierge — Palaces, Relais & Châteaux, adresses confidentielles.",
  applicationName: 'MyConciergeHotel',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#fafaf8',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
