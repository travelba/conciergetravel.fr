/**
 * True when the request pathname is the locale home (`/` or `/fr`, `/en`).
 * Reads the `x-pathname` header set by `proxy.ts` (same contract as
 * `components/layout/breadcrumb.tsx`).
 */
export function isHomePathname(rawPath: string): boolean {
  const path = rawPath.split('?')[0]?.split('#')[0] ?? '/';
  if (path === '/') return true;
  return /^\/(fr|en)\/?$/.test(path);
}
