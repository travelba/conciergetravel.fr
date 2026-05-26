import { Bodoni_Moda } from 'next/font/google';

/**
 * Display serif for Stitch "L'Héritage Editorial" hotel fiches only.
 * Scoped via `apps/web/src/app/[locale]/hotel/layout.tsx` — not loaded site-wide.
 */
export const bodoniHeritage = Bodoni_Moda({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heritage-display',
  weight: ['400', '500', '600'],
});
