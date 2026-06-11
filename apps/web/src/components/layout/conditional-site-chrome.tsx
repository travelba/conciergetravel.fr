import { headers } from 'next/headers';
import type { ReactElement } from 'react';

import { isHomePathname } from '@/lib/home/is-home-pathname';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/**
 * Renders the default Tailwind site header/footer on every route except
 * the home page, which ships its own kit header + footer inside
 * `page.tsx` (design/html-kit/index.html parity).
 */
export async function ConditionalSiteHeader(): Promise<ReactElement | null> {
  const rawPath = (await headers()).get('x-pathname') ?? '/';
  if (isHomePathname(rawPath)) return null;
  return <SiteHeader />;
}

export async function ConditionalSiteFooter(): Promise<ReactElement | null> {
  const rawPath = (await headers()).get('x-pathname') ?? '/';
  if (isHomePathname(rawPath)) return null;
  return <SiteFooter />;
}
