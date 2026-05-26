import type { ReactElement, ReactNode } from 'react';

import { bodoniHeritage } from '@/lib/fonts/bodoni-heritage';

import '@/styles/heritage-hotel.css';

interface HotelLayoutProps {
  readonly children: ReactNode;
}

/**
 * Stitch heritage design system scope for `/hotel/*` routes.
 * Loads Bodoni Moda + heritage utility classes without affecting the rest of the site.
 */
export default function HotelLayout({ children }: HotelLayoutProps): ReactElement {
  return <div className={`${bodoniHeritage.variable} heritage-hotel min-h-full`}>{children}</div>;
}
