'use client';

import type { ReactNode } from 'react';

import { usePathname } from '@/i18n/navigation';

/**
 * Renders the default site header/footer on every route except the home
 * page, which ships its own kit header + footer inside `page.tsx`
 * (design/html-kit/index.html parity).
 *
 * Why this is a **client** gate (and not a server `headers()` read):
 * the chrome lives in the shared `[locale]/layout.tsx`. In the App Router
 * a shared layout is NOT re-rendered on client-side (soft) navigation —
 * the router reuses the cached layout segment. A server-side decision
 * based on `x-pathname` is therefore frozen at the first hard load: if a
 * user clicks from an inner page (SiteHeader visible) onto the home, the
 * stale SiteHeader stays mounted while the home renders its kit header →
 * two menus. `usePathname()` re-evaluates on every navigation, so the
 * gate always matches the current route.
 *
 * The server-rendered `<SiteHeader/>` / `<SiteFooter/>` are passed as
 * children (RSC-as-children pattern). Their markup is route-invariant,
 * so reusing the same element across routes is safe — only its
 * visibility is toggled here.
 */
export function ConditionalSiteHeader({ children }: { readonly children: ReactNode }): ReactNode {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return children;
}

export function ConditionalSiteFooter({ children }: { readonly children: ReactNode }): ReactNode {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return children;
}
