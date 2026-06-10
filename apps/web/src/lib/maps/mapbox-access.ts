import { env } from '@/lib/env';

/** Public Mapbox token (`pk.*`) — required for GL + Static Images in the browser. */
export function getMapboxAccessToken(): string | null {
  const token = env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  return token !== undefined && token.length > 0 ? token : null;
}
