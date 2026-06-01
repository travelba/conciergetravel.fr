import type { ReactElement, ReactNode } from 'react';

interface HotelLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout scope for `/hotel/*` routes. Plain passthrough — the hotel
 * fiche uses the site-wide design system (no dedicated skin).
 */
export default function HotelLayout({ children }: HotelLayoutProps): ReactElement {
  return <div className="min-h-full">{children}</div>;
}
